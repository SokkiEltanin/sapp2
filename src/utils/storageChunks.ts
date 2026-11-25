// Dzielenie dużych wartości pamięci na kawałki (czysta logika — src/services/safeStorage.ts).
// 400 tys. znaków ≈ max ~1,2 MB w UTF-8 nawet z polskimi literami — bezpiecznie pod ~2 MB
// limitu CursorWindow przy odczycie na Androidzie.
export const CHUNK_CHARS = 400_000;
export const CHUNK_MARK = '__chunks__:';

export const chunkKey = (key: string, i: number) => `${key}__c${i}`;
export const isChunkKey = (k: string) => /__c\d+$/.test(k);

export function parseChunkMark(v: string | null): number | null {
  if (!v || !v.startsWith(CHUNK_MARK)) return null;
  const n = Number(v.slice(CHUNK_MARK.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function chunkString(s: string, size = CHUNK_CHARS): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out.length ? out : [''];
}
