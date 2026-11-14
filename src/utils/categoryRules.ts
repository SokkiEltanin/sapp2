import type { Expense, ReceiptItem } from '@/types/finances';
import type { CategoryRule } from '@/types/categoryRules';

// Reguły kategoryzacji — czysta logika (testy: __tests__/categoryRules.test.ts).
// Stosowane przy dodawaniu wydatku (store/expensesStore.ts) i przyciskiem
// "uzupełnij istniejące" (components/settings/CategoryRulesSheet.tsx).
// Pierwsza pasująca reguła wygrywa; dłuższy fragment = bardziej szczegółowy, idzie
// pierwszy ("orlen kawa" przed "orlen").

export function normText(s: string | undefined | null): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/\s+/g, ' ').trim();
}

function ordered(rules: CategoryRule[], field: CategoryRule['field']): CategoryRule[] {
  return rules.filter((r) => r.field === field && normText(r.match)).sort((a, b) => normText(b.match).length - normText(a.match).length);
}

export function ruleForStore(e: Pick<Expense, 'storeName' | 'note'>, rules: CategoryRule[]): CategoryRule | undefined {
  const hay = `${normText(e.storeName)} ${normText(e.note)}`;
  return ordered(rules, 'store').find((r) => r.kind === 'var' && hay.includes(normText(r.match)));
}

export function ruleForItem(name: string, rules: CategoryRule[]): CategoryRule | undefined {
  const hay = normText(name);
  return ordered(rules, 'item').find((r) => hay.includes(normText(r.match)));
}

/** Uzupełnia puste kategorie wg reguł. Zwraca NOWY wydatek albo null, gdy nic się nie zmieniło. */
export function applyCategoryRules(e: Expense, rules: CategoryRule[]): Expense | null {
  if (rules.length === 0 || e.type !== 'expense') return null;
  let changed = false;
  let items: ReceiptItem[] | undefined = e.receiptItems;
  if (items?.length && rules.some((r) => r.field === 'item')) {
    items = items.map((it) => {
      if (it.foodSubcat || it.nonFoodCategory || it.kind === 'deposit') return it;
      const r = ruleForItem(it.name, rules);
      if (!r) return it;
      changed = true;
      return r.kind === 'food' ? { ...it, foodSubcat: r.tag } : { ...it, nonFoodCategory: r.tag };
    });
  }
  let expenseCategory = e.expenseCategory;
  if (!expenseCategory) {
    const r = ruleForStore(e, rules);
    if (r) { expenseCategory = r.tag; changed = true; }
  }
  if (!changed) return null;
  return { ...e, receiptItems: items, ...(expenseCategory ? { expenseCategory } : {}) };
}

/** Ile wydatków reguła by uzupełniła (podgląd przed dodaniem). */
export function ruleImpact(expenses: Expense[], rule: CategoryRule): number {
  let n = 0;
  for (const e of expenses) if (applyCategoryRules(e, [rule])) n++;
  return n;
}

/** Wszystkie wydatki po zastosowaniu reguł + liczba zmienionych (updatedAt podbite → sync). */
export function applyRulesToAll(expenses: Expense[], rules: CategoryRule[], nowIso: string): { expenses: Expense[]; changed: number } {
  let changed = 0;
  const out = expenses.map((e) => {
    const n = applyCategoryRules(e, rules);
    if (!n) return e;
    changed++;
    return { ...n, updatedAt: nowIso };
  });
  return { expenses: changed ? out : expenses, changed };
}

/** Propozycja reguły z wydatku: sklep → jego kategoria (do "zawsze tak dla tego sklepu"). */
export function storeMatchOf(e: Pick<Expense, 'storeName' | 'note'>): string {
  const base = (e.storeName || e.note || '').trim();
  // Pierwsze 1–2 słowa, bez numerów placówek ("ORLEN Stacja nr 123" → "orlen stacja").
  return base.split(/\s+/).filter((w) => !/\d/.test(w)).slice(0, 2).join(' ').toLowerCase();
}
