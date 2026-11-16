import type { Expense } from '@/types/finances';
import type { BudgetScope } from '@/types/budgets';
import { amountInScope } from './budgets';
import { fvSplitOf } from './fixedVariable';
import { fixedCategoryOf } from './fixedCategory';
import { round2 } from './money';

// Postęp miesiąca "do dziś" (2026-11-16, user: "aktualny progress miesiąca, ale taki
// logiczny, że porównuje pierwsze dni ostatnich miesięcy do pierwszych dni tego, nie
// całe... wydatki, słodycze... prąd: ile i kiedy wydaję i czy się zwiększa w zimę").
// 16 listopada → 1–16 lis vs 1–16 paź / wrz / sie (krótszy miesiąc = do jego końca).
// Klucze metryk jak zakresy budżetów + 'fixed:<tag>' (prąd, czynsz…).
export type PaceKey = BudgetScope | `fixed:${string}`;

export const PACE_LABEL: Record<string, string> = {
  all: 'Wydatki', food: 'Jedzenie', variable: 'Zmienne', fixed: 'Stałe',
  'food:słodycze': 'Słodycze', 'food:napoje': 'Napoje', 'food:przekąski': 'Przekąski', 'fixed:prąd': 'Prąd',
};

export function metricAmount(e: Expense, key: PaceKey): number {
  if (e.type !== 'expense') return 0;
  if (key.startsWith('fixed:')) return fixedCategoryOf(e) === key.slice(6) ? fvSplitOf(e).fixed : 0;
  return amountInScope(e, key as BudgetScope);
}

const ym = (y: number, m: number) => { const d = new Date(y, m, 1); return { y: d.getFullYear(), m: d.getMonth() }; };
const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

/** Suma metryki w dniach 1..day danego miesiąca (day przycięty do długości miesiąca). */
export function windowSum(expenses: Expense[], key: PaceKey, y: number, m: number, day: number): number {
  const dim = new Date(y, m + 1, 0).getDate();
  const from = `${y}-${pad(m + 1)}-01`, to = `${y}-${pad(m + 1)}-${pad(Math.min(day, dim))}`;
  let s = 0;
  for (const e of expenses) { const d = (e.date ?? '').slice(0, 10); if (d >= from && d <= to) s += metricAmount(e, key); }
  return round2(s);
}

// Miesiące, w których appka w ogóle miała dane — inaczej miesiące sprzed instalacji
// zaniżałyby średnią do zera.
function hasData(expenses: Expense[], y: number, m: number): boolean {
  const k = `${y}-${pad(m + 1)}`;
  return expenses.some((e) => e.type === 'expense' && (e.date ?? '').startsWith(k));
}

export interface PaceMonth { key: string; label: string; value: number }
export interface MonthPace {
  key: PaceKey; day: number; current: number; avg: number | null;
  delta: number | null;          // % vs średnia (null bez historii)
  months: PaceMonth[];           // poprzednie miesiące (najstarszy pierwszy), to samo okno dni
}

// `back` = ile poprzednich miesięcy pokazać, średnia ZAWSZE z ostatnich `avgOf` (3) —
// ten sam % na kafelku i w szczegółach.
export function monthPace(expenses: Expense[], key: PaceKey, now: Date = new Date(), back = 3, avgOf = 3): MonthPace {
  const day = now.getDate();
  const current = windowSum(expenses, key, now.getFullYear(), now.getMonth(), day);
  const months: PaceMonth[] = [];
  for (let i = back; i >= 1; i--) {
    const { y, m } = ym(now.getFullYear(), now.getMonth() - i);
    if (!hasData(expenses, y, m)) continue;
    months.push({ key: `${y}-${pad(m + 1)}`, label: MONTHS[m], value: windowSum(expenses, key, y, m, day) });
  }
  const base = months.slice(-avgOf);
  const avg = base.length ? round2(base.reduce((a, x) => a + x.value, 0) / base.length) : null;
  const delta = avg != null && avg > 0 ? Math.round(((current - avg) / avg) * 100) : null;
  return { key, day, current, avg, delta, months };
}

/** Rok do dziś vs ten sam okres rok temu (null, gdy rok temu brak danych). */
export function yearPace(expenses: Expense[], key: PaceKey, now: Date = new Date()): { current: number; last: number | null; delta: number | null } {
  const y = now.getFullYear();
  const md = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  let cur = 0, last = 0, lastAny = false;
  for (const e of expenses) {
    const d = (e.date ?? '').slice(0, 10);
    if (d >= `${y}-01-01` && d <= `${y}-${md}`) cur += metricAmount(e, key);
    if (d.startsWith(`${y - 1}-`)) { lastAny = lastAny || e.type === 'expense'; if (d <= `${y - 1}-${md}`) last += metricAmount(e, key); }
  }
  const l = lastAny ? round2(last) : null;
  return { current: round2(cur), last: l, delta: l != null && l > 0 ? Math.round(((cur - l) / l) * 100) : null };
}

/** Pełne miesiące (najstarszy pierwszy, bieżący na końcu) — prąd miesiąc po miesiącu. */
export function monthlySeries(expenses: Expense[], key: PaceKey, n = 12, now: Date = new Date()): PaceMonth[] {
  const out: PaceMonth[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const { y, m } = ym(now.getFullYear(), now.getMonth() - i);
    out.push({ key: `${y}-${pad(m + 1)}`, label: MONTHS[m], value: windowSum(expenses, key, y, m, 31) });
  }
  return out;
}

/** Zima (lis–lut) vs lato (maj–sie) — średnio na miesiąc z rachunkiem. */
export function seasonCompare(series: PaceMonth[]): { winter: number | null; summer: number | null; delta: number | null } {
  const avg = (ms: number[]) => {
    const v = series.filter((x) => ms.includes(Number(x.key.slice(5, 7))) && x.value > 0).map((x) => x.value);
    return v.length ? round2(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const winter = avg([11, 12, 1, 2]), summer = avg([5, 6, 7, 8]);
  return { winter, summer, delta: winter != null && summer != null && summer > 0 ? Math.round(((winter - summer) / summer) * 100) : null };
}
