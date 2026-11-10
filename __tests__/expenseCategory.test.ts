import { expenseCategoryByCategory, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_META } from '@/utils/expenseCategory';
import type { Expense } from '@/types/finances';

// 2026-11-10, user: "zróbmy to drugie, właśnie to nie jedzenie, i tam też
// zróbmy podział na kategorie... żeby były na przykład rozrywka i tak
// dalej" — kategoria CAŁEGO wydatku (bilet do kina, Uber — bez pozycji
// paragonu), RÓWNOLEGŁA do `food.ts`/`nonFood.ts`, ale grupuje po
// `Expense.expenseCategory`, nie po pozycji. Ten sam wzorzec testów co
// `nonFood.test.ts`.
const e = (o: Partial<Expense>): Expense => ({
  id: 'x', type: 'expense', amount: 0, date: '2026-08-04', note: '', tags: [],
  source: 'manual', createdAt: '', updatedAt: '', ...o,
});

describe('expenseCategory — EXPENSE_CATEGORIES / EXPENSE_CATEGORY_META', () => {
  test('zawiera Rozrywkę/Transport/Zdrowie/Ubrania/Dom, każdą z etykietą i kolorem', () => {
    const tags = EXPENSE_CATEGORIES.map((s) => s.tag);
    expect(tags).toEqual(['rozrywka', 'transport', 'zdrowie', 'ubrania', 'dom']);
    for (const tag of tags) {
      expect(EXPENSE_CATEGORY_META[tag]).toEqual({ label: expect.any(String), color: expect.any(String) });
    }
  });
});

describe('expenseCategory — expenseCategoryByCategory', () => {
  test('grupuje CAŁE wydatki po expenseCategory, sumuje kwoty', () => {
    const exps = [
      e({ id: '1', note: 'Kino', date: '2026-08-05', amount: 40, expenseCategory: 'rozrywka' }),
      e({ id: '2', note: 'Netflix', date: '2026-08-10', amount: 30, expenseCategory: 'rozrywka' }),
      e({ id: '3', note: 'Uber', date: '2026-08-06', amount: 25, expenseCategory: 'transport' }),
    ];
    const out = expenseCategoryByCategory(exps);
    expect(out).toEqual([
      { label: 'Rozrywka', amount: 70, color: EXPENSE_CATEGORY_META.rozrywka.color, items: expect.any(Array) },
      { label: 'Transport', amount: 25, color: EXPENSE_CATEGORY_META.transport.color, items: expect.any(Array) },
    ]);
  });

  test('liczy WKŁAD do Zmiennych (fvSplitOf.variable), nie gołą kwotę — pomija Stałe/przelew własny', () => {
    const exps = [
      e({ id: '1', note: 'Siłownia (abonament)', amount: 100, expenseCategory: 'zdrowie', fvOverride: 'fixed' }),
      e({ id: '2', note: 'Przelew do siebie', amount: 500, expenseCategory: 'dom', fvOverride: 'transfer' }),
      e({ id: '3', note: 'Wizyta u lekarza', amount: 150, expenseCategory: 'zdrowie' }),
    ];
    expect(expenseCategoryByCategory(exps)).toEqual([
      { label: 'Zdrowie', amount: 150, color: EXPENSE_CATEGORY_META.zdrowie.color, items: expect.any(Array) },
    ]);
  });

  test('pomija wydatki bez expenseCategory i przychody', () => {
    const exps = [
      e({ id: '1', amount: 40 }),
      e({ id: '2', type: 'income', amount: 40, expenseCategory: 'rozrywka' }),
    ];
    expect(expenseCategoryByCategory(exps)).toEqual([]);
  });

  test('zawęża do jednego miesiąca gdy podane monthFilterKey', () => {
    const exps = [
      e({ id: '1', date: '2026-08-05', amount: 40, expenseCategory: 'rozrywka' }),
      e({ id: '2', date: '2026-07-05', amount: 20, expenseCategory: 'rozrywka' }),
    ];
    const out = expenseCategoryByCategory(exps, '2026-08');
    expect(out).toEqual([{ label: 'Rozrywka', amount: 40, color: EXPENSE_CATEGORY_META.rozrywka.color, items: expect.any(Array) }]);
  });

  test('items zawiera expenseId/date/name/price/quantity:1, posortowane najnowsze/najdroższe pierwsze', () => {
    const exps = [
      e({ id: '1', date: '2026-08-05', storeName: 'CinemaCity', note: '', amount: 40, expenseCategory: 'rozrywka' }),
      e({ id: '2', date: '2026-08-12', note: 'Netflix', amount: 30, expenseCategory: 'rozrywka' }),
    ];
    const out = expenseCategoryByCategory(exps);
    expect(out[0].items).toEqual([
      { expenseId: '2', date: '2026-08-12', storeName: undefined, name: 'Netflix', price: 30, quantity: 1 },
      { expenseId: '1', date: '2026-08-05', storeName: 'CinemaCity', name: 'CinemaCity', price: 40, quantity: 1 },
    ]);
  });

  test('pusta lista wejściowa → pusty wynik', () => {
    expect(expenseCategoryByCategory([])).toEqual([]);
  });
});
