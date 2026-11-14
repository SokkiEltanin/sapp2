import { trendSeries, trendStats, lastMonthKeys, monthShort } from '@/utils/trend';
import type { Expense } from '@/types/finances';

const E = (x: Partial<Expense>): Expense =>
  ({ id: Math.random().toString(), type: 'expense', amount: 0, date: '2026-11-10', note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', ...x } as Expense);
const now = new Date(2026, 10, 14);

describe('trend 12 miesięcy', () => {
  it('klucze miesięcy przez przełom roku', () => {
    expect(lastMonthKeys(3, new Date(2026, 0, 5))).toEqual(['2025-11', '2025-12', '2026-01']);
    expect(monthShort('2026-03')).toBe('mar');
  });

  it('serie koszyków i kategorii z jednego przebiegu', () => {
    const { months, series } = trendSeries([
      E({ amount: 60, date: '2026-11-02', storeName: 'Lidl', receiptItems: [
        { name: 'Ser', price: 20, quantity: 1, unitPrice: 20, foodSubcat: 'nabiał' },
        { name: 'Kabel', price: 40, quantity: 1, unitPrice: 40, nonFoodCategory: 'elektronika' },
      ] as any }),
      E({ amount: 100, date: '2026-10-05', expenseCategory: 'rozrywka', fvOverride: 'variable' }),
      E({ amount: 30, date: '2026-10-06', fvOverride: 'food' }),
      E({ amount: 999, date: '2025-01-01', fvOverride: 'variable' }), // poza zakresem
      E({ type: 'income', amount: 5000, date: '2026-11-01' }),
    ], 12, now);
    expect(months).toHaveLength(12);
    expect(months[11]).toBe('2026-11');
    expect(series.get('all')!.slice(-2)).toEqual([130, 60]);
    expect(series.get('food')!.slice(-2)).toEqual([30, 20]);
    expect(series.get('food:nabiał')![11]).toBe(20);
    expect(series.get('food:inne')![10]).toBe(30);
    expect(series.get('cat:elektronika')![11]).toBe(40);
    expect(series.get('cat:rozrywka')![10]).toBe(100);
  });

  it('statystyki: średnia bez bieżącego miesiąca i pustych', () => {
    const st = trendStats([0, 0, 100, 200, 0, 300, 150]);
    expect(st.avg).toBe(200);
    expect(st.current).toBe(150);
    expect(st.delta).toBe(-25);
    expect(st.max).toEqual({ i: 5, v: 300 });
    expect(trendStats([0, 0, 50]).delta).toBeNull();
  });
});
