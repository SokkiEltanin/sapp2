import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection, doc, onSnapshot, writeBatch, setDoc, query, where, serverTimestamp, Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { create } from 'zustand';
import { db } from '@/firebase';
import { useCalendarStore } from '@/store/calendarStore';
import { useMoodStore } from '@/store/moodStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useSubscriptionsStore } from '@/store/subscriptionsStore';
import { useReplacementsStore } from '@/store/replacementsStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useWorkStore } from '@/store/workStore';
import { useHealthStore } from '@/store/healthStore';
import { useBalanceStore } from '@/store/balanceStore';
import { useDayPlanStore } from '@/store/dayPlanStore';
import { useBudgetsStore } from '@/store/budgetsStore';
import { getBalanceOffset } from '@/utils/balance';
import {
  planInitialMerge, applyRemote, diffByHash, itemHash, planDocMerge, stripMeta,
  type SyncItem, type RemoteDoc,
} from '@/utils/syncMerge';

// Synchronizacja między urządzeniami (2026-11-13, user: "flow pomiędzy telefonem,
// komputerem... synchronizacja danych, wydatków i w ogóle, żeby był podgląd").
//
// Local-first: ekrany czytają WYŁĄCZNIE lokalne store'y (zero czekania na sieć).
// Ten moduł w tle, per kolekcja (users/{uid}/sync_<nazwa>, dokument = element):
//   • PRZYROSTOWO — lokalnie (AsyncStorage `sync-col-v2:<nazwa>`) trzymamy skrót
//     każdego elementu zgodnego z chmurą + czas serwera ostatniej widzianej zmiany
//     (`_s`). Start: wyślij lokalne różnice (też zrobione offline) i pobierz TYLKO
//     dokumenty zmienione później — przy tysiącach wydatków pełne pobieranie przy
//     każdym starcie zjadłoby darmowy limit odczytów Firestore.
//   • Pierwszy raz na urządzeniu (brak stanu) — pełne scalenie
//     (utils/syncMerge.ts's planInitialMerge, wygrywa nowsza zmiana).
//   • Zmiany lokalne (zustand subscribe) → porównanie skrótów po 300 ms → paczka.
//   • Zmiany z chmury na żywo (onSnapshot), bez echa własnych zapisów.
// Usunięcia = znacznik `_deleted` (inne urządzenie go zobaczy).
// Pojedyncze dokumenty (users/{uid}/sync_docs/<nazwa>): podsumowanie zdrowia z
// zegarka (podgląd snu/kroków na komputerze) i drobne ustawienia (saldo itd.).

export type SyncState = 'off' | 'connecting' | 'ok' | 'error';
export const useSyncStatus = create<{ state: SyncState; lastAt: number | null; error: string | null }>(() => ({
  state: 'off', lastAt: null, error: null,
}));

type AnyStore = {
  getState: () => any;
  setState: (p: any) => void;
  subscribe: (cb: (s: any, p: any) => void) => () => void;
  persist: { hasHydrated: () => boolean; onFinishHydration: (cb: () => void) => () => void };
};

interface Binding<T extends SyncItem> {
  name: string;
  store: AnyStore;
  get: () => T[];
  set: (items: T[]) => void;
  subscribe: (cb: () => void) => () => void;
}

function listBinding<T extends SyncItem>(name: string, store: AnyStore, key: string): Binding<T> {
  return {
    name, store,
    get: () => store.getState()[key] ?? [],
    set: (items) => store.setState({ [key]: items }),
    subscribe: (cb) => store.subscribe((s, p) => { if (s[key] !== p[key]) cb(); }),
  };
}

const S = (s: unknown) => s as AnyStore;
const bindings: Binding<any>[] = [
  listBinding('sync_tasks', S(useCalendarStore), 'tasks'),
  listBinding('sync_events', S(useCalendarStore), 'events'),
  listBinding('sync_mood', S(useMoodStore), 'entries'),
  listBinding('sync_expenses', S(useExpensesStore), 'expenses'),
  listBinding('sync_subscriptions', S(useSubscriptionsStore), 'subscriptions'),
  listBinding('sync_replacements', S(useReplacementsStore), 'items'),
  listBinding('sync_vehicles', S(useVehiclesStore), 'vehicles'),
  listBinding('sync_employers', S(useWorkStore), 'employers'),
  listBinding('sync_budgets', S(useBudgetsStore), 'budgets'),
];

// Pojedyncze dokumenty: get → obiekt, set ← obiekt z chmury.
interface DocBinding {
  name: string;
  stores: AnyStore[];
  get: () => Record<string, unknown>;
  set: (v: Record<string, any>) => void;
  isEmpty: (v: Record<string, any>) => boolean; // pusty nigdy nie nadpisuje pełnego
  stamp: () => number;                            // kiedy dane powstały (ms), 0 = nie wiadomo
}
const docBindings: DocBinding[] = [
  {
    // Telefon (Health Connect) pisze, komputer czyta — podgląd snu i kroków.
    name: 'health',
    stores: [S(useHealthStore)],
    get: () => { const h = useHealthStore.getState(); return { today: h.today, history: h.history, manualWeights: h.manualWeights }; },
    set: (v) => useHealthStore.setState({ today: v.today ?? null, history: v.history ?? {}, manualWeights: v.manualWeights ?? [], lastSyncedAt: typeof v._t === 'number' ? new Date(v._t).toISOString() : null }),
    isEmpty: (v) => !v.today && Object.keys(v.history ?? {}).length === 0 && !(v.manualWeights ?? []).length,
    stamp: () => Date.parse(useHealthStore.getState().lastSyncedAt ?? '') || 0,
  },
  {
    name: 'prefs',
    stores: [S(useBalanceStore), S(useSubscriptionsStore), S(useDayPlanStore), S(useWorkStore)],
    get: () => ({
      balanceOffset: useBalanceStore.getState().offset ?? 0,
      dismissedBills: useSubscriptionsStore.getState().dismissedBills,
      dayPlanTags: useDayPlanStore.getState().tags,
      activeEmployerId: useWorkStore.getState().activeEmployerId,
    }),
    set: (v) => {
      if (typeof v.balanceOffset === 'number') useBalanceStore.setState({ offset: v.balanceOffset });
      if (Array.isArray(v.dismissedBills)) useSubscriptionsStore.setState({ dismissedBills: v.dismissedBills });
      if ('dayPlanTags' in v) useDayPlanStore.setState({ tags: v.dayPlanTags ?? null });
      if ('activeEmployerId' in v) useWorkStore.setState({ activeEmployerId: v.activeEmployerId ?? null });
    },
    isEmpty: (v) => !v.balanceOffset && !(v.dismissedBills ?? []).length && v.dayPlanTags == null && v.activeEmployerId == null,
    stamp: () => 0,
  },
];

// Starsza wersja trzymała lokalne usunięcia offline osobno — używane tylko przy
// pierwszym (pełnym) scaleniu kolekcji, potem zbędne.
const LEGACY_DELETES_KEY = 'sync-deletes-v1';
let legacyDeletes: Record<string, Record<string, number>> = {};

const colKey = (name: string) => `sync-col-v2:${name}`;
const DOCS_KEY = 'sync-docs-v2';
interface ColState { hw: number; hashes: Record<string, string> }

const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && !id.includes('/') && id.length < 700;
const ok = () => useSyncStatus.setState({ state: 'ok', lastAt: Date.now(), error: null });
const fail = (e: unknown) => useSyncStatus.setState({ state: 'error', error: String((e as any)?.message ?? e) });
const serverMs = (data: Record<string, any>): number => {
  const s = data?._s;
  return s && typeof s.toMillis === 'function' ? s.toMillis() : 0;
};

class CollectionSync<T extends SyncItem> {
  private known = new Map<string, string>();     // skrót: wysłane lub w kolejce
  private committed = new Map<string, string>(); // skrót: potwierdzone w chmurze (zapisywane)
  private refs = new Map<string, T>();
  private hw = 0;
  private hasState = false;
  private queue = new Map<string, { item: T | null; hash: string | null }>();
  private ready = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private diffTimer: ReturnType<typeof setTimeout> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private retry = 0;
  private unsubs: (() => void)[] = [];
  private stopped = false;

  constructor(private b: Binding<T>, private uid: string) {}

  private col() { return collection(db, 'users', this.uid, this.b.name); }

  async start() {
    try {
      const raw = await AsyncStorage.getItem(colKey(this.b.name));
      const st: ColState | null = raw ? JSON.parse(raw) : null;
      // Stan istnieje (znacznik albo skróty) → przyrostowo. Bez znacznika (appka
      // zamknięta przed potwierdzeniem z serwera) pobieramy wszystko z `_s`, ale
      // różnice lokalne i usunięcia dalej liczymy ze skrótów.
      if (st && (st.hw > 0 || Object.keys(st.hashes ?? {}).length > 0)) {
        this.hw = st.hw ?? 0;
        this.hasState = true;
        for (const [id, h] of Object.entries(st.hashes ?? {})) { this.known.set(id, h); this.committed.set(id, h); }
      }
    } catch { /* uszkodzony stan → pełne scalenie */ }
    if (this.stopped) return;
    const incremental = this.hasState;

    // Zmiany zrobione offline (od ostatniej synchronizacji) — do kolejki od razu,
    // żeby zdalne zmiany ich nie nadpisały.
    if (incremental) this.queueLocalDiff();

    this.unsubs.push(this.b.subscribe(() => {
      if (this.diffTimer) clearTimeout(this.diffTimer);
      this.diffTimer = setTimeout(() => this.onLocalChange(), 300);
    }));

    const q = incremental ? query(this.col(), where('_s', '>', Timestamp.fromMillis(this.hw))) : this.col();
    const unsub: Unsubscribe = onSnapshot(q, (snap) => {
      const changes: RemoteDoc[] = [];
      for (const ch of snap.docChanges()) {
        if (ch.doc.metadata.hasPendingWrites) continue; // echo własnego zapisu w locie
        const data = ch.type === 'removed' ? { _deleted: true } : ch.doc.data();
        this.hw = Math.max(this.hw, serverMs(data));
        changes.push({ id: ch.doc.id, data });
      }
      if (!this.ready) {
        if (incremental) this.applyRemoteChanges(changes);
        else this.initialMerge(snap.docs.map((d) => { const data = d.data(); this.hw = Math.max(this.hw, serverMs(data)); return { id: d.id, data }; }));
        this.ready = true;
        if (this.queue.size) this.schedule(50);
      } else if (changes.length) {
        this.applyRemoteChanges(changes);
      }
      this.saveSoon();
      ok();
    }, fail);
    this.unsubs.push(unsub);
  }

  stop() {
    this.stopped = true;
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    if (this.timer) clearTimeout(this.timer);
    if (this.diffTimer) clearTimeout(this.diffTimer);
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.save(); }
  }

  private queueLocalDiff(): boolean {
    const { upserts, deletes } = diffByHash(this.b.get().filter((x) => validId(x.id)), this.known, this.refs);
    for (const u of upserts) { this.queue.set(u.item.id, { item: u.item, hash: u.hash }); this.known.set(u.item.id, u.hash); }
    for (const id of deletes) { this.queue.set(id, { item: null, hash: null }); this.known.delete(id); this.refs.delete(id); }
    return upserts.length + deletes.length > 0;
  }

  private initialMerge(remote: RemoteDoc[]) {
    const local = this.b.get().filter((x) => validId(x.id));
    const plan = planInitialMerge(local, remote, legacyDeletes[this.b.name] ?? {});
    const pushIds = new Set(plan.push.map((x) => x.id));
    for (const it of plan.items) {
      const h = itemHash(it);
      this.known.set(it.id, h);
      if (!pushIds.has(it.id)) this.committed.set(it.id, h);
    }
    for (const it of plan.push) this.queue.set(it.id, { item: it, hash: this.known.get(it.id) ?? itemHash(it) });
    for (const id of plan.pushDeletes) this.queue.set(id, { item: null, hash: null });
    if (legacyDeletes[this.b.name]) { delete legacyDeletes[this.b.name]; AsyncStorage.setItem(LEGACY_DELETES_KEY, JSON.stringify(legacyDeletes)).catch(() => {}); }
    if (plan.changedLocal) this.b.set(plan.items);
  }

  private applyRemoteChanges(changes: RemoteDoc[]) {
    const { items, applied } = applyRemote(this.b.get(), changes, new Set(this.queue.keys()));
    for (const c of changes) {
      // Zgodne z naszym stanem (np. echo potwierdzonego zapisu) → potwierdzone.
      if (this.queue.has(c.id) || c.data._deleted) continue;
      const h = itemHash(stripMeta(c.data, c.id));
      if (this.known.get(c.id) === h) this.committed.set(c.id, h);
    }
    for (const a of applied) {
      if (a.item) { const h = itemHash(a.item); this.known.set(a.id, h); this.committed.set(a.id, h); }
      else { this.known.delete(a.id); this.committed.delete(a.id); this.refs.delete(a.id); }
    }
    if (applied.length) this.b.set(items); // subscribe → diff pusty (skróty już zgodne)
  }

  private onLocalChange() {
    if (!this.ready) return;
    if (this.queueLocalDiff()) this.schedule(300);
  }

  private schedule(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.flush().catch(() => {}); }, ms);
  }

  private async flush() {
    if (!this.queue.size || this.stopped) return;
    const entries = [...this.queue.entries()].slice(0, 400); // limit paczki Firestore: 500
    const batch = writeBatch(db);
    const u = Date.now();
    for (const [id, { item }] of entries) {
      const ref = doc(db, 'users', this.uid, this.b.name, id);
      if (item) { const { id: _omit, ...rest } = item as any; batch.set(ref, { ...rest, _u: u, _s: serverTimestamp() }); }
      else batch.set(ref, { _deleted: true, _u: u, _s: serverTimestamp() });
    }
    try {
      await batch.commit();
      this.retry = 0;
      for (const [id, entry] of entries) {
        if (entry.hash) this.committed.set(id, entry.hash); else this.committed.delete(id);
        if (this.queue.get(id) === entry) this.queue.delete(id); // nowsza wersja dodana w trakcie zostaje
      }
      this.saveSoon();
      ok();
      if (this.queue.size) this.schedule(50);
    } catch (e) {
      fail(e);
      this.retry = Math.min(this.retry + 1, 6);
      this.schedule(1000 * 2 ** this.retry); // 2 s … ~1 min
    }
  }

  private saveSoon() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.saveTimer = null; this.save(); }, 1500);
  }

  private save() {
    const st: ColState = { hw: this.hw, hashes: Object.fromEntries(this.committed) };
    AsyncStorage.setItem(colKey(this.b.name), JSON.stringify(st)).catch(() => {});
  }
}

let docHashes: Record<string, string> = {};
const saveDocHashes = () => AsyncStorage.setItem(DOCS_KEY, JSON.stringify(docHashes)).catch(() => {});

class DocSync {
  private unsubs: (() => void)[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ready = false;
  private applying = false;

  constructor(private b: DocBinding, private uid: string) {}

  private ref() { return doc(db, 'users', this.uid, 'sync_docs', this.b.name); }
  private localHash() { return itemHash(this.b.get()); }

  start() {
    for (const st of this.b.stores) {
      this.unsubs.push(st.subscribe(() => {
        if (!this.ready || this.applying) return;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => { this.push(false).catch(() => {}); }, 1000);
      }));
    }
    this.unsubs.push(onSnapshot(this.ref(), (snap: any) => {
      if (snap.metadata?.hasPendingWrites) return;
      const raw = snap.exists() ? snap.data() : null;
      const data = raw ? remoteDocData(raw) : null;
      const remoteHash = data ? itemHash(data) : null;
      if (!this.ready) {
        this.ready = true;
        const local = this.b.get();
        const plan = planDocMerge(
          { hash: itemHash(local), empty: this.b.isEmpty(local), stamp: this.b.stamp() },
          docHashes[this.b.name] ?? null,
          data ? { hash: remoteHash!, empty: this.b.isEmpty(data), stamp: typeof raw?._t === 'number' ? raw._t : 0 } : null,
        );
        if (plan === 'pull' && data) this.apply(data, remoteHash!, raw ?? undefined);
        else if (plan === 'push') this.push(true).catch(() => {});
        else if (plan === 'none' && remoteHash) { docHashes[this.b.name] = remoteHash; saveDocHashes(); }
        return;
      }
      if (data && remoteHash !== docHashes[this.b.name] && remoteHash !== this.localHash()) this.apply(data, remoteHash!, raw ?? undefined);
    }, fail));
  }

  private apply(data: Record<string, any>, hash: string, raw?: Record<string, any>) {
    this.applying = true;
    try { this.b.set({ ...data, _t: raw?._t }); } finally { this.applying = false; }
    docHashes[this.b.name] = hash;
    saveDocHashes();
  }

  private async push(force: boolean) {
    const h = this.localHash();
    if (!force && h === docHashes[this.b.name]) return;
    const local = this.b.get();
    // Urządzenie, które nigdy nie było zgodne z chmurą, nie wysyła pustego dokumentu.
    if (this.b.isEmpty(local) && docHashes[this.b.name] == null) return;
    try {
      await setDoc(this.ref(), { ...local, _t: this.b.stamp() || Date.now(), _u: Date.now(), _s: serverTimestamp() });
      docHashes[this.b.name] = h;
      saveDocHashes();
      ok();
    } catch (e) { fail(e); }
  }

  stop() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    if (this.timer) clearTimeout(this.timer);
  }
}

// Treść dokumentu bez pól technicznych (porównywalna z lokalnym `get()`).
function remoteDocData(raw: Record<string, any>): Record<string, any> {
  const { _u, _s, _t, _deleted, ...rest } = raw;
  return rest;
}

let running: { stop: () => void }[] = [];
let generation = 0;

// Czekamy na wczytanie lokalnych store'ów z AsyncStorage — scalenie na pustym
// (jeszcze niewczytanym) stanie zakończyłoby się nadpisaniem chmury starymi danymi.
function hydrated(store: AnyStore): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise((res) => { const u = store.persist.onFinishHydration(() => { u(); res(); }); });
}

export async function startCloudSync(uid: string): Promise<void> {
  stopCloudSync();
  const gen = ++generation;
  const stores = new Set<AnyStore>([...bindings.map((b) => b.store), ...docBindings.flatMap((d) => d.stores)]);
  await Promise.all([...stores].map(hydrated));
  // Saldo: przeniesienie ze starego klucza musi się skończyć PRZED porównaniem.
  if (useBalanceStore.getState().offset == null) useBalanceStore.setState({ offset: await getBalanceOffset() });
  try { legacyDeletes = JSON.parse((await AsyncStorage.getItem(LEGACY_DELETES_KEY)) ?? '{}') ?? {}; } catch { legacyDeletes = {}; }
  try { docHashes = JSON.parse((await AsyncStorage.getItem(DOCS_KEY)) ?? '{}') ?? {}; } catch { docHashes = {}; }
  if (gen !== generation) return; // w międzyczasie wylogowanie / ponowny start
  useSyncStatus.setState({ state: 'connecting', error: null });
  const cols = bindings.map((b) => new CollectionSync(b, uid));
  const docs = docBindings.map((d) => new DocSync(d, uid));
  running = [...cols, ...docs];
  cols.forEach((c) => { c.start().catch(fail); });
  docs.forEach((d) => d.start());
}

export function stopCloudSync(): void {
  generation++;
  running.forEach((r) => r.stop());
  running = [];
  useSyncStatus.setState({ state: 'off' });
}
