import type { Expense } from '@/types/finances';
import type { FoodCategoryBar, FoodCategoryItem } from './foodStats';

// Kategorie pozycji NIE-jedzeniowych (2026-11-10, user: "daj możliwość dodania...
// higiena, bo chemia to chyba bardziej taka... kapsułki i tak dalej") —
// RÓWNOLEGŁY system do `food.ts`'s `FOOD_SUBCATS`, ten sam kształt (tag/label/
// color), ale dla pozycji które świadomie NIE są jedzeniem. `item.nonFoodCategory`
// (types/finances.ts) jest WZAJEMNIE WYKLUCZAJĄCY z `foodSubcat` — pozycja ma
// jedno albo drugie, ustawiane w `ReceiptItemRow.tsx`'s wspólnym pickerze.
// Pozycja z `nonFoodCategory` dalej liczy się do Zmiennych jak każda inna
// nie-jedzeniowa (`isFoodItem`/`fvSplitOf` patrzą WYŁĄCZNIE na `foodSubcat`,
// bez zmian) — to pole istnieje TYLKO do rozbicia/etykietowania w zakładce
// Zmienne (`VariableBreakdownCard.tsx`), ten sam wzorzec co Jedzenie ma dla
// `foodSubcat` (`foodByCategory`/`FoodCategoryItemsModal` — reużyte 1:1, stąd
// identyczny kształt `FoodCategoryBar`/`FoodCategoryItem`).
//
// 2026-11-14 (user: "dodać kategorie do ZMIENNYCH np. elektronika, części"):
// JEDNA lista kategorii Zmiennych — ta sama dla pozycji paragonu
// (`nonFoodCategory`) i dla całego wydatku (`expenseCategory`,
// utils/expenseCategory.ts to alias tej listy). Tagi starych list zostają
// (rozrywka/transport/zdrowie/ubrania/dom z wydatków, higiena/chemia z pozycji),
// więc istniejące dane się nie zmieniają. Nazwy/kolory/ukrycie/nowe — edytowalne
// w Ustawieniach (store/categoriesStore.ts → utils/categoryRegistry.ts).
export const NON_FOOD_SUBCATS: { tag: string; label: string; color: string }[] = [
  { tag: 'rozrywka', label: 'Rozrywka', color: '#F472B6' },
  { tag: 'transport', label: 'Transport', color: '#60A5FA' },
  { tag: 'zdrowie', label: 'Zdrowie', color: '#4ADE80' },
  { tag: 'ubrania', label: 'Ubrania', color: '#C084FC' },
  { tag: 'dom', label: 'Dom', color: '#FBBF24' },
  { tag: 'higiena', label: 'Higiena', color: '#5EEAD4' },
  { tag: 'chemia', label: 'Chemia', color: '#93C5FD' },
  { tag: 'elektronika', label: 'Elektronika', color: '#22D3EE' },
  { tag: 'części', label: 'Części i motoryzacja', color: '#F97316' },
  { tag: 'hobby', label: 'Hobby', color: '#A3E635' },
  { tag: 'prezenty', label: 'Prezenty', color: '#FB7185' },
  { tag: 'zwierzęta', label: 'Zwierzęta', color: '#D6A15E' },
];
export const NON_FOOD_SUBCAT_META: Record<string, { label: string; color: string }> = Object.fromEntries(
  NON_FOOD_SUBCATS.map((s) => [s.tag, { label: s.label, color: s.color }]),
);
export const NON_FOOD_ITEM_TAGS: string[] = NON_FOOD_SUBCATS.map((s) => s.tag);

function monthKeyOf(dateYmd: string): string {
  return dateYmd.slice(0, 7);
}

// Port 1:1 wzorca `foodByCategory` (utils/foodStats.ts), tylko `nonFoodCategory`
// zamiast `foodSubcat` jako klucz grupowania.
export function nonFoodByCategory(expenses: Expense[], monthFilterKey?: string): FoodCategoryBar[] {
  const sums = new Map<string, number>();
  const items = new Map<string, FoodCategoryItem[]>();
  for (const e of expenses) {
    if (e.type !== 'expense') continue;
    if (monthFilterKey && monthKeyOf(e.date) !== monthFilterKey) continue;
    for (const it of e.receiptItems ?? []) {
      if (it.excluded || it.kind === 'deposit' || !it.nonFoodCategory) continue;
      sums.set(it.nonFoodCategory, (sums.get(it.nonFoodCategory) ?? 0) + it.price);
      const list = items.get(it.nonFoodCategory) ?? [];
      list.push({ expenseId: e.id, date: e.date, storeName: e.storeName, name: it.name, price: it.price, quantity: it.quantity });
      items.set(it.nonFoodCategory, list);
    }
  }
  return [...sums.entries()]
    .map(([tag, amount]) => ({
      label: NON_FOOD_SUBCAT_META[tag]?.label ?? tag,
      amount: Math.round(amount),
      color: NON_FOOD_SUBCAT_META[tag]?.color ?? '#8A8A8A',
      items: (items.get(tag) ?? []).sort((a, b) => b.date.localeCompare(a.date) || b.price - a.price),
    }))
    .sort((a, b) => b.amount - a.amount);
}
