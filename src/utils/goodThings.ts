// Jedna dobra rzecz z dnia (2026-11-22, user: "podać jedną pozytywną rzecz z dnia — podobno
// obniża stres i szanse na depresję"). Jeden wpis na dzień (id `g_<data>`), osobno od humoru
// (można wpisać bez humoru). Czyste funkcje (__tests__/goodThings.test.ts); store:
// store/goodThingsStore.ts; UI: kafel w Daily + components/mood/GoodThingSheet.tsx,
// pole w MoodModal, lista w MoodStatsSheet, szukanie (utils/globalSearch.ts).

export interface GoodThing { id: string; date: string; text: string; createdAt: string; updatedAt: string }

export const goodId = (date: string) => `g_${date}`;

/** Od najnowszego, bez pustych. */
export function goodList(items: GoodThing[]): GoodThing[] {
  return items.filter((g) => g.text.trim()).sort((a, b) => b.date.localeCompare(a.date));
}

/** Ile dni z rzędu (do dziś albo do wczoraj, jeśli dziś jeszcze nie ma) jest dobra rzecz. */
export function goodStreak(items: GoodThing[], today: string): number {
  const have = new Set(goodList(items).map((g) => g.date));
  const d = new Date(`${today}T12:00:00`);
  if (!have.has(today)) d.setDate(d.getDate() - 1);
  let n = 0;
  const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  while (have.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/**
 * "Pamiętasz?" — stara dobra rzecz na gorszy dzień. Wybór stały w ciągu dnia (zależy od
 * daty), tylko wpisy sprzed co najmniej 3 dni.
 */
export function goodMemory(items: GoodThing[], today: string): GoodThing | null {
  const cut = new Date(`${today}T12:00:00`);
  cut.setDate(cut.getDate() - 3);
  const cutS = `${cut.getFullYear()}-${String(cut.getMonth() + 1).padStart(2, '0')}-${String(cut.getDate()).padStart(2, '0')}`;
  const old = goodList(items).filter((g) => g.date <= cutS);
  if (!old.length) return null;
  let h = 0;
  for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return old[h % old.length];
}

/** Gorszy dzień = średni humor dziś poniżej "Tak sobie". */
export function isRoughDay(moods: { date: string; mood: number }[], today: string): boolean {
  const t = moods.filter((m) => m.date === today);
  return t.length > 0 && t.reduce((a, m) => a + m.mood, 0) / t.length < 2.6;
}

export const GOOD_EXAMPLES = [
  'dobra kawa rano', 'rozmowa z kimś bliskim', 'skończone zadanie', 'spacer w słońcu', 'pyszny obiad',
  'ktoś mnie rozśmieszył', 'trening', 'spokojny wieczór', 'nauczyłem się czegoś', 'udało się coś w pracy',
];
export const goodExample = (date: string) => GOOD_EXAMPLES[Number(date.slice(8, 10)) % GOOD_EXAMPLES.length];
