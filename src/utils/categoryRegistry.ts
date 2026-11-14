import { FOOD_SUBCATS, FOOD_SUBCAT_META, FOOD_ITEM_TAGS } from './food';
import { NON_FOOD_SUBCATS, NON_FOOD_SUBCAT_META, NON_FOOD_ITEM_TAGS } from './nonFood';
import type { Expense } from '@/types/finances';

// Edytowalne kategorie (2026-11-14, user: "w ustawieniach edytować nazwy istniejących
// kategorii lub usuwać/dodać — czy nie będzie kolizji danych, jak coś już ma
// kategorię"). BEZ kolizji: dane (pozycje paragonu, wydatki) trzymają TAG, nie
// nazwę — zmiana nazwy/koloru zmienia tylko to, co widać. "Usuń" = ukryj z wyboru
// (stare dane dalej mają poprawną etykietę) + opcjonalnie przenieś istniejące
// użycia do innej kategorii (`reassignCategory`). Nowa kategoria = nowy tag.
//
// Listy/słowniki z food.ts / nonFood.ts są modyfikowane W MIEJSCU (te same obiekty
// czytają statystyki, pickery i parser) — `applyCategoryPrefs` odtwarza je z
// domyślnych + preferencji przy starcie i każdej zmianie (store/categoriesStore.ts).

export type CatKind = 'food' | 'var';
export interface Cat { tag: string; label: string; color: string }
export interface CatOverride { label?: string; color?: string; hidden?: boolean }
export interface CategoryPrefs { added: Record<CatKind, Cat[]>; overrides: Record<string, CatOverride> }
export const EMPTY_CATEGORY_PREFS: CategoryPrefs = { added: { food: [], var: [] }, overrides: {} };

const DEFAULTS: Record<CatKind, Cat[]> = {
  food: FOOD_SUBCATS.map((c) => ({ ...c })),
  var: NON_FOOD_SUBCATS.map((c) => ({ ...c })),
};
const FOOD_EXTRA_META = { inne: { label: 'Inne jedzenie', color: '#9CA3AF' } };

export const okey = (kind: CatKind, tag: string) => `${kind}:${tag}`;

export interface ResolvedCat extends Cat { hidden: boolean; custom: boolean; defaultLabel?: string }
export function resolveCategories(prefs: CategoryPrefs, kind: CatKind): ResolvedCat[] {
  const base = [
    ...DEFAULTS[kind].map((c) => ({ ...c, custom: false, defaultLabel: c.label })),
    ...(prefs.added[kind] ?? []).map((c) => ({ ...c, custom: true })),
  ];
  return base.map((c) => {
    const o = prefs.overrides[okey(kind, c.tag)] ?? {};
    return { ...c, label: o.label?.trim() || c.label, color: o.color || c.color, hidden: !!o.hidden };
  });
}

function refill<T>(arr: T[], items: T[]) { arr.splice(0, arr.length, ...items); }
function refillMap(map: Record<string, { label: string; color: string }>, entries: [string, { label: string; color: string }][]) {
  for (const k of Object.keys(map)) delete map[k];
  for (const [k, v] of entries) map[k] = v;
}

export function applyCategoryPrefs(prefs: CategoryPrefs): void {
  const food = resolveCategories(prefs, 'food');
  const vars = resolveCategories(prefs, 'var');
  const vis = (l: ResolvedCat[]) => l.filter((c) => !c.hidden).map(({ tag, label, color }) => ({ tag, label, color }));
  refill(FOOD_SUBCATS, vis(food));
  refill(FOOD_ITEM_TAGS, vis(food).map((c) => c.tag));
  refillMap(FOOD_SUBCAT_META, [...food.map((c) => [c.tag, { label: c.label, color: c.color }] as [string, Cat]), ...Object.entries(FOOD_EXTRA_META)]);
  refill(NON_FOOD_SUBCATS, vis(vars));
  refill(NON_FOOD_ITEM_TAGS, vis(vars).map((c) => c.tag));
  refillMap(NON_FOOD_SUBCAT_META, vars.map((c) => [c.tag, { label: c.label, color: c.color }]));
}

// Nowy tag z nazwy, unikalny w obrębie rodzaju.
export function newTag(label: string, taken: string[]): string {
  const base = label.toLowerCase().trim().replace(/\s+/g, ' ').slice(0, 30) || 'kategoria';
  let tag = base, i = 2;
  while (taken.includes(tag)) tag = `${base} ${i++}`;
  return tag;
}

// Ile razy kategoria jest użyta (pozycje paragonu + wydatki).
export function categoryUsage(expenses: Expense[], kind: CatKind, tag: string): number {
  let n = 0;
  for (const e of expenses) {
    if (kind === 'var' && e.expenseCategory === tag) n++;
    for (const it of e.receiptItems ?? []) {
      if (kind === 'food' ? it.foodSubcat === tag : it.nonFoodCategory === tag) n++;
    }
  }
  return n;
}

// Przeniesienie użyć kategorii `from` do `to` (undefined = bez kategorii). Zwraca
// nową listę wydatków (zmienione dostają updatedAt — synchronizacja) i liczbę zmian.
export function reassignCategory(expenses: Expense[], kind: CatKind, from: string, to: string | undefined, nowIso = new Date().toISOString()): { expenses: Expense[]; changed: number } {
  let changed = 0;
  const out = expenses.map((e) => {
    let touched = false;
    const items = e.receiptItems?.map((it) => {
      if (kind === 'food' && it.foodSubcat === from) { touched = true; return { ...it, foodSubcat: to }; }
      if (kind === 'var' && it.nonFoodCategory === from) { touched = true; return { ...it, nonFoodCategory: to }; }
      return it;
    });
    const catHit = kind === 'var' && e.expenseCategory === from;
    if (!touched && !catHit) return e;
    changed++;
    return { ...e, ...(items ? { receiptItems: items } : {}), ...(catHit ? { expenseCategory: to } : {}), updatedAt: nowIso };
  });
  return { expenses: out, changed };
}
