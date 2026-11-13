// Czysta logika synchronizacji (2026-11-13, user: "flow pomiędzy telefonem,
// komputerem i zegarkiem... ma działać smooth"). services/cloudSync.ts robi sieć,
// tu tylko decyzje — testowalne bez Firestore.
//
// Model: każdy element kolekcji = dokument users/{uid}/{kolekcja}/{id} z polami
// elementu + `_u` (ms, czas wysłania) + opcjonalnie `_deleted: true` (znacznik
// usunięcia — zostaje w chmurze, żeby inne urządzenie nie "wskrzesiło" elementu).
// Konflikt: wygrywa nowsza zmiana (lokalnie: updatedAt elementu; zdalnie: `_u`).

export interface SyncItem { id: string; updatedAt?: string | number; createdAt?: string | number }
export interface RemoteDoc { id: string; data: Record<string, any> }

// JSON z posortowanymi kluczami — porównanie lokalnego i zdalnego bez względu na
// kolejność pól (Firestore jej nie zachowuje); `undefined` pomijane jak w JSON.
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? 'null' : stableStringify(x))).join(',')}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}

export function stripMeta<T>(data: Record<string, any>, id: string): T {
  const { _u, _deleted, _s, ...rest } = data;
  return { ...rest, id } as T;
}

// updatedAt bywa ISO (zadania, wydatki) albo ms (pojazdy, subskrypcje).
export function localTime(item: SyncItem): number {
  const v = (item.updatedAt ?? item.createdAt) as unknown;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const t = Date.parse(typeof v === 'string' ? v : '');
  return Number.isFinite(t) ? t : 0;
}

export interface MergePlan<T> {
  items: T[];          // nowy stan lokalny
  push: T[];           // do wysłania (lokalne nowe/nowsze)
  pushDeletes: string[]; // lokalne usunięcia do zapisania w chmurze
  changedLocal: boolean;
}

// Pierwsze scalenie po zalogowaniu/starcie: lokalny stan + cała kolekcja z chmury
// + lokalne znaczniki usunięć (id → ms) zrobione offline.
export function planInitialMerge<T extends SyncItem>(
  local: T[],
  remote: RemoteDoc[],
  localDeletes: Record<string, number>,
): MergePlan<T> {
  const byId = new Map(local.map((x) => [x.id, x]));
  const out = new Map(byId);
  const push: T[] = [];
  const pushDeletes = new Set<string>();
  let changedLocal = false;
  const seen = new Set<string>();

  for (const r of remote) {
    seen.add(r.id);
    const rU = typeof r.data._u === 'number' ? r.data._u : 0;
    const loc = byId.get(r.id);
    const delAt = localDeletes[r.id];
    if (r.data._deleted) {
      if (delAt != null) continue; // obie strony usunęły
      if (loc && localTime(loc) > rU) { push.push(loc); continue; } // edytowane lokalnie po usunięciu gdzie indziej
      if (loc) { out.delete(r.id); changedLocal = true; }
      continue;
    }
    if (delAt != null) {
      if (delAt >= rU) { pushDeletes.add(r.id); out.delete(r.id); }
      else { out.set(r.id, stripMeta<T>(r.data, r.id)); changedLocal = true; } // zdalna edycja nowsza niż lokalne usunięcie
      continue;
    }
    const remoteItem = stripMeta<T>(r.data, r.id);
    if (!loc) { out.set(r.id, remoteItem); changedLocal = true; continue; }
    if (stableStringify(loc) === stableStringify(remoteItem)) continue;
    if (localTime(loc) > rU) push.push(loc);
    else { out.set(r.id, remoteItem); changedLocal = true; }
  }
  for (const loc of local) if (!seen.has(loc.id)) push.push(loc); // nigdy niewysłane
  for (const id of Object.keys(localDeletes)) if (!seen.has(id)) pushDeletes.add(id);

  return { items: [...out.values()], push, pushDeletes: [...pushDeletes], changedLocal };
}

// Różnica między ostatnio zsynchronizowanym a bieżącym stanem lokalnym (po
// każdej zmianie w store) — co wysłać.
export function diffLocal<T extends SyncItem>(
  current: T[],
  lastSent: Map<string, string>,
): { upserts: T[]; deletes: string[] } {
  const upserts: T[] = [];
  const ids = new Set<string>();
  for (const it of current) {
    ids.add(it.id);
    if (lastSent.get(it.id) !== stableStringify(it)) upserts.push(it);
  }
  const deletes = [...lastSent.keys()].filter((id) => !ids.has(id));
  return { upserts, deletes };
}

// Zastosowanie zmian z chmury (onSnapshot) do lokalnej listy. Zmiana zdalna jest
// odrzucana, gdy lokalny element ma nowszą, jeszcze niewysłaną edycję.
export function applyRemote<T extends SyncItem>(
  local: T[],
  changes: RemoteDoc[],
  pendingLocal: Set<string>,
): { items: T[]; applied: { id: string; item: T | null }[] } {
  const map = new Map(local.map((x) => [x.id, x]));
  const applied: { id: string; item: T | null }[] = [];
  for (const c of changes) {
    if (pendingLocal.has(c.id)) continue;
    if (c.data._deleted) {
      if (map.has(c.id)) { map.delete(c.id); applied.push({ id: c.id, item: null }); }
      continue;
    }
    const item = stripMeta<T>(c.data, c.id);
    const cur = map.get(c.id);
    if (cur && stableStringify(cur) === stableStringify(item)) continue;
    map.set(c.id, item);
    applied.push({ id: c.id, item });
  }
  return { items: [...map.values()], applied };
}

// ── Synchronizacja przyrostowa (2026-11-13, wydatki itd.) ──────────────────────
// Przy tysiącach wydatków pełne pobranie kolekcji przy każdym starcie zjadłoby
// darmowy limit odczytów Firestore. Zamiast tego per kolekcja trzymamy lokalnie
// (AsyncStorage): skrót (hash) każdego elementu ostatnio zgodnego z chmurą +
// znacznik czasu serwera ostatniej widzianej zmiany. Start = wyślij lokalne różnice
// względem skrótów + pobierz tylko dokumenty zmienione po znaczniku.

// cyrb53 — szybki 53-bitowy skrót tekstu (nie kryptograficzny; tu tylko "czy się zmieniło").
export function hashStr(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
export const itemHash = (item: unknown) => hashStr(stableStringify(item));

// Różnica stanu lokalnego względem znanych skrótów. `refs` — ten sam obiekt co
// ostatnio (zustand nie kopiuje niezmienionych elementów) = bez liczenia skrótu.
export function diffByHash<T extends SyncItem>(
  current: T[],
  known: Map<string, string>,
  refs?: Map<string, T>,
): { upserts: { item: T; hash: string }[]; deletes: string[] } {
  const upserts: { item: T; hash: string }[] = [];
  const ids = new Set<string>();
  for (const it of current) {
    ids.add(it.id);
    if (refs && refs.get(it.id) === it && known.has(it.id)) continue;
    const h = itemHash(it);
    if (refs) refs.set(it.id, it);
    if (known.get(it.id) !== h) upserts.push({ item: it, hash: h });
  }
  const deletes = [...known.keys()].filter((id) => !ids.has(id));
  return { upserts, deletes };
}

// Pojedynczy dokument (np. podsumowanie zdrowia, saldo): co zrobić przy starcie.
// local/remote = skróty treści; last = skrót ostatnio zgodnego stanu (null = nigdy).
// Pusty dokument (np. komputer bez danych z zegarka) NIGDY nie nadpisuje pełnego;
// przy pierwszym spotkaniu dwóch pełnych wygrywa nowszy znacznik (`stamp`, ms).
export interface DocSide { hash: string; empty: boolean; stamp: number }
export function planDocMerge(local: DocSide | null, last: string | null, remote: DocSide | null): 'push' | 'pull' | 'none' {
  if (remote == null) return local != null && !local.empty ? 'push' : 'none';
  if (local != null && local.hash === remote.hash) return 'none';
  if (local == null || local.empty) return remote.empty ? 'none' : 'pull';
  if (remote.empty) return 'push';
  if (last == null) return local.stamp > remote.stamp ? 'push' : 'pull'; // pierwszy raz na tym urządzeniu
  return planDocMergeKnown(local.hash, last);
}
function planDocMergeKnown(local: string, last: string): 'push' | 'pull' {
  if (local === last) return 'pull'; // tu bez zmian → zmiana z innego urządzenia
  return 'push';                     // zmienione tu (offline) → wygrywa lokalne
}
