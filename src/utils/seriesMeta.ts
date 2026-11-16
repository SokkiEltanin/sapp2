import { FOOD_SUBCAT_META } from './food';
import { FIXED_CAT_META, FIXED_OTHER } from './fixedCategory';
import { EXPENSE_CATEGORY_META, UNCATEGORIZED } from './expenseCategory';
import { INCOME_META } from './incomeCategory';

// Nazwa i kolor serii z utils/trend.ts (food:<tag> | fixed:<tag> | cat:<tag> | inc:<tag>)
// — wspólne dla Trendu i Tabeli wydatków.
export function seriesMeta(key: string): { label: string; color: string } {
  const i = key.indexOf(':');
  const p = key.slice(0, i), tag = key.slice(i + 1);
  if (p === 'food') return tag === 'inne' ? { label: 'Inne jedzenie', color: '#8A8A8A' } : FOOD_SUBCAT_META[tag] ?? { label: tag, color: '#8A8A8A' };
  if (p === 'inc') return INCOME_META[tag] ?? { label: tag, color: '#8A8A8A' };
  if (p === 'fixed') return tag === FIXED_OTHER ? { label: 'Inne stałe', color: '#5A5A5A' } : FIXED_CAT_META[tag] ?? { label: tag, color: '#8A8A8A' };
  return tag === UNCATEGORIZED ? { label: 'Bez kategorii', color: '#5A5A5A' } : EXPENSE_CATEGORY_META[tag] ?? { label: tag, color: '#8A8A8A' };
}
