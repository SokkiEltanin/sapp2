import { applyCategoryPrefs, resolveCategories, categoryUsage, reassignCategory, newTag, EMPTY_CATEGORY_PREFS } from '@/utils/categoryRegistry';
import { FOOD_SUBCATS, FOOD_SUBCAT_META } from '@/utils/food';
import { NON_FOOD_SUBCATS, NON_FOOD_SUBCAT_META } from '@/utils/nonFood';
import { EXPENSE_CATEGORIES } from '@/utils/expenseCategory';

afterEach(() => applyCategoryPrefs(EMPTY_CATEGORY_PREFS));

describe('edytowalne kategorie', () => {
  test('zmiana nazwy/koloru = tylko etykieta (tag bez zmian)', () => {
    applyCategoryPrefs({ added: { food: [], var: [] }, overrides: { 'var:części': { label: 'Auto', color: '#000000' } } });
    expect(NON_FOOD_SUBCAT_META['części']).toEqual({ label: 'Auto', color: '#000000' });
    expect(EXPENSE_CATEGORIES.find((c) => c.tag === 'części')?.label).toBe('Auto'); // alias tej samej listy
  });
  test('ukryta: znika z wyboru, etykieta zostaje dla starych danych', () => {
    applyCategoryPrefs({ added: { food: [], var: [] }, overrides: { 'food:ryby': { hidden: true } } });
    expect(FOOD_SUBCATS.some((c) => c.tag === 'ryby')).toBe(false);
    expect(FOOD_SUBCAT_META['ryby'].label).toBe('Ryby');
    expect(FOOD_SUBCAT_META['inne']).toBeDefined();
  });
  test('nowa kategoria i unikalny tag', () => {
    const prefs = { added: { food: [], var: [{ tag: 'sport', label: 'Sport', color: '#fff' }] }, overrides: {} };
    applyCategoryPrefs(prefs);
    expect(NON_FOOD_SUBCATS.some((c) => c.tag === 'sport')).toBe(true);
    expect(resolveCategories(prefs, 'var').find((c) => c.tag === 'sport')?.custom).toBe(true);
    expect(newTag('Dom', ['dom'])).toBe('dom 2');
  });
  test('użycia i przeniesienie (pozycje + wydatek)', () => {
    const ex = [
      { id: 'a', type: 'expense', amount: 50, date: '2026-11-01', note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', expenseCategory: 'dom',
        receiptItems: [{ name: 'X', price: 5, quantity: 1, unitPrice: 5, nonFoodCategory: 'dom' }, { name: 'Ser', price: 5, quantity: 1, unitPrice: 5, foodSubcat: 'nabiał' }] },
      { id: 'b', type: 'expense', amount: 5, date: '2026-11-01', note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    ] as any;
    expect(categoryUsage(ex, 'var', 'dom')).toBe(2);
    const r = reassignCategory(ex, 'var', 'dom', 'hobby', 'T');
    expect(r.changed).toBe(1);
    expect(r.expenses[0].expenseCategory).toBe('hobby');
    expect(r.expenses[0].receiptItems![0].nonFoodCategory).toBe('hobby');
    expect(r.expenses[0].updatedAt).toBe('T');
    expect(r.expenses[1]).toBe(ex[1]);
  });
});
