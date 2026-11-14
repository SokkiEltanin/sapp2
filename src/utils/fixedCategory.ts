import type { Expense } from '@/types/finances';
import type { FoodCategoryBar, FoodCategoryItem } from './foodStats';
import { fvSplitOf, labelFor } from './fixedVariable';
import { BILL_TYPES, billTagFor } from './recurringBills';

// Podkategorie STAŁYCH (2026-11-14, user: "3 główne: JEDZENIE, STAŁE, ZMIENNE i one
// na mniejsze — STAŁE: prąd, czynsz/mieszkanie, internet, subskrypcje"). Stałe są
// rozpoznawane automatycznie (słownik rachunków recurringBills.ts + subskrypcje),
// więc kategoria wynika z nazwy płatności — w Ustawieniach można zmienić tylko
// nazwę i kolor (utils/categoryRegistry.ts, rodzaj 'fixed').
const COLORS: Record<string, string> = {
  czynsz: '#F59E0B', prąd: '#FACC15', internet: '#60A5FA', gaz: '#FB923C', woda: '#38BDF8',
  ogrzewanie: '#F87171', ubezpieczenie: '#A78BFA', telefon: '#34D399', subskrypcje: '#F472B6',
};
export const FIXED_CATS: { tag: string; label: string; color: string }[] = [
  ...BILL_TYPES.map((b) => ({ tag: b.tag, label: b.name, color: COLORS[b.tag] ?? '#9CA3AF' })),
  { tag: 'subskrypcje', label: 'Subskrypcje', color: COLORS.subskrypcje },
];
export const FIXED_CAT_META: Record<string, { label: string; color: string }> = Object.fromEntries(
  FIXED_CATS.map((c) => [c.tag, { label: c.label, color: c.color }]),
);
export const FIXED_OTHER = '__fixed_other';

// Rachunek (prąd, internet…) wygrywa nawet dla subskrypcji (abonament internetu =
// Internet); reszta subskrypcji → Subskrypcje; reszta stałych → "Inne stałe".
export function fixedCategoryOf(e: Expense): string {
  const bill = billTagFor(e);
  if (bill) return bill.tag;
  if (e.subscriptionId) return 'subskrypcje';
  return FIXED_OTHER;
}

export function fixedByCategory(expenses: Expense[], monthFilterKey?: string): (FoodCategoryBar & { tag: string })[] {
  const sums = new Map<string, number>();
  const items = new Map<string, FoodCategoryItem[]>();
  for (const e of expenses) {
    if (e.type !== 'expense') continue;
    if (monthFilterKey && (e.date ?? '').slice(0, 7) !== monthFilterKey) continue;
    const amt = fvSplitOf(e).fixed;
    if (amt <= 0) continue;
    const tag = fixedCategoryOf(e);
    sums.set(tag, (sums.get(tag) ?? 0) + amt);
    items.set(tag, [...(items.get(tag) ?? []), { expenseId: e.id, date: e.date, storeName: e.storeName, name: labelFor(e), price: Math.round(amt * 100) / 100, quantity: 1 }]);
  }
  return [...sums.entries()]
    .map(([tag, amount]) => ({
      tag,
      label: tag === FIXED_OTHER ? 'Inne stałe' : FIXED_CAT_META[tag]?.label ?? tag,
      amount: Math.round(amount),
      color: tag === FIXED_OTHER ? '#3F3F3F' : FIXED_CAT_META[tag]?.color ?? '#8A8A8A',
      items: (items.get(tag) ?? []).sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => (a.tag === FIXED_OTHER ? 1 : b.tag === FIXED_OTHER ? -1 : b.amount - a.amount));
}
