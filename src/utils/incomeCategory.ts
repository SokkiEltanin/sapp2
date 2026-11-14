import type { Expense } from '@/types/finances';
import type { FoodCategoryBar } from './foodStats';
import { normText } from './categoryRules';

// Kategorie przychodów (2026-11-14, z listy "czego brakuje": przychody były jednym
// workiem). Ręczny wybór (`Expense.incomeCategory`) wygrywa; bez niego zgadujemy z
// tagów/opisu (wypłata z banku ma tag "wypłata"). Testy: __tests__/incomeCategory.test.ts.
export const INCOME_CATS: { tag: string; label: string; color: string }[] = [
  { tag: 'pensja', label: 'Wypłata', color: '#4ADE80' },
  { tag: 'zwrot', label: 'Zwroty', color: '#60A5FA' },
  { tag: 'sprzedaz', label: 'Sprzedaż', color: '#FBBF24' },
  { tag: 'prezent', label: 'Prezenty', color: '#F472B6' },
  { tag: 'odsetki', label: 'Odsetki i premie', color: '#2DD4BF' },
  { tag: 'inne', label: 'Inne', color: '#9CA3AF' },
];
export const INCOME_META: Record<string, { label: string; color: string }> = Object.fromEntries(INCOME_CATS.map((c) => [c.tag, c]));

const RULES: [string, RegExp][] = [
  ['pensja', /\b(wyplata|wynagrodzenie|pensja|pobory|premia uznaniowa|zus|l4|zasilek)\b/],
  ['zwrot', /\b(zwrot|refund|reklamacj|chargeback|zwrocono)/],
  ['sprzedaz', /\b(sprzedaz|olx|vinted|allegro|sprzedalem|sprzedalam)\b/],
  ['prezent', /\b(prezent|urodziny|imieniny|swieta|od mamy|od taty|kieszonkowe)\b/],
  ['odsetki', /\b(odsetki|kapitalizacja|lokata|cashback|premia za|bonus)\b/],
];

export function incomeCategoryOf(e: Pick<Expense, 'type' | 'incomeCategory' | 'tags' | 'note' | 'storeName'>): string {
  if (e.incomeCategory && INCOME_META[e.incomeCategory]) return e.incomeCategory;
  const hay = normText(`${(e.tags ?? []).join(' ')} ${e.note ?? ''} ${e.storeName ?? ''}`);
  for (const [tag, re] of RULES) if (re.test(hay)) return tag;
  return 'inne';
}

export function incomeByCategory(expenses: Expense[], monthKey?: string): (FoodCategoryBar & { tag: string })[] {
  const sums = new Map<string, number>();
  const items = new Map<string, FoodCategoryBar['items']>();
  for (const e of expenses) {
    if (e.type !== 'income' || e.fvOverride === 'transfer') continue;
    if (monthKey && (e.date ?? '').slice(0, 7) !== monthKey) continue;
    const tag = incomeCategoryOf(e);
    sums.set(tag, (sums.get(tag) ?? 0) + e.amount);
    items.set(tag, [...(items.get(tag) ?? []), { expenseId: e.id, date: e.date, storeName: e.storeName, name: e.note || e.storeName || 'Przychód', price: e.amount, quantity: 1 }]);
  }
  return [...sums.entries()]
    .map(([tag, amount]) => ({ tag, label: INCOME_META[tag]?.label ?? tag, color: INCOME_META[tag]?.color ?? '#9CA3AF', amount: Math.round(amount), items: items.get(tag) ?? [] }))
    .sort((a, b) => b.amount - a.amount);
}
