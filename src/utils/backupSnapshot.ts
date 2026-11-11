// Kopia zapasowa w chmurze (2026-11-11) — czysta logika bez Firestore/AsyncStorage
// (te w `services/cloudBackup.ts`), żeby dała się przetestować.
//
// Dlaczego: CAŁE dane sapp2 (finanse z zaimportowaną historią z sapp, humor,
// zadania, pojazdy, subskrypcje, praca, pamięć produktów/sprzedawców) żyły
// WYŁĄCZNIE w AsyncStorage telefonu — Firestore był podpięty tylko do ręcznych
// testów. Zgubiony telefon / reinstalacja / "wyczyść dane" = utrata wszystkiego.
// Zamiast pełnego dwukierunkowego syncu (konflikty, kolejka offline — świadomie
// odłożone, patrz NEXT_STEPS "Offline-first, BEZ auto-sync") — JEDNOKIERUNKOWE
// zdjęcie całego AsyncStorage, bez konfliktów.

export const BACKUP_KEY_PREFIX = 'cloud_backup_';
// Firestore: max 1 MiB na dokument. 300k znaków UTF-16 = max ~900 KB nawet dla
// 3-bajtowych znaków w UTF-8 (polskie litery to 2 bajty) — bezpieczny zapas.
export const BACKUP_CHUNK_CHARS = 300_000;

// Sesja logowania Firebase (`firebase:authUser…`) NIE wchodzi do kopii —
// przywrócenie cudzej/starej sesji nadpisałoby bieżące logowanie. Własne
// klucze kopii (data ostatniej kopii, włącznik) też nie.
export function shouldBackupKey(key: string): boolean {
  return !key.startsWith('firebase:') && !key.startsWith(BACKUP_KEY_PREFIX);
}

export function chunkString(s: string, size: number = BACKUP_CHUNK_CHARS): string[] {
  if (s.length === 0) return [''];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

export interface BackupSummary {
  expenses: number;
  mood: number;
  tasks: number;
  subscriptions: number;
  vehicles: number;
}

// Liczby do potwierdzenia przed przywróceniem ("Kopia z 11 lis 14:32: 1203
// wydatki, 87 wpisów humoru…") — user musi widzieć CO nadpisze, zanim nadpisze.
function countIn(entries: Record<string, string>, key: string, field: string): number {
  try {
    const v = JSON.parse(entries[key] ?? 'null')?.state?.[field];
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0;
  }
}

export function summarizeSnapshot(entries: Record<string, string>): BackupSummary {
  return {
    expenses: countIn(entries, 'expenses-store-v1', 'expenses'),
    mood: countIn(entries, 'mood-store-v1', 'entries'),
    tasks: countIn(entries, 'calendar-store-v1', 'tasks'),
    subscriptions: countIn(entries, 'subscriptions-storage', 'subscriptions'),
    vehicles: countIn(entries, 'vehicles-storage', 'vehicles'),
  };
}

export function isBackupDue(lastAtIso: string | null, now: Date, everyHours: number): boolean {
  if (!lastAtIso) return true;
  const last = Date.parse(lastAtIso);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= everyHours * 3600_000;
}
