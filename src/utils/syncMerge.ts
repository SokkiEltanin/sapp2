// Czysta logika synchronizacji (2026-11-13, user: "flow pomiędzy telefonem,
// komputerem i zegarkiem... ma działać smooth"). services/cloudSync.ts robi sieć,
// tu tylko decyzje — testowalne bez Firestore.
//
// Model: każdy element kolekcji = dokument users/{uid}/{kolekcja}/{id} z polami
// elementu + `_u` (ms, czas wysłania) + opcjonalnie `_deleted: true` (znacznik
// usunięcia — zostaje w chmurze, żeby inne urządzenie nie "wskrzesiło" elementu).
// Konflikt: wygrywa nowsza zmiana (lokalnie: updatedAt elementu; zdalnie: `_u`).

export interface SyncItem { id: string; updatedAt?: string; createdAt?: string }
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
  const { _u, _deleted, ...rest } = data;
  return { ...rest, id } as T;
}

export function localTime(item: SyncItem): number {
  const t = Date.parse(item.updatedAt ?? item.createdAt ?? '');
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
