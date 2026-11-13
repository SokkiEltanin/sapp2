import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, onSnapshot, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { create } from 'zustand';
import { db } from '@/firebase';
import { useCalendarStore } from '@/store/calendarStore';
import { useMoodStore } from '@/store/moodStore';
import {
  planInitialMerge, diffLocal, applyRemote, stableStringify,
  type SyncItem, type RemoteDoc,
} from '@/utils/syncMerge';

// Synchronizacja między urządzeniami (2026-11-13, user: "flow pomiędzy telefonem,
// komputerem i zegarkiem... ma działać zajebiście smooth").
//
// Local-first: ekrany czytają WYŁĄCZNIE lokalne store'y (zero czekania na sieć).
// Ten moduł w tle:
//   • po zalogowaniu pobiera kolekcję z chmury i scala ją z lokalną
//     (utils/syncMerge.ts's planInitialMerge — wygrywa nowsza zmiana),
//   • słucha zmian lokalnych (zustand subscribe) → wysyła paczką co ~0,6 s,
//   • słucha zmian z chmury na żywo (onSnapshot) → wpisuje je do store'a.
// Usunięcia = znacznik `_deleted` w chmurze (inne urządzenie go zobaczy) +
// lokalna lista usunięć zrobionych offline (AsyncStorage), żeby nie zginęły.
//
// Kolekcje: users/{uid}/sync_tasks, sync_events, sync_mood. Prefiks `sync_`
// celowo — stare kolekcje `tasks`/`events` (calendarService, testy z
// Ustawień) mają inny format i nie są tym samym.

export type SyncState = 'off' | 'connecting' | 'ok' | 'error';
export const useSyncStatus = create<{ state: SyncState; lastAt: number | null; error: string | null }>(() => ({
  state: 'off', lastAt: null, error: null,
}));

interface Binding<T extends SyncItem> {
  name: string;
  get: () => T[];
  set: (items: T[]) => void;
  subscribe: (cb: () => void) => () => void;
}

const bindings: Binding<any>[] = [
  {
    name: 'sync_tasks',
    get: () => useCalendarStore.getState().tasks,
    set: (tasks) => useCalendarStore.setState({ tasks }),
    subscribe: (cb) => useCalendarStore.subscribe((s, p) => { if (s.tasks !== p.tasks) cb(); }),
  },
  {
    name: 'sync_events',
    get: () => useCalendarStore.getState().events,
    set: (events) => useCalendarStore.setState({ events }),
    subscribe: (cb) => useCalendarStore.subscribe((s, p) => { if (s.events !== p.events) cb(); }),
  },
  {
    name: 'sync_mood',
    get: () => useMoodStore.getState().entries,
    set: (entries) => useMoodStore.setState({ entries }),
    subscribe: (cb) => useMoodStore.subscribe((s, p) => { if (s.entries !== p.entries) cb(); }),
  },
];

const DELETES_KEY = 'sync-deletes-v1';
type DeletesMap = Record<string, Record<string, number>>; // kolekcja → id → ms
let deletes: DeletesMap = {};
const saveDeletes = () => AsyncStorage.setItem(DELETES_KEY, JSON.stringify(deletes)).catch(() => {});

const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && !id.includes('/') && id.length < 700;

class CollectionSync<T extends SyncItem> {
  private lastSent = new Map<string, string>();
  private queue = new Map<string, T | null>(); // id → element (null = usuń)
  private ready = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private diffTimer: ReturnType<typeof setTimeout> | null = null;
  private retry = 0;
  private unsubs: (() => void)[] = [];

  constructor(private b: Binding<T>, private uid: string) {}

  private col() { return collection(db, 'users', this.uid, this.b.name); }

  start() {
    // Porównanie odłożone (300 ms) — nigdy w tej samej klatce co tap usera, a seria
    // zmian (np. import) liczy się raz.
    this.unsubs.push(this.b.subscribe(() => {
      if (this.diffTimer) clearTimeout(this.diffTimer);
      this.diffTimer = setTimeout(() => this.onLocalChange(), 300);
    }));
    const unsub: Unsubscribe = onSnapshot(this.col(), (snap) => {
      const changes: RemoteDoc[] = [];
      for (const ch of snap.docChanges()) {
        if (ch.doc.metadata.hasPendingWrites) continue; // echo własnego zapisu
        changes.push({ id: ch.doc.id, data: ch.type === 'removed' ? { _deleted: true } : ch.doc.data() });
      }
      if (!this.ready) this.initialMerge(snap.docs.map((d) => ({ id: d.id, data: d.data() })));
      else if (changes.length) this.applyRemoteChanges(changes);
      useSyncStatus.setState({ state: 'ok', lastAt: Date.now(), error: null });
    }, (err) => {
      useSyncStatus.setState({ state: 'error', error: String(err?.message ?? err) });
    });
    this.unsubs.push(unsub);
  }

  stop() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    if (this.timer) clearTimeout(this.timer);
    if (this.diffTimer) clearTimeout(this.diffTimer);
  }

  private initialMerge(remote: RemoteDoc[]) {
    const local = this.b.get().filter((x) => validId(x.id));
    const plan = planInitialMerge(local, remote, deletes[this.b.name] ?? {});
    for (const it of plan.items) this.lastSent.set(it.id, stableStringify(it));
    for (const it of plan.push) { this.queue.set(it.id, it); }
    for (const id of plan.pushDeletes) this.queue.set(id, null);
    this.ready = true;
    if (plan.changedLocal) this.b.set(plan.items);
    if (this.queue.size) this.schedule(50);
  }

  private applyRemoteChanges(changes: RemoteDoc[]) {
    const { items, applied } = applyRemote(this.b.get(), changes, new Set(this.queue.keys()));
    if (!applied.length) return;
    for (const a of applied) {
      if (a.item) this.lastSent.set(a.id, stableStringify(a.item));
      else this.lastSent.delete(a.id);
    }
    this.b.set(items); // subscribe → onLocalChange → diff pusty (lastSent już zgodny)
  }

  private onLocalChange() {
    if (!this.ready) return;
    const { upserts, deletes: dels } = diffLocal(this.b.get().filter((x) => validId(x.id)), this.lastSent);
    if (!upserts.length && !dels.length) return;
    const now = Date.now();
    for (const it of upserts) { this.queue.set(it.id, it); this.lastSent.set(it.id, stableStringify(it)); }
    for (const id of dels) {
      this.queue.set(id, null);
      this.lastSent.delete(id);
      (deletes[this.b.name] ??= {})[id] = now;
    }
    if (dels.length) saveDeletes();
    this.schedule(300);
  }

  private schedule(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.flush().catch(() => {}); }, ms);
  }

  private async flush() {
    if (!this.queue.size) return;
    const entries = [...this.queue.entries()].slice(0, 400); // limit paczki Firestore: 500
    const batch = writeBatch(db);
    const u = Date.now();
    for (const [id, item] of entries) {
      const ref = doc(db, 'users', this.uid, this.b.name, id);
      if (item) { const { id: _omit, ...rest } = item as any; batch.set(ref, { ...rest, _u: u }); }
      else batch.set(ref, { _deleted: true, _u: u });
    }
    try {
      await batch.commit();
      this.retry = 0;
      let delChanged = false;
      for (const [id, item] of entries) {
        if (this.queue.get(id) === item) this.queue.delete(id); // nie usuwaj nowszej wersji dodanej w trakcie
        if (!item && deletes[this.b.name]?.[id] != null) { delete deletes[this.b.name][id]; delChanged = true; }
      }
      if (delChanged) saveDeletes();
      useSyncStatus.setState({ state: 'ok', lastAt: Date.now(), error: null });
      if (this.queue.size) this.schedule(50);
    } catch (e: any) {
      useSyncStatus.setState({ state: 'error', error: String(e?.message ?? e) });
      this.retry = Math.min(this.retry + 1, 6);
      this.schedule(1000 * 2 ** this.retry); // 2 s … ~1 min
    }
  }
}

let running: CollectionSync<any>[] = [];

// Czekamy na wczytanie lokalnych store'ów z AsyncStorage — scalenie na pustym
// (jeszcze niewczytanym) stanie zakończyłoby się nadpisaniem chmury starymi danymi.
function hydrated(store: { persist: { hasHydrated: () => boolean; onFinishHydration: (cb: () => void) => () => void } }): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise((res) => { const u = store.persist.onFinishHydration(() => { u(); res(); }); });
}

export async function startCloudSync(uid: string): Promise<void> {
  stopCloudSync();
  await Promise.all([hydrated(useCalendarStore as any), hydrated(useMoodStore as any)]);
  try { deletes = JSON.parse((await AsyncStorage.getItem(DELETES_KEY)) ?? '{}') ?? {}; } catch { deletes = {}; }
  useSyncStatus.setState({ state: 'connecting', error: null });
  running = bindings.map((b) => new CollectionSync(b, uid));
  running.forEach((r) => r.start());
}

export function stopCloudSync(): void {
  running.forEach((r) => r.stop());
  running = [];
  useSyncStatus.setState({ state: 'off' });
}
