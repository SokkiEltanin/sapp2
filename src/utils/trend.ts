import { incomeCategoryOf } from './incomeCategory';
import type { Expense } from '@/types/finances';
import { fvSplitOf } from './fixedVariable';
import { variableSplitOf } from './expenseCategory';
import { fixedCategoryOf } from './fixedCategory';
import { isFoodItem, foodSubcat } from './food';

// Trend 12 miesięcy (2026-11-14) — ile szło na koszyk/kategorię miesiąc po miesiącu.
// JEDEN przebieg po wydatkach liczy wszystkie serie naraz (klucze jak zakresy
// budżetów + podkategorie jedzenia i stałych). Te same kubły co "Podział" i budżety.
// Klucze: all | food | variable | fixed | income | cat:<tag> | food:<subcat> | fixed:<tag> | inc:<tag>.
export const MONTHS_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

export function lastMonthKeys(n: number, now: Date): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function trendSeries(expenses: Expense[], n = 12, now: Date = new Date()): { months: string[]; series: Map<string, number[]> } {
  const months = lastMonthKeys(n, now);
  const idx = new Map(months.map((m, i) => [m, i]));
  const series = new Map<string, number[]>();
  const add = (k: string, i: number, v: number) => {
    if (!(v > 0)) return;
    let arr = series.get(k);
    if (!arr) { arr = new Array(n).fill(0); series.set(k, arr); }
    arr[i] += v;
  };
  for (const e of expenses) {
    const i = idx.get((e.date ?? '').slice(0, 7));
    if (i == null) continue;
    // Przychody (2026-11-14): koszyk 'income' + `inc:<kategoria>`; przelewy własne pominięte.
    if (e.type === 'income') {
      if (e.fvOverride !== 'transfer') { add('income', i, e.amount); add(`inc:${incomeCategoryOf(e)}`, i, e.amount); }
      continue;
    }
    if (e.type !== 'expense') continue;
    const s = fvSplitOf(e);
    add('all', i, s.fixed + s.food + s.variable);
    add('food', i, s.food);
    add('variable', i, s.variable);
    add('fixed', i, s.fixed);
    if (s.variable > 0) for (const [tag, v] of variableSplitOf(e)) add(`cat:${tag}`, i, v);
    if (s.fixed > 0) add(`fixed:${fixedCategoryOf(e)}`, i, s.fixed);
    if (s.food > 0) {
      const items = (e.receiptItems ?? []).filter(isFoodItem);
      if (items.length) for (const it of items) add(`food:${foodSubcat(it)}`, i, it.price ?? 0);
      else add('food:inne', i, s.food);
    }
  }
  for (const arr of series.values()) for (let i = 0; i < arr.length; i++) arr[i] = Math.round(arr[i]);
  return { months, series };
}

export interface TrendStats {
  avg: number;            // średnia pełnych miesięcy z wydatkami (bez bieżącego)
  current: number;        // bieżący (niepełny) miesiąc
  delta: number | null;   // bieżący vs średnia, % (null gdy brak średniej)
  max: { i: number; v: number };
  total: number;
}

export function trendStats(values: number[]): TrendStats {
  const past = values.slice(0, -1);
  const active = past.filter((v) => v > 0);
  const avg = active.length ? Math.round(active.reduce((a, b) => a + b, 0) / active.length) : 0;
  const current = values[values.length - 1] ?? 0;
  let max = { i: 0, v: 0 };
  values.forEach((v, i) => { if (v > max.v) max = { i, v }; });
  return { avg, current, delta: avg > 0 ? Math.round(((current - avg) / avg) * 100) : null, max, total: values.reduce((a, b) => a + b, 0) };
}

export function monthShort(key: string): string {
  return MONTHS_SHORT[Number(key.slice(5, 7)) - 1] ?? key;
}
