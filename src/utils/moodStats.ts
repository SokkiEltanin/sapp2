import type { MoodEntry } from '@/types/mood';
import type { Expense } from '@/types/finances';
import type { HealthLog } from './monthCards';
import { bucketOf, isOwnTransfer } from './fixedVariable';
import { foodSplitOf } from './foodStats';

// Statystyki humoru (2026-11-18, user: "przy humorze mini przycisk do zakładki humoru —
// średnia, pixel year, wykresy, może zależności od zakupów"). Czyste funkcje
// (__tests__/moodStats.test.ts); widok: components/mood/MoodStatsSheet.tsx.
// Dzień = średnia ze wszystkich wpisów tego dnia (humor można zapisać kilka razy).

export interface DayMood { date: string; mood: number; energy: number; n: number }

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const avgOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function dailyMood(entries: MoodEntry[]): Map<string, DayMood> {
  const acc = new Map<string, { m: number; e: number; n: number }>();
  for (const e of entries) {
    if (!e.date) continue;
    const a = acc.get(e.date) ?? { m: 0, e: 0, n: 0 };
    a.m += e.mood; a.e += e.energy; a.n++;
    acc.set(e.date, a);
  }
  const out = new Map<string, DayMood>();
  for (const [date, a] of acc) out.set(date, { date, mood: a.m / a.n, energy: a.e / a.n, n: a.n });
  return out;
}

/** Ostatnie `span` dni (z dzisiaj) — po jednej pozycji na dzień, null = brak wpisu. */
export function lastDays(days: Map<string, DayMood>, span: number, now: Date = new Date()): { date: string; d: DayMood | null }[] {
  return Array.from({ length: span }, (_, i) => {
    const date = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (span - 1 - i)));
    return { date, d: days.get(date) ?? null };
  });
}

export interface MoodSummary { avg: number | null; energy: number | null; days: number; prevAvg: number | null; delta: number | null }
/** Średnia z ostatnich `span` dni vs poprzednie `span` dni. */
export function moodSummary(days: Map<string, DayMood>, span = 30, now: Date = new Date()): MoodSummary {
  const cur = lastDays(days, span, now).map((x) => x.d).filter(Boolean) as DayMood[];
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - span);
  const prev = lastDays(days, span, prevEnd).map((x) => x.d).filter(Boolean) as DayMood[];
  const avg = avgOf(cur.map((d) => d.mood));
  const prevAvg = avgOf(prev.map((d) => d.mood));
  return {
    avg, energy: avgOf(cur.map((d) => d.energy)), days: cur.length, prevAvg,
    delta: avg != null && prevAvg != null && prev.length >= 3 ? avg - prevAvg : null,
  };
}

export const WD_SHORT = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];
/** Średni humor wg dnia tygodnia (pn…nd). */
export function weekdayMood(days: Map<string, DayMood>): { label: string; avg: number | null; n: number }[] {
  const b = Array.from({ length: 7 }, () => [] as number[]);
  for (const d of days.values()) {
    const wd = (new Date(`${d.date}T12:00:00`).getDay() + 6) % 7;
    b[wd].push(d.mood);
  }
  return b.map((xs, i) => ({ label: WD_SHORT[i], avg: avgOf(xs), n: xs.length }));
}

/** Rok w pikselach: 12 miesięcy × liczba dni, wartość = średni humor albo null. */
export function yearPixels(days: Map<string, DayMood>, year: number): (number | null)[][] {
  return Array.from({ length: 12 }, (_, m) => {
    const n = new Date(year, m + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => days.get(`${year}-${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)?.mood ?? null);
  });
}

export interface MoodLink {
  key: string;
  label: string;      // "Sen 7 h i więcej"
  vs: string;         // "krócej"
  a: number; b: number; // średni humor: warunek spełniony / nie
  na: number; nb: number;
  diff: number;       // a − b
}

const MIN_DAYS = 3;
const link = (key: string, label: string, vs: string, yes: number[], no: number[]): MoodLink | null => {
  if (yes.length < MIN_DAYS || no.length < MIN_DAYS) return null;
  const a = avgOf(yes)!, b = avgOf(no)!;
  return { key, label, vs, a, b, na: yes.length, nb: no.length, diff: a - b };
};

/** Wydatki "na bieżąco" danego dnia — bez stałych opłat i przelewów własnych. */
function dailySpend(expenses: Expense[]): { spend: Map<string, number>; sweets: Set<string> } {
  const spend = new Map<string, number>();
  const sweets = new Set<string>();
  for (const e of expenses) {
    if (e.type !== 'expense' || isOwnTransfer(e) || !e.date) continue;
    const d = e.date.slice(0, 10);
    if (bucketOf(e) !== 'fixed') spend.set(d, (spend.get(d) ?? 0) + e.amount);
    if ((foodSplitOf(e).get('słodycze') ?? 0) > 0) sweets.add(d);
  }
  return { spend, sweets };
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Zależności: średni humor w dni "z" vs "bez" (sen, kroki, wydatki, słodycze, czas z telefonem, weekend,
 * dzień po dużych zakupach). Tylko te z ≥3 dniami po obu stronach, posortowane wg siły.
 */
export function moodLinks(days: Map<string, DayMood>, expenses: Expense[], health: HealthLog, screen: Record<string, { total: number }> = {}, goodDates?: Set<string>): MoodLink[] {
  const list = [...days.values()];
  const { spend, sweets } = dailySpend(expenses);
  const out: (MoodLink | null)[] = [];
  const split = (pred: (d: DayMood) => boolean | null) => {
    const yes: number[] = [], no: number[] = [];
    for (const d of list) { const p = pred(d); if (p == null) continue; (p ? yes : no).push(d.mood); }
    return [yes, no] as const;
  };

  out.push(link('sleep', 'Sen 7 h i więcej', 'krócej', ...split((d) => {
    const m = health[d.date]?.[1]; return m != null && m > 0 ? m >= 420 : null;
  })));
  out.push(link('steps', 'Ponad 8 000 kroków', 'mniej', ...split((d) => {
    const s = health[d.date]?.[0]; return s != null && s > 0 ? s >= 8000 : null;
  })));
  const nonZero = list.map((d) => spend.get(d.date) ?? 0).filter((v) => v > 0);
  const thr = Math.max(20, Math.round(median(nonZero) / 10) * 10);
  out.push(link('spend', `Wydatki ponad ${thr} zł`, 'mniej lub nic', ...split((d) => (spend.get(d.date) ?? 0) > thr)));
  out.push(link('nospend', 'Dzień bez wydatków', 'z wydatkami', ...split((d) => !spend.has(d.date))));
  out.push(link('sweets', 'Kupione słodycze', 'bez słodyczy', ...split((d) => sweets.has(d.date))));
  // Czas z telefonem (2026-11-22): próg = mediana dni z danymi, zaokrąglona do 30 min (min. 1 h).
  const scr = list.map((d) => screen[d.date]?.total).filter((v): v is number => v != null && v > 0);
  if (scr.length) {
    const sthr = Math.max(60, Math.round(median(scr) / 30) * 30);
    const hl = sthr % 60 ? `${Math.floor(sthr / 60)},5 h` : `${sthr / 60} h`;
    out.push(link('screen', `Ponad ${hl} z telefonem`, 'mniej', ...split((d) => { const v = screen[d.date]?.total; return v != null && v > 0 ? v > sthr : null; })));
  }
  // Jedna dobra rzecz z dnia (2026-11-22): dni z zapisaną dobrą rzeczą vs bez (od pierwszego wpisu).
  if (goodDates?.size) {
    const first = [...goodDates].sort()[0];
    out.push(link('good', 'Zapisana dobra rzecz dnia', 'bez', ...split((d) => (d.date >= first ? goodDates.has(d.date) : null))));
  }
  out.push(link('weekend', 'Weekend', 'dni robocze', ...split((d) => { const w = new Date(`${d.date}T12:00:00`).getDay(); return w === 0 || w === 6; })));

  return (out.filter(Boolean) as MoodLink[]).sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
}

/** Tagi z wpisów: średni humor przy tagu (≥3 użycia), od najlepszego. */
export function tagMood(entries: MoodEntry[]): { tag: string; avg: number; n: number }[] {
  const m = new Map<string, number[]>();
  for (const e of entries) for (const t of e.tags ?? []) { const a = m.get(t) ?? []; a.push(e.mood); m.set(t, a); }
  return [...m.entries()].filter(([, xs]) => xs.length >= MIN_DAYS)
    .map(([tag, xs]) => ({ tag, avg: avgOf(xs)!, n: xs.length }))
    .sort((a, b) => b.avg - a.avg);
}
