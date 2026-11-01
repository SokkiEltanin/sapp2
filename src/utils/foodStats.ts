import type { Expense } from '@/types/finances';
import { fvSplitOf, fixedVariableMonths } from './fixedVariable';
import { FOOD_SUBCAT_META } from './food';

// Dashboard, rząd 4 (2026-11-01, user: "czemu na dashboardzie nie ma widgetu... z
// wydatkami jedzenie" — kafelki BYŁY, ale wciąż na MOCK_FOOD_* z 2026-10-30, zanim
// istniał realny `expensesStore`/`foodSubcat`. Teraz że Finanse realnie zbierają
// paragony, to pierwszy realny konsument całego łańcucha Stałe/Zmienne/Jedzenie
// (ARCHITECTURE.md §FINANSE, "Jedzenie = pierwszy realny konsument
// FoodBreakdownCard"). `fvSplitOf(e).food` (NIE goły `foodAmountOf`) — respektuje
// `fvOverride:'food'` i wydatki-rachunki, jedyne poprawne źródło "ile z tego wydatku
// jest jedzeniem".
export const MONTH_SHORT = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
export const MONTH_FULL = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

function monthKeyOf(dateYmd: string): string {
  return dateYmd.slice(0, 7); // YYYY-MM
}

export interface FoodMonthBar { key: string; label: string; value: number }

// Ostatnie `count` miesięcy (łącznie z bieżącym), suma jedzenia w każdym — do
// wykresu `FoodBarsTile`. Oparte na `fixedVariableMonths` (już liczy per-miesiąc
// podział Stałe/Zmienne/Jedzenie tą samą metodą co popup Stałe/Zmienne), żeby nie
// duplikować logiki miesięcznego grupowania.
export function foodByMonth(expenses: Expense[], count = 4, today: Date = new Date()): FoodMonthBar[] {
  return fixedVariableMonths(expenses, count, today).map((m) => {
    const [, mm] = m.month.split('-').map(Number);
    return { key: m.month, label: MONTH_SHORT[mm - 1], value: m.food };
  });
}

export function foodDailyAverageThisMonth(expenses: Expense[], today: Date = new Date()): number {
  const key = monthKeyOf(today.toISOString());
  let sum = 0;
  for (const e of expenses) {
    if (e.type !== 'expense' || monthKeyOf(e.date) !== key) continue;
    sum += fvSplitOf(e).food;
  }
  return sum / today.getDate();
}

export interface FoodWeekBar { label: string; value: number }

// Dni miesiąca pocięte na 5 "tygodni" (T1..T5, po 7 dni, ostatni krótszy/dłuższy) —
// prosty, przewidywalny podział, nie liczy realnych tygodni kalendarzowych (nie ma
// potrzeby — to tylko wykres orientacyjny w popupie "Wydatki").
export function foodByWeekOfMonth(expenses: Expense[], today: Date = new Date()): FoodWeekBar[] {
  const key = monthKeyOf(today.toISOString());
  const weeks = [0, 0, 0, 0, 0];
  for (const e of expenses) {
    if (e.type !== 'expense' || monthKeyOf(e.date) !== key) continue;
    const day = parseInt(e.date.slice(8, 10), 10);
    const idx = Math.min(4, Math.max(0, Math.floor((day - 1) / 7)));
    weeks[idx] += fvSplitOf(e).food;
  }
  return weeks.map((v, i) => ({ label: `T${i + 1}`, value: Math.round(v) }));
}

// Jedna pozycja paragonu wchodząca w skład kategorii — do popupu drill-down
// (FoodCategoryItemsModal), 2026-11-01, user: "jak klikam w jedzenie nie mam tam
// zrobione na takie na popupie jak w sap na dashboardzie" — w sapp stuknięcie w
// kategorię w popupie "Wydatki" otwierało listę KONKRETNYCH pozycji, nie było
// czystą dekoracją.
export interface FoodCategoryItem {
  expenseId: string;
  date: string; // YYYY-MM-DD
  storeName?: string;
  name: string;
  price: number;
  quantity: number;
}

export interface FoodCategoryBar { label: string; amount: number; color: string; items: FoodCategoryItem[] }

// Rozkład jedzenia per `foodSubcat` (opcjonalnie zawężony do jednego miesiąca,
// `YYYY-MM`) — suma CEN POZYCJI (nie całych wydatków, bo jeden paragon miesza
// jedzeniowe i nie-jedzeniowe pozycje), pomija wykluczone/kaucje/bez kategorii.
// Zbiera też same pozycje (`items`) w tej samej przebiegówce — jedno źródło
// prawdy dla sumy kafla I listy drill-down pod spodem, żeby nigdy się nie rozjechały.
export function foodByCategory(expenses: Expense[], monthFilterKey?: string): FoodCategoryBar[] {
  const sums = new Map<string, number>();
  const items = new Map<string, FoodCategoryItem[]>();
  for (const e of expenses) {
    if (e.type !== 'expense') continue;
    if (monthFilterKey && monthKeyOf(e.date) !== monthFilterKey) continue;
    for (const it of e.receiptItems ?? []) {
      if (it.excluded || it.kind === 'deposit' || !it.foodSubcat) continue;
      sums.set(it.foodSubcat, (sums.get(it.foodSubcat) ?? 0) + it.price);
      const list = items.get(it.foodSubcat) ?? [];
      list.push({ expenseId: e.id, date: e.date, storeName: e.storeName, name: it.name, price: it.price, quantity: it.quantity });
      items.set(it.foodSubcat, list);
    }
  }
  return [...sums.entries()]
    .map(([tag, amount]) => ({
      label: FOOD_SUBCAT_META[tag]?.label ?? tag,
      amount: Math.round(amount),
      color: FOOD_SUBCAT_META[tag]?.color ?? '#8A8A8A',
      items: (items.get(tag) ?? []).sort((a, b) => b.date.localeCompare(a.date) || b.price - a.price),
    }))
    .sort((a, b) => b.amount - a.amount);
}
