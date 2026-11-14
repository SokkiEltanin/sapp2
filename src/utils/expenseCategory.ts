import type { Expense } from '@/types/finances';
import { fvSplitOf, labelFor } from './fixedVariable';
import type { FoodCategoryBar, FoodCategoryItem } from './foodStats';
import { NON_FOOD_SUBCATS, NON_FOOD_SUBCAT_META } from './nonFood';
import { looksLikeFuel } from './vehicleMatch';

// Kategorie CAŁEGO wydatku (2026-11-10, user: "zróbmy to drugie, właśnie to
// nie jedzenie, i tam też zróbmy podział na kategorie... żeby były na
// przykład rozrywka i tak dalej") — RÓWNOLEGŁY system do `food.ts`/
// `nonFood.ts`, ale na poziomie CAŁEGO wydatku, nie pozycji paragonu.
// Dopytane przez `AskUserQuestion`: Rozrywka/Transport/itp. nie pasują jako
// pozycja paragonu (bilet do kina, Uber, fryzjer — nic do rozbicia na
// produkty), więc to pole żyje na `Expense.expenseCategory`, nie
// `ReceiptItem`. Wybrane przez usera na start: Rozrywka, Transport,
// Zdrowie, Ubrania, Dom.
// 2026-11-14: alias wspólnej listy kategorii Zmiennych (utils/nonFood.ts) — ten sam
// wybór dla całego wydatku i dla pozycji paragonu.
export const EXPENSE_CATEGORIES = NON_FOOD_SUBCATS;
export const EXPENSE_CATEGORY_META = NON_FOOD_SUBCAT_META;

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

// Zmienne po kategoriach (2026-11-14) — RAZEM pozycje paragonu z `nonFoodCategory`
// i resztę wkładu wydatku do Zmiennych (bez tych pozycji) pod `expenseCategory`
// albo "Bez kategorii". Suma = Zmienne z "Podziału". `variableSplitOf` — rozkład
// JEDNEGO wydatku (budżety, filtry transakcji liczą tak samo).
export const UNCATEGORIZED = '__none';
export function variableSplitOf(e: Expense): Map<string, number> {
  const out = new Map<string, number>();
  if (e.type !== 'expense') return out;
  const variable = fvSplitOf(e).variable;
  if (variable <= 0) return out;
  let itemized = 0;
  for (const it of e.receiptItems ?? []) {
    if (it.excluded || it.kind === 'deposit' || !it.nonFoodCategory || it.foodSubcat) continue;
    const amt = Math.min(it.price, variable - itemized);
    if (amt <= 0) break;
    out.set(it.nonFoodCategory, (out.get(it.nonFoodCategory) ?? 0) + amt);
    itemized += amt;
  }
  const rest = Math.round((variable - itemized) * 100) / 100;
  if (rest > 0.004) {
    // Paliwo (2026-11-14): tankowanie bez ręcznej kategorii samo trafia do "Paliwo".
    const tag = e.expenseCategory || (looksLikeFuel(e) ? 'paliwo' : UNCATEGORIZED);
    out.set(tag, (out.get(tag) ?? 0) + rest);
  }
  return out;
}

export function variableByCategory(expenses: Expense[], monthFilterKey?: string): (FoodCategoryBar & { tag: string })[] {
  const sums = new Map<string, number>();
  const items = new Map<string, FoodCategoryItem[]>();
  for (const e of expenses) {
    if (e.type !== 'expense') continue;
    if (monthFilterKey && monthKeyOf(e.date) !== monthFilterKey) continue;
    const split = variableSplitOf(e);
    if (!split.size) continue;
    const itemNames = new Map<string, string[]>();
    for (const it of e.receiptItems ?? []) if (it.nonFoodCategory && !it.foodSubcat && !it.excluded) itemNames.set(it.nonFoodCategory, [...(itemNames.get(it.nonFoodCategory) ?? []), it.name]);
    for (const [tag, amt] of split) {
      sums.set(tag, (sums.get(tag) ?? 0) + amt);
      const list = items.get(tag) ?? [];
      const names = itemNames.get(tag);
      list.push({ expenseId: e.id, date: e.date, storeName: e.storeName, name: names?.length ? names.join(', ') : labelFor(e), price: Math.round(amt * 100) / 100, quantity: 1 });
      items.set(tag, list);
    }
  }
  return [...sums.entries()]
    .map(([tag, amount]) => ({
      tag,
      label: tag === UNCATEGORIZED ? 'Bez kategorii' : EXPENSE_CATEGORY_META[tag]?.label ?? tag,
      amount: Math.round(amount),
      color: tag === UNCATEGORIZED ? '#3F3F3F' : EXPENSE_CATEGORY_META[tag]?.color ?? '#8A8A8A',
      items: (items.get(tag) ?? []).sort((a, b) => b.date.localeCompare(a.date) || b.price - a.price),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => (a.tag === UNCATEGORIZED ? 1 : b.tag === UNCATEGORIZED ? -1 : b.amount - a.amount));
}
