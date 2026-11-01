import { computeWydatkiData } from '@/utils/wydatkiData';
import type { Expense, ReceiptItem } from '@/types/finances';

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', type: 'expense', amount: 0, date: '2026-08-04', note: '', tags: [],
  source: 'manual', createdAt: '', updatedAt: '', ...o,
});

const item = (o: Partial<ReceiptItem>): ReceiptItem => ({
  name: 'x', price: 0, quantity: 1, unitPrice: 0, ...o,
});

describe('wydatkiData — computeWydatkiData', () => {
  test('rozdziela stałe/zmienne/jedzenie na ten i poprzedni miesiąc', () => {
    const today = new Date(2026, 7, 15); // sierpień 2026
    const exps = [
      e({ id: '1', note: 'Czynsz', amount: 1000, date: '2026-08-03' }),
      e({ id: '2', note: 'Czynsz', amount: 950, date: '2026-07-03' }),
      e({
        id: '3', note: 'Biedronka', amount: 200, date: '2026-08-04',
        receiptItems: [item({ name: 'Chleb', price: 200, foodSubcat: 'pieczywo' })],
      }),
      e({ id: '4', note: 'Kino', amount: 60, date: '2026-08-10' }),
    ];
    const data = computeWydatkiData(exps, today);

    expect(data.month).toBe('Sierpień');
    expect(data.fixed.total).toBe('1000 zł');
    expect(data.fixed.previousTotal).toBe('950 zł');
    expect(data.fixed.items).toEqual([{ label: 'Czynsz', amount: 1000 }]);
    expect(data.food.total).toBe('200 zł');
    expect(data.food.categories).toEqual([{ label: 'Pieczywo', amount: 200, color: expect.any(String) }]);
    expect(data.variable.total).toBe('60 zł');
    expect(data.variable.top).toEqual([{ label: 'Kino', amount: 60 }]);
  });

  test('pusty miesiąc nie wywala się, zwraca zera/puste listy', () => {
    const today = new Date(2026, 7, 15);
    const data = computeWydatkiData([], today);
    expect(data.fixed.total).toBe('0 zł');
    expect(data.fixed.items).toEqual([]);
    expect(data.food.categories).toEqual([]);
    expect(data.variable.top).toEqual([]);
    expect(data.fixed.changePercent).toBe(0);
  });
});
