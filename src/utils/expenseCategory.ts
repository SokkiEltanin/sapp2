import type { Expense } from '@/types/finances';
import { fvSplitOf, labelFor } from './fixedVariable';
import type { FoodCategoryBar, FoodCategoryItem } from './foodStats';

// Kategorie CAŁEGO wydatku (2026-11-10, user: "zróbmy to drugie, właśnie to
// nie jedzenie, i tam też zróbmy podział na kategorie... żeby były na
// przykład rozrywka i tak dalej") — RÓWNOLEGŁY system do `food.ts`/
// `nonFood.ts`, ale na poziomie CAŁEGO wydatku, nie pozycji paragonu.
// Dopytane przez `AskUserQuestion`: Rozrywka/Transport/itp. nie pasują jako
// pozycja paragonu (bilet do kina, Uber, fryzjer — nic do rozbicia na
// produkty), więc to pole żyje na `Expense.expenseCategory`, nie
// `ReceiptItem`. Wybrane przez usera na start: Rozrywka, Transport,
// Zdrowie, Ubrania, Dom.
export const EXPENSE_CATEGORIES: { tag: string; label: string; color: string }[] = [
  { tag: 'rozrywka', label: 'Rozrywka', color: '#F472B6' },
  { tag: 'transport', label: 'Transport', color: '#60A5FA' },
  { tag: 'zdrowie', label: 'Zdrowie', color: '#4ADE80' },
  { tag: 'ubrania', label: 'Ubrania', color: '#C084FC' },
  { tag: 'dom', label: 'Dom', color: '#FBBF24' },
];
export const EXPENSE_CATEGORY_META: Record<string, { label: string; color: string }> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((s) => [s.tag, { label: s.label, color: s.color }]),
);

function monthKeyOf(dateYmd: string): string {
  return dateYmd.slice(0, 7);
}

// Rozkład po `expenseCategory` (opcjonalnie zawężony do jednego miesiąca) —
// ten sam kształt co `foodByCategory`/`nonFoodByCategory`
// (`FoodCategoryBar`/`FoodCategoryItem`), więc reużywa 1:1 ten sam
// `FoodCategoryItemsModal` drill-down w `WydatkiModal.tsx`. Suma = WKŁAD do
// kubła Zmienne (`fvSplitOf(e).variable`), nie goła `e.amount` — wydatek z
// `fvOverride:'fixed'`/rozpoznany rachunek nie powinien nabrzmiać np.
// "Dom", mimo że miałby ustawioną kategorię. Pomija wydatki bez wkładu do
// Zmiennych (amt <= 0) i bez ustawionej kategorii. Każdy wydatek to JEDEN
// "item" w wyniku (nie ma tu pozycji paragonu do rozbicia).
export function expenseCategoryByCategory(expenses: Expense[], monthFilterKey?: string): FoodCategoryBar[] {
  const sums = new Map<string, number>();
  const items = new Map<string, FoodCategoryItem[]>();
  for (const e of expenses) {
    if (e.type !== 'expense' || !e.expenseCategory) continue;
    if (monthFilterKey && monthKeyOf(e.date) !== monthFilterKey) continue;
    const amt = fvSplitOf(e).variable;
    if (amt <= 0) continue;
    const tag = e.expenseCategory;
    sums.set(tag, (sums.get(tag) ?? 0) + amt);
    const list = items.get(tag) ?? [];
    list.push({ expenseId: e.id, date: e.date, storeName: e.storeName, name: labelFor(e), price: Math.round(amt), quantity: 1 });
    items.set(tag, list);
  }
  return [...sums.entries()]
    .map(([tag, amount]) => ({
      label: EXPENSE_CATEGORY_META[tag]?.label ?? tag,
      amount: Math.round(amount),
      color: EXPENSE_CATEGORY_META[tag]?.color ?? '#8A8A8A',
      items: (items.get(tag) ?? []).sort((a, b) => b.date.localeCompare(a.date) || b.price - a.price),
    }))
    .sort((a, b) => b.amount - a.amount);
}
