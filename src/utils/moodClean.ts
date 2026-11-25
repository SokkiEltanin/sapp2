import type { MoodEntry } from '@/types/mood';

// Porządek we wpisach humoru (2026-11-25, user: "dodałem humor i kafel zrobił się pusty, szary").
// Wpis z każdego źródła (formularz, szybkie kropki, zegarek, sync z komputera, import z sapp) przed
// zapisem przechodzi tędy: nastrój/energia jako liczby 1..5 (tekst "3" → 3), brak energii = 3
// (średnia), wpis bez nastroju albo bez daty odpada. Jeden zły wpis psuł na Androidzie cały kafel.
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const lvl = (v: unknown): number | null => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : Math.min(5, Math.max(1, n));
};

export function cleanMoodEntry(e: MoodEntry): MoodEntry | null {
  if (!e || typeof e !== 'object' || !e.id || !YMD.test(String(e.date))) return null;
  const mood = lvl(e.mood);
  if (mood === null) return null;
  const energy = lvl(e.energy) ?? 3;
  if (mood === e.mood && energy === e.energy && Array.isArray(e.tags)) return e;
  return { ...e, mood, energy, tags: Array.isArray(e.tags) ? e.tags : [] };
}

export function cleanMoodEntries(list: MoodEntry[]): MoodEntry[] {
  if (!Array.isArray(list)) return [];
  const out: MoodEntry[] = [];
  let changed = false;
  for (const e of list) {
    const c = cleanMoodEntry(e);
    if (c !== e) changed = true;
    if (c) out.push(c);
  }
  return changed ? out : list;
}
