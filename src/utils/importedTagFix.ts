import type { Expense, ReceiptItem } from '@/types/finances';

// Sprzątanie tagów pozycji zaimportowanych ze starej appki (2026-11-16, user: "tak,
// wtedy zrób to"). Import brał pierwszy tag pozycji jako `foodSubcat`, więc w Jedzeniu
// lądowały (1) duplikaty kategorii ("czekolada" obok "Słodycze") i (2) rzeczy, które
// nie są jedzeniem ("chemia", "leki"…) — zawyżały Jedzenie i budżety. Duplikaty →
// właściwa kategoria jedzenia; niejedzeniowe → Zmienne (`nonFoodCategory`, null = bez
// kategorii). Idempotentne — uruchamiane przy starcie i w imporcie (dataImportFromSapp).
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.\s*/g, '. ').trim();

export const FOOD_ALIASES: Record<string, string> = {
  czekolada: 'słodycze', 'miętówki': 'słodycze', makaron: 'makarony', jaja: 'jajka',
  herbata: 'herbaty i napary', sypkie: 'mąka i produkty sypkie', 'płatki': 'mąka i produkty sypkie',
  orzechy: 'przekąski',
};
export const NON_FOOD: Record<string, string | null> = {
  chemia: 'chemia', elektronika: 'elektronika', higiena: 'higiena', spf: 'higiena', leki: 'zdrowie',
  'łyżka-do-butów': 'dom', 'nie jedzenie': null, 'art. biurowe': null,
};

export function fixItemTag(it: ReceiptItem): ReceiptItem | null {
  if (!it.foodSubcat) return null;
  const k = key(it.foodSubcat);
  if (k in FOOD_ALIASES) return FOOD_ALIASES[k] === it.foodSubcat ? null : { ...it, foodSubcat: FOOD_ALIASES[k] };
  if (k in NON_FOOD) {
    const cat = NON_FOOD[k];
    const { foodSubcat: _drop, ...rest } = it;
    return cat ? { ...rest, nonFoodCategory: cat } : { ...rest };
  }
  return null;
}

export function fixImportedTags(expenses: Expense[], nowIso = new Date().toISOString()): { expenses: Expense[]; changed: number } {
  let changed = 0;
  const out = expenses.map((e) => {
    if (!e.receiptItems?.length) return e;
    let touched = false;
    const items = e.receiptItems.map((it) => { const f = fixItemTag(it); if (f) { touched = true; return f; } return it; });
    if (!touched) return e;
    changed++;
    return { ...e, receiptItems: items, updatedAt: nowIso };
  });
  return { expenses: changed ? out : expenses, changed };
}
