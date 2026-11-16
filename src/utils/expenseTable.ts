import type { Expense } from '@/types/finances';
import { trendSeries, MONTHS_SHORT } from './trend';
import { seriesMeta } from './seriesMeta';
import { round2 } from './money';

// Tabela wydatków "jak w Sheets" (2026-11-16, user: "wizualizator wszystkich wydatków...
// tabela jak w excelu/sheets"). Wiersze: Jedzenie / Stałe / Zmienne + podkategorie,
// kolumny: miesiące (najstarszy → bieżący), średnia (pełne miesiące) i suma. Na dole
// Suma, Wpływy i Bilans. Te same kubły co Podział / Trend / budżety (utils/trend.ts).
export interface TableRow { key: string; label: string; color: string; values: number[]; avg: number; total: number }
export interface TableGroup extends TableRow { rows: TableRow[] }
export interface ExpenseTable {
  months: { key: string; label: string }[];
  groups: TableGroup[];
  total: TableRow;
  income: TableRow;
  balance: TableRow;
}

const GROUPS: [string, string, string][] = [['food', 'Jedzenie', '#FBBF24'], ['fixed', 'Stałe', '#60A5FA'], ['variable', 'Zmienne', '#C084FC']];
const SUB_PREFIX: Record<string, string> = { food: 'food:', fixed: 'fixed:', variable: 'cat:' };

// Średnia (2026-11-16, user: "jak nie kupujemy czegoś przez miesiąc, bo kupiliśmy w przód
// na kilka miesięcy, to zero też ma się liczyć — inaczej średnia wychodzi zawyżona"):
// wszystkie PEŁNE miesiące od pierwszego, w którym w ogóle są dane (`from`), RAZEM z
// zerami. Miesiące sprzed początku danych się nie liczą (to nie "zero", tylko brak appki).
function row(key: string, label: string, color: string, values: number[], from = 0): TableRow {
  const full = values.slice(from, -1);
  const avg = full.length ? round2(full.reduce((a, b) => a + b, 0) / full.length) : 0;
  return { key, label, color, values, avg, total: round2(values.reduce((a, b) => a + b, 0)) };
}

export function buildExpenseTable(expenses: Expense[], n = 12, now: Date = new Date()): ExpenseTable {
  const { months, series } = trendSeries(expenses, n, now);
  const zero = () => new Array(n).fill(0);
  const get = (k: string) => series.get(k) ?? zero();
  const all = get('all'), inc = get('income');
  const first = all.findIndex((v, i) => v !== 0 || inc[i] !== 0);
  const from = first < 0 ? n - 1 : first;
  const mk = (k: string, label: string, color: string, values: number[]) => row(k, label, color, values, from);
  const groups: TableGroup[] = GROUPS.map(([k, label, color]) => {
    const rows = [...series.keys()]
      .filter((sk) => sk.startsWith(SUB_PREFIX[k]))
      .map((sk) => { const m = seriesMeta(sk); return mk(sk, m.label, m.color, get(sk)); })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
    return { ...mk(k, label, color, get(k)), rows };
  });
  const total = mk('all', 'Suma wydatków', '#F2F2F2', all);
  const income = mk('income', 'Wpływy', '#4ADE80', inc);
  const balance = mk('balance', 'Bilans', '#F2F2F2', income.values.map((v, i) => round2(v - total.values[i])));
  return {
    months: months.map((k) => ({ key: k, label: `${MONTHS_SHORT[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}` })),
    groups, total, income, balance,
  };
}

/** Intensywność koloru komórki 0..1 względem największej wartości w wierszu. */
export const heat = (v: number, rowMax: number) => (v > 0 && rowMax > 0 ? Math.min(1, v / rowMax) : 0);
