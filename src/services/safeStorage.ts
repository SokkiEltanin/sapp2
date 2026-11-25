import AsyncStorage from '@react-native-async-storage/async-storage';
import { chunkString, isChunkKey, chunkKey, CHUNK_MARK, parseChunkMark, CHUNK_CHARS } from '@/utils/storageChunks';

// Pamięć odporna na duże wartości (2026-11-25, user: "żeby apka była samowystarczalna na długo").
// Android czyta wartość AsyncStorage przez CursorWindow (~2 MB) — większa wartość (np. wszystkie
// rysunki S-Pen w jednym kluczu notatek) przestaje się wczytywać. Tu wartość większa niż
// CHUNK_CHARS idzie w kawałkach `klucz__c0..cN`, a pod samym kluczem zostaje znacznik
// `__chunks__:N`. Najpierw kawałki, potem znacznik (przerwany zapis = stara wersja zostaje).
// Małe wartości bez zmian (zgodne wstecz). Store'y: createJSONStorage(() => safeStorage).
// Kopie (cloudBackup/localBackup) czytają i piszą przez readLogical/writeLogical.
const known = new Map<string, number>(); // klucz → ile kawałków ma teraz (0 = zwykła wartość)

async function dropChunks(key: string, from: number, to: number) {
  if (to <= from) return;
  await AsyncStorage.multiRemove(Array.from({ length: to - from }, (_, i) => chunkKey(key, from + i)));
}

export const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    const v = await AsyncStorage.getItem(key);
    const n = parseChunkMark(v);
    if (n == null) { known.set(key, 0); return v; }
    const parts = await AsyncStorage.multiGet(Array.from({ length: n }, (_, i) => chunkKey(key, i)));
    if (parts.some(([, x]) => x == null)) throw new Error(`Brak części danych ${key} — nic nie nadpisano`);
    known.set(key, n);
    return parts.map(([, x]) => x).join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const prev = known.get(key) ?? 0;
    if (value.length <= CHUNK_CHARS) {
      await AsyncStorage.setItem(key, value);
      await dropChunks(key, 0, prev);
      known.set(key, 0);
      return;
    }
    const parts = chunkString(value);
    await AsyncStorage.multiSet(parts.map((p, i) => [chunkKey(key, i), p] as [string, string]));
    await AsyncStorage.setItem(key, `${CHUNK_MARK}${parts.length}`);
    await dropChunks(key, parts.length, prev);
    known.set(key, parts.length);
  },
  async removeItem(key: string): Promise<void> {
    const v = await AsyncStorage.getItem(key);
    const n = parseChunkMark(v) ?? known.get(key) ?? 0;
    await AsyncStorage.removeItem(key);
    await dropChunks(key, 0, n);
    known.delete(key);
  },
};

/** Wszystkie klucze z PEŁNYMI wartościami (kawałki sklejone, same kawałki pominięte). */
export async function readLogical(filter: (k: string) => boolean): Promise<Record<string, string>> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => !isChunkKey(k) && filter(k));
  const out: Record<string, string> = {};
  for (const k of keys) {
    try { const v = await safeStorage.getItem(k); if (v != null) out[k] = v; } catch { /* uszkodzony klucz pomijamy */ }
  }
  return out;
}

/** Zapis wielu kluczy (duże wartości automatycznie w kawałkach). */
export async function writeLogical(pairs: [string, string][]): Promise<void> {
  for (const [k, v] of pairs) await safeStorage.setItem(k, v);
}

/** Rozmiar danych (znaki ≈ bajty dla tekstu bez polskich liter) — Stan appki / strażnik. */
export async function storageUsage(): Promise<{ total: number; biggest: { key: string; size: number }[] }> {
  const keys = await AsyncStorage.getAllKeys();
  const sizes = new Map<string, number>();
  for (const k of keys) {
    const v = await AsyncStorage.getItem(k);
    const base = isChunkKey(k) ? k.replace(/__c\d+$/, '') : k;
    sizes.set(base, (sizes.get(base) ?? 0) + (v?.length ?? 0));
  }
  const all = [...sizes.entries()].map(([key, size]) => ({ key, size })).sort((a, b) => b.size - a.size);
  return { total: all.reduce((a, b) => a + b.size, 0), biggest: all.slice(0, 5) };
}
