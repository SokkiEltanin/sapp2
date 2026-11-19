import type { Expense } from '@/types/finances';
import { fvSplitOf, fixedVariableMonths, labelFor } from './fixedVariable';
import { FOOD_SUBCAT_META, guessMealSubcat } from './food';
import { round2 } from './money';

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

// Klucz miesiąca z LOKALNEJ daty (2026-11-11, bug) — wcześniej
// `monthKeyOf(today.toISOString())`: ISO to UTC, więc "1 listopada 00:00" w
// Polsce (popup Wydatki liczy z pierwszego dnia oglądanego miesiąca) dawało
// "2026-10" — słupki tygodni w Jedzeniu pokazywały POPRZEDNI miesiąc.
function localMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

export interface FoodWeekBar { label: string; value: number }

// Dni miesiąca pocięte na 5 "tygodni" (T1..T5, po 7 dni, ostatni krótszy/dłuższy) —
// prosty, przewidywalny podział, nie liczy realnych tygodni kalendarzowych (nie ma
// potrzeby — to tylko wykres orientacyjny w popupie "Wydatki").
export function foodByWeekOfMonth(expenses: Expense[], today: Date = new Date()): FoodWeekBar[] {
  const key = localMonthKey(today);
  const weeks = [0, 0, 0, 0, 0];
  for (const e of expenses) {
    if (e.type !== 'expense' || monthKeyOf(e.date) !== key) continue;
    const day = parseInt(e.date.slice(8, 10), 10);
    const idx = Math.min(4, Math.max(0, Math.floor((day - 1) / 7)));
    weeks[idx] += fvSplitOf(e).food;
  }
  return weeks.map((v, i) => ({ label: `T${i + 1}`, value: round2(v) }));
}

// Jedzenie per DZIEŃ oglądanego miesiąca (2026-11-11, user: "na jedzeniu nie
// działa per dzień i per miesiąc" — przełącznik Tygodnie/Dni/Miesiące był
// atrapą). Jeden słupek na każdy dzień miesiąca (28–31).
export function foodByDayOfMonth(expenses: Expense[], month: Date = new Date()): FoodWeekBar[] {
  const key = localMonthKey(month);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days = new Array<number>(daysInMonth).fill(0);
  for (const e of expenses) {
    if (e.type !== 'expense' || monthKeyOf(e.date) !== key) continue;
    const day = parseInt(e.date.slice(8, 10), 10);
    if (day >= 1 && day <= daysInMonth) days[day - 1] += fvSplitOf(e).food;
  }
  return days.map((v, i) => ({ label: String(i + 1), value: round2(v) }));
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
// Rozkład jedzenia JEDNEGO wydatku per podkategoria (2026-11-15, budżety na
// podkategorie: "słodycze, przekąski, napoje"). Kwota jedzenia = fvSplitOf(e).food;
// pozycje paragonu ją rozdzielają (proporcjonalnie, gdy ich suma > kwota), reszta →
// 'inne'. Jedno źródło prawdy dla foodByCategory, budżetów i trendu.
// Kwota jedzenia nierozpisana na pozycje → rodzaj wybrany dla całego wydatku, podpowiedź
// z nazwy (precle/kebab/pizza… → fast food, też dla starych wydatków) albo "inne".
const restSubcat = (e: Expense): string => (e.foodSubcat && FOOD_SUBCAT_META[e.foodSubcat]
  ? e.foodSubcat
  : guessMealSubcat(`${e.storeName ?? ''} ${e.note ?? ''}`) ?? 'inne');

export function foodSplitOf(e: Expense): Map<string, number> {
  const out = new Map<string, number>();
  if (e.type !== 'expense') return out;
  const foodAmt = fvSplitOf(e).food;
  if (foodAmt <= 0) return out;
  const food = (e.receiptItems ?? []).filter((it) => !it.excluded && it.kind !== 'deposit' && !!it.foodSubcat);
  const itemsSum = food.reduce((a, it) => a + (it.price ?? 0), 0);
  const k = itemsSum > foodAmt ? foodAmt / itemsSum : 1;
  for (const it of food) out.set(it.foodSubcat!, (out.get(it.foodSubcat!) ?? 0) + (it.price ?? 0) * k);
  const rest = foodAmt - itemsSum * k;
  const restTag = restSubcat(e);
  if (rest >= 0.01) out.set(restTag, (out.get(restTag) ?? 0) + rest);
  return out;
}

export function foodByCategory(expenses: Expense[], monthFilterKey?: string): FoodCategoryBar[] {
  const sums = new Map<string, number>();
  const items = new Map<string, FoodCategoryItem[]>();
  for (const e of expenses) {
    if (e.type !== 'expense') continue;
    if (monthFilterKey && monthKeyOf(e.date) !== monthFilterKey) continue;
    // Spójnie z "Podziałem"/budżetami/trendem (2026-11-14, bug: wydatek "Rozlicz jako:
    // Jedzenie" bez pozycji paragonu znikał z Podziału — nie liczył się nigdzie):
    // kwota jedzenia = fvSplitOf(e).food; pozycje rozdzielają ją na kategorie, reszta
    // (cały wydatek oznaczony jako jedzenie) → "Inne jedzenie". Wydatek przeniesiony do
    // Stałych/przelew nie liczy już swoich pozycji jako jedzenia.
    const foodAmt = fvSplitOf(e).food;
    if (foodAmt <= 0) continue;
    const food = (e.receiptItems ?? []).filter((it) => !it.excluded && it.kind !== 'deposit' && !!it.foodSubcat);
    const itemsSum = food.reduce((a, it) => a + (it.price ?? 0), 0);
    const k = itemsSum > foodAmt ? foodAmt / itemsSum : 1;
    const put = (tag: string, price: number, row: FoodCategoryItem) => {
      sums.set(tag, (sums.get(tag) ?? 0) + price);
      const list = items.get(tag) ?? [];
      list.push(row);
      items.set(tag, list);
    };
    for (const it of food) {
      put(it.foodSubcat!, it.price * k, { expenseId: e.id, date: e.date, storeName: e.storeName, name: it.name, price: it.price, quantity: it.quantity });
    }
    const rest = foodAmt - itemsSum * k;
    if (rest >= 0.01) put(restSubcat(e), rest, { expenseId: e.id, date: e.date, storeName: e.storeName, name: labelFor(e), price: Math.round(rest * 100) / 100, quantity: 1 });
  }
  return [...sums.entries()]
    .map(([tag, amount]) => ({
      label: FOOD_SUBCAT_META[tag]?.label ?? tag,
      amount: round2(amount),
      color: FOOD_SUBCAT_META[tag]?.color ?? '#8A8A8A',
      items: (items.get(tag) ?? []).sort((a, b) => b.date.localeCompare(a.date) || b.price - a.price),
    }))
    .sort((a, b) => b.amount - a.amount);
}
