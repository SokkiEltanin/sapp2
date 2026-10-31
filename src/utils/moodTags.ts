import type { MoodEntry } from '@/types/mood';

// Port z sapp (src/utils/moodTags.ts) 1:1 — czysta logika, kategorio-niezależna, już
// dobrze przetestowana (56 presetów, dwie niezależne osie trafności nastrój/energia +
// kontekst pory dnia/dnia tygodnia + recency). Zero redesignu potrzebne.
export const PRESET_TAGS = [
  'skupiony', 'zmęczony', 'niespokojny', 'radosny', 'smutny',
  'produktywny', 'rozproszony', 'spokojny', 'motywowany', 'przytłoczony',
  'wdzięczny', 'zestresowany', 'szczęśliwy', 'sfrustrowany', 'zrelaksowany',
  'podekscytowany', 'samotny', 'pełen energii', 'bez motywacji', 'zadowolony',
  'przygnębiony', 'towarzyski', 'twórczy', 'zaniepokojony', 'pewny siebie',
  'niewyspany',
  'zirytowany', 'znudzony', 'zainspirowany', 'dumny', 'winny',
  'zazdrosny', 'zawstydzony', 'spełniony', 'zrezygnowany', 'optymistyczny',
  'pełen nadziei', 'przestraszony', 'zaskoczony', 'ciekawy', 'rozczarowany',
  'wyczerpany', 'zrównoważony', 'niepewny siebie', 'naładowany', 'apatyczny',
  'entuzjastyczny', 'żywiołowy', 'bezsilny', 'zdezorientowany', 'pod presją',
  'wypalony', 'ambitny', 'leniwy', 'rozbity', 'niespełniony',
];

export const POSITIVE_TAGS = new Set([
  'skupiony', 'radosny', 'produktywny', 'spokojny', 'motywowany',
  'wdzięczny', 'szczęśliwy', 'zrelaksowany', 'podekscytowany',
  'pełen energii', 'zadowolony', 'towarzyski', 'twórczy', 'pewny siebie',
  'zainspirowany', 'dumny', 'spełniony', 'optymistyczny', 'pełen nadziei',
  'ciekawy', 'zrównoważony', 'naładowany', 'entuzjastyczny', 'żywiołowy', 'ambitny',
]);
export const NEGATIVE_TAGS = new Set([
  'niespokojny', 'smutny', 'rozproszony', 'przytłoczony',
  'zestresowany', 'sfrustrowany', 'samotny', 'bez motywacji', 'przygnębiony',
  'zaniepokojony',
  'zirytowany', 'znudzony', 'winny', 'zazdrosny', 'zawstydzony',
  'zrezygnowany', 'przestraszony', 'rozczarowany', 'niepewny siebie', 'apatyczny',
  'bezsilny', 'zdezorientowany', 'pod presją', 'wypalony', 'rozbity', 'niespełniony',
]);

export const HIGH_ENERGY_TAGS = new Set([
  'pełen energii', 'skupiony', 'produktywny', 'motywowany', 'podekscytowany',
  'zainspirowany', 'ciekawy', 'naładowany', 'entuzjastyczny', 'żywiołowy', 'ambitny',
]);
export const LOW_ENERGY_TAGS = new Set([
  'zmęczony', 'niewyspany', 'bez motywacji', 'rozproszony',
  'znudzony', 'zrezygnowany', 'wyczerpany', 'apatyczny', 'bezsilny', 'wypalony',
  'leniwy', 'rozbity',
]);

function levelSignal(level: number | undefined): -1 | 0 | 1 {
  if (level == null) return 0;
  if (level <= 2) return -1;
  if (level >= 4) return 1;
  return 0;
}

export function tagRelevance(tag: string, moodSignal: -1 | 0 | 1, energySignal: -1 | 0 | 1): number {
  const moodScore = POSITIVE_TAGS.has(tag) ? 1 : NEGATIVE_TAGS.has(tag) ? -1 : 0;
  const energyScore = HIGH_ENERGY_TAGS.has(tag) ? 1 : LOW_ENERGY_TAGS.has(tag) ? -1 : 0;
  return moodScore * moodSignal + energyScore * energySignal;
}

function recencyWeight(entries: MoodEntry[], now: Date): Map<string, number> {
  const map = new Map<string, number>();
  const nowMs = now.getTime();
  for (const e of entries) {
    const entryMs = new Date(`${e.date}T12:00:00`).getTime();
    const daysAgo = Math.max(0, (nowMs - entryMs) / 86400000);
    const w = Math.pow(0.5, daysAgo / 14);
    for (const t of e.tags) map.set(t, (map.get(t) ?? 0) + w);
  }
  return map;
}

function contextAffinity(entries: MoodEntry[], now: Date): Map<string, number> {
  const curHour = now.getHours();
  const curDow = now.getDay();
  const hourHits = new Map<string, number>();
  const dowHits = new Map<string, number>();
  const total = new Map<string, number>();
  for (const e of entries) {
    const created = new Date(e.createdAt);
    const rawDiff = Math.abs(created.getHours() - curHour);
    const hourDiff = Math.min(rawDiff, 24 - rawDiff);
    const entryDow = new Date(`${e.date}T12:00:00`).getDay();
    for (const t of e.tags) {
      total.set(t, (total.get(t) ?? 0) + 1);
      if (hourDiff <= 2) hourHits.set(t, (hourHits.get(t) ?? 0) + 1);
      if (entryDow === curDow) dowHits.set(t, (dowHits.get(t) ?? 0) + 1);
    }
  }
  const result = new Map<string, number>();
  for (const [tag, n] of total) {
    result.set(tag, (hourHits.get(tag) ?? 0) / n + (dowHits.get(tag) ?? 0) / n);
  }
  return result;
}

export function sortMoodTags(
  mood: number | undefined, energy: number | undefined, entries: MoodEntry[], now: Date = new Date(),
): string[] {
  const moodSignal = levelSignal(mood);
  const energySignal = levelSignal(energy);
  const recency = recencyWeight(entries, now);
  const context = contextAffinity(entries, now);
  const score = (tag: string) =>
    tagRelevance(tag, moodSignal, energySignal) * 10
    + (context.get(tag) ?? 0) * 2
    + (recency.get(tag) ?? 0);
  return [...PRESET_TAGS].sort((a, b) => score(b) - score(a));
}
