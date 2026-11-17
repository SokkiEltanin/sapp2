import type { Expense } from '@/types/finances';
import { trendSeries, lastMonthKeys } from './trend';
import { seriesMeta } from './seriesMeta';
import { round2 } from './money';
import { fvSplitOf, isOwnTransfer } from './fixedVariable';

// Karty miesięcy (2026-11-17, user: "podsumowanie miesiąca w Daily przy karcie miesiąca,
// pokazuje się pierwszego — wszystko: STAŁE, ZMIENNE… i zapisuje się w formie KARTY do
// kolekcji"). Każdy ZAKOŃCZONY miesiąc od pierwszego z danymi = jedna karta. Liczone na
// żywo z wydatków (poprawki danych od razu widać), zdrowie z dziennika kroków/snu
// (store/collectionStore.ts — Health Connect trzyma tylko 30 dni).
export type HealthLog = Record<string, [number | null, number | null]>; // data → [kroki, sen min]

export interface MonthCard {
  key: string;                 // YYYY-MM
  label: string;               // "październik 2026"
  spent: number; fixed: number; variable: number; food: number; sweets: number; prad: number;
  income: number; balance: number;
  vsAvg: number | null;        // wydatki vs średnia 3 poprzednich miesięcy z danymi, %
  top: { label: string; color: string; v: number }[];
  biggest: { name: string; amount: number; date: string } | null;
  count: number;
  steps: number | null;        // średnio dziennie
  sleepMin: number | null;     // średnio na noc
  badges: string[];
}

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
export const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

function healthAvg(log: HealthLog, key: string): { steps: number | null; sleep: number | null } {
  let ss = 0, sn = 0, ls = 0, ln = 0;
  for (const [d, [st, sl]] of Object.entries(log)) {
    if (!d.startsWith(key)) continue;
    if (st != null && st > 0) { ss += st; sn++; }
    if (sl != null && sl > 0) { ls += sl; ln++; }
  }
  return { steps: sn ? Math.round(ss / sn) : null, sleep: ln ? Math.round(ls / ln) : null };
}

export function buildMonthCards(expenses: Expense[], log: HealthLog, now: Date = new Date()): MonthCard[] {
  const firstKey = expenses.reduce<string | null>((m, e) => { const k = (e.date ?? '').slice(0, 7); return k && (!m || k < m) ? k : m; }, null);
  if (!firstKey) return [];
  const curKey = lastMonthKeys(1, now)[0];
  const span = (Number(curKey.slice(0, 4)) - Number(firstKey.slice(0, 4))) * 12 + Number(curKey.slice(5, 7)) - Number(firstKey.slice(5, 7)) + 1;
  const n = Math.min(Math.max(span, 1), 60);
  const { months, series } = trendSeries(expenses, n, now);
  const get = (k: string, i: number) => series.get(k)?.[i] ?? 0;

  const cards: MonthCard[] = [];
  for (let i = 0; i < months.length - 1; i++) {               // bez bieżącego (niepełnego)
    const key = months[i];
    const spent = get('all', i), income = get('income', i);
    if (spent === 0 && income === 0) continue;
    const prev = cards.slice(-3).map((c) => c.spent).filter((v) => v > 0);
    const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 0;
    const top = [...series.keys()]
      .filter((k) => (k.startsWith('cat:') || k.startsWith('food:')) && k !== 'cat:__none' && k !== 'food:inne')
      .map((k) => ({ ...seriesMeta(k), v: get(k, i) }))
      .filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 3);
    let biggest: MonthCard['biggest'] = null, count = 0;
    for (const e of expenses) {
      if (e.type !== 'expense' || isOwnTransfer(e) || !(e.date ?? '').startsWith(key)) continue;
      const s = fvSplitOf(e); const amt = s.fixed + s.food + s.variable;
      if (amt <= 0) continue;
      count++;
      if (!biggest || amt > biggest.amount) biggest = { name: e.storeName || e.note || 'Wydatek', amount: round2(amt), date: e.date.slice(0, 10) };
    }
    const h = healthAvg(log, key);
    cards.push({
      key, label: monthLabel(key),
      spent, fixed: get('fixed', i), variable: get('variable', i), food: get('food', i),
      sweets: get('food:słodycze', i), prad: get('fixed:prąd', i),
      income, balance: round2(income - spent),
      vsAvg: avg > 0 ? Math.round(((spent - avg) / avg) * 100) : null,
      top, biggest, count, steps: h.steps, sleepMin: h.sleep, badges: [],
    });
  }

  // Odznaki względem całej kolekcji (min. 3 karty, żeby miały sens).
  if (cards.length >= 3) {
    const pick = (f: (c: MonthCard) => number, best: 'min' | 'max', label: string, ok: (c: MonthCard) => boolean = () => true) => {
      const pool = cards.filter(ok);
      if (pool.length < 3) return;
      const c = pool.reduce((a, b) => (best === 'min' ? (f(b) < f(a) ? b : a) : (f(b) > f(a) ? b : a)));
      c.badges.push(label);
    };
    pick((c) => c.spent, 'min', 'Najtańszy miesiąc', (c) => c.spent > 0);
    pick((c) => c.spent, 'max', 'Najdroższy miesiąc');
    pick((c) => c.balance, 'max', 'Najwięcej odłożone', (c) => c.income > 0);
    pick((c) => c.sweets, 'min', 'Najmniej słodyczy', (c) => c.food > 0);
    pick((c) => c.steps ?? 0, 'max', 'Najwięcej kroków', (c) => c.steps != null);
  }
  return cards.reverse();                                      // najnowsza pierwsza
}
