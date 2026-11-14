import { nonFoodByCategory, NON_FOOD_SUBCATS, NON_FOOD_SUBCAT_META } from '@/utils/nonFood';
import type { Expense, ReceiptItem } from '@/types/finances';

// 2026-11-10, user: "daj możliwość dodania... higiena, bo chemia to chyba
// bardziej taka... kapsułki i tak dalej" — RÓWNOLEGŁY system do `food.ts`'s
// FOOD_SUBCATS dla pozycji paragonu, które NIE są jedzeniem. Ten sam wzorzec
// testów co `wydatkiData.test.ts`.
const e = (o: Partial<Expense>): Expense => ({
  id: 'x', type: 'expense', amount: 0, date: '2026-08-04', note: '', tags: [],
  source: 'manual', createdAt: '', updatedAt: '', ...o,
});
const item = (o: Partial<ReceiptItem>): ReceiptItem => ({
  name: 'x', price: 0, quantity: 1, unitPrice: 0, ...o,
});

describe('nonFood — NON_FOOD_SUBCATS / NON_FOOD_SUBCAT_META', () => {
  test('zawiera Higienę i Chemię, każdą z etykietą i kolorem', () => {
    const tags = NON_FOOD_SUBCATS.map((s) => s.tag);
    expect(tags).toEqual(expect.arrayContaining(['higiena', 'chemia']));
    expect(NON_FOOD_SUBCAT_META.higiena).toEqual({ label: 'Higiena', color: expect.any(String) });
    expect(NON_FOOD_SUBCAT_META.chemia).toEqual({ label: 'Chemia', color: expect.any(String) });
  });
});

describe('nonFood — nonFoodByCategory', () => {
  test('grupuje pozycje po nonFoodCategory, sumuje CENY POZYCJI (nie całych wydatków)', () => {
    const exps = [
      e({
        id: '1', note: 'Rossmann', date: '2026-08-05',
        receiptItems: [
          item({ name: 'Mydło', price: 12, nonFoodCategory: 'higiena' }),
          item({ name: 'Płyn do naczyń', price: 8, nonFoodCategory: 'chemia' }),
        ],
      }),
      e({
        id: '2', note: 'Biedronka', date: '2026-08-10',
        receiptItems: [item({ name: 'Szampon', price: 15, nonFoodCategory: 'higiena' })],
      }),
    ];
    const out = nonFoodByCategory(exps);
    expect(out).toEqual([
      { label: 'Higiena', amount: 27, color: NON_FOOD_SUBCAT_META.higiena.color, items: expect.any(Array) },
      { label: 'Chemia', amount: 8, color: NON_FOOD_SUBCAT_META.chemia.color, items: expect.any(Array) },
    ]);
  });

  test('pomija pozycje jedzeniowe (foodSubcat), wykluczone i kaucje', () => {
    const exps = [e({
      id: '1', date: '2026-08-05',
      receiptItems: [
        item({ name: 'Chleb', price: 5, foodSubcat: 'pieczywo' }),
        item({ name: 'Mydło', price: 12, nonFoodCategory: 'higiena', excluded: true }),
        item({ name: 'Butelka', price: 1, nonFoodCategory: 'higiena', kind: 'deposit' }),
      ],
    })];
    expect(nonFoodByCategory(exps)).toEqual([]);
  });

  test('zawęża do jednego miesiąca gdy podane monthFilterKey', () => {
    const exps = [
      e({ id: '1', date: '2026-08-05', receiptItems: [item({ name: 'Mydło', price: 12, nonFoodCategory: 'higiena' })] }),
      e({ id: '2', date: '2026-07-05', receiptItems: [item({ name: 'Mydło', price: 10, nonFoodCategory: 'higiena' })] }),
    ];
    const out = nonFoodByCategory(exps, '2026-08');
    expect(out).toEqual([{ label: 'Higiena', amount: 12, color: NON_FOOD_SUBCAT_META.higiena.color, items: expect.any(Array) }]);
  });

  test('items zawiera expenseId/date/name/price/quantity, posortowane najnowsze/najdroższe pierwsze', () => {
    const exps = [
      e({
        id: '1', date: '2026-08-05', storeName: 'Rossmann',
        receiptItems: [item({ name: 'Mydło', price: 12, quantity: 2, nonFoodCategory: 'higiena' })],
      }),
      e({
        id: '2', date: '2026-08-12',
        receiptItems: [item({ name: 'Szampon', price: 20, nonFoodCategory: 'higiena' })],
      }),
    ];
    const out = nonFoodByCategory(exps);
    expect(out[0].items).toEqual([
      { expenseId: '2', date: '2026-08-12', storeName: undefined, name: 'Szampon', price: 20, quantity: 1 },
      { expenseId: '1', date: '2026-08-05', storeName: 'Rossmann', name: 'Mydło', price: 12, quantity: 2 },
    ]);
  });

  test('brak nonFoodCategory wcale → pusta lista', () => {
    expect(nonFoodByCategory([e({ receiptItems: [item({ name: 'Chleb', price: 5, foodSubcat: 'pieczywo' })] })])).toEqual([]);
    expect(nonFoodByCategory([])).toEqual([]);
  });
});
