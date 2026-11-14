import type { Expense } from '@/types/finances';
import { fvSplitOf } from './fixedVariable';
import { EXPENSE_CATEGORY_META } from './expenseCategory';

// Szukanie i filtry transakcji (2026-11-14, user: "szukanie lepsze i filtrowanie po
// rodzaju — wydatek czy przychód, cena od do, data"). Czyste — testy
// __tests__/txFilter.test.ts; UI: components/finances/TransactionsModal.tsx.

export type TxKind = 'all' | 'expense' | 'income';
export type TxBucket = 'food' | 'fixed' | 'variable' | `cat:${string}`;
export interface TxFilter {
  query: string;
  kind: TxKind;
  min?: number;
  max?: number;
  from?: string; // YYYY-MM-DD włącznie
  to?: string;   // YYYY-MM-DD włącznie
  bucket?: TxBucket;
}
export const EMPTY_FILTER: TxFilter = { query: '', kind: 'all' };

const fold = (s: string) => s.toLowerCase()
  .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l').replace(/ń/g, 'n')
  .replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ż/g, 'z').replace(/ź/g, 'z');

export interface TxHit { e: Expense; match?: string } // match = pozycja paragonu, która pasowała

function inBucket(e: Expense, b: TxBucket): boolean {
  if (e.type === 'income') return false;
  const s = fvSplitOf(e);
  if (b === 'food') return s.food > 0;
  if (b === 'fixed') return s.fixed > 0;
  if (b === 'variable') return s.variable > 0;
  return e.expenseCategory === b.slice(4);
}

// Zapytanie: słowa (wszystkie muszą pasować, bez polskich znaków) w sklepie, notatce,
// tagach, kategorii i pozycjach paragonu; liczba ("12,50" / "12.5") = kwota.
export function filterTransactions(expenses: Expense[], f: TxFilter): TxHit[] {
  const q = fold(f.query.trim());
  const words = q.split(/\s+/).filter(Boolean);
  const numQ = /^\d+([.,]\d{1,2})?$/.test(f.query.trim()) ? parseFloat(f.query.trim().replace(',', '.')) : null;
  const out: TxHit[] = [];
  for (const e of expenses) {
    if (f.kind !== 'all' && e.type !== f.kind) continue;
    if (f.min != null && e.amount < f.min) continue;
    if (f.max != null && e.amount > f.max) continue;
    const d = (e.date ?? '').slice(0, 10);
    if (f.from && d < f.from) continue;
    if (f.to && d > f.to) continue;
    if (f.bucket && !inBucket(e, f.bucket)) continue;
    if (!words.length) { out.push({ e }); continue; }
    if (numQ != null && Math.abs(e.amount - numQ) < 0.005) { out.push({ e }); continue; }
    const head = fold([
      e.storeName ?? '', e.note ?? '', ...(e.tags ?? []),
      e.expenseCategory ? EXPENSE_CATEGORY_META[e.expenseCategory]?.label ?? '' : '',
    ].join(' '));
    if (words.every((w) => head.includes(w))) { out.push({ e }); continue; }
    const item = e.receiptItems?.find((it) => { const n = fold(it.name); return words.every((w) => n.includes(w) || head.includes(w)); });
    if (item) out.push({ e, match: item.name });
  }
  return out.sort((a, b) => b.e.date.localeCompare(a.e.date) || (b.e.createdAt ?? '').localeCompare(a.e.createdAt ?? ''));
}

export function summarize(hits: TxHit[]): { count: number; out: number; in: number } {
  let o = 0, i = 0;
  for (const { e } of hits) { if (e.type === 'income') i += e.amount; else o += e.amount; }
  return { count: hits.length, out: Math.round(o * 100) / 100, in: Math.round(i * 100) / 100 };
}

export function activeFilterCount(f: TxFilter): number {
  return (f.kind !== 'all' ? 1 : 0) + (f.min != null || f.max != null ? 1 : 0) + (f.from || f.to ? 1 : 0) + (f.bucket ? 1 : 0);
}

// Szybkie zakresy dat.
export function datePreset(p: 'thisMonth' | 'lastMonth' | 'days30' | 'thisYear', now: Date = new Date()): { from: string; to: string } {
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const y = now.getFullYear(), m = now.getMonth();
  if (p === 'thisMonth') return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
  if (p === 'lastMonth') return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
  if (p === 'days30') return { from: ymd(new Date(y, m, now.getDate() - 29)), to: ymd(now) };
  return { from: ymd(new Date(y, 0, 1)), to: ymd(new Date(y, 11, 31)) };
}
