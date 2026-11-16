import { monthPace, windowSum, yearPace, monthlySeries, seasonCompare } from '@/utils/monthPace';
import type { Expense } from '@/types/finances';

const E = (date: string, amount: number, extra: Partial<Expense> = {}): Expense => ({ id: date + amount, type: 'expense', amount, date, note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', fvOverride: 'variable', ...extra } as unknown as Expense);
const sweets = (date: string, price: number) => E(date, price, { fvOverride: undefined, receiptItems: [{ name: 'Czekolada', price, quantity: 1, unitPrice: price, foodSubcat: 'słodycze' }] } as any);
const NOW = new Date(2026, 10, 16, 12);

describe('postęp miesiąca do dziś', () => {
  const ex = [
    E('2026-11-03', 100), E('2026-11-15', 50), E('2026-11-20', 999), // listopad: 150 do 16.
    E('2026-10-05', 100), E('2026-10-25', 500),                     // paź: 100 do 16.
    E('2026-09-10', 200),                                             // wrz: 200
    // sierpień bez danych → pominięty, nie zaniża średniej
  ];
  test('to samo okno dni, średnia z miesięcy z danymi', () => {
    const p = monthPace(ex, 'all', NOW);
    expect(p.current).toBe(150);
    expect(p.months.map((m) => [m.label, m.value])).toEqual([['wrz', 200], ['paź', 100]]);
    expect(p.avg).toBe(150);
    expect(p.delta).toBe(0);
  });
  test('krótszy miesiąc liczy się do końca', () => {
    expect(windowSum([E('2026-02-28', 10)], 'all', 2026, 1, 31)).toBe(10);
  });
  test('słodycze i prąd', () => {
    const s = [sweets('2026-11-02', 12.5), sweets('2026-10-02', 25), E('2026-10-01', 1, { fvOverride: undefined } as any)];
    expect(monthPace(s, 'food:słodycze', NOW).delta).toBe(-50);
    const bills = [E('2026-01-10', 300, { fvOverride: 'fixed', storeName: 'PGE Obrót', note: 'prąd' } as any), E('2026-07-10', 150, { fvOverride: 'fixed', storeName: 'PGE Obrót', note: 'prąd' } as any)];
    const series = monthlySeries(bills, 'fixed:prąd', 12, NOW);
    expect(series).toHaveLength(12);
    const sc = seasonCompare(series);
    expect(sc).toEqual({ winter: 300, summer: 150, delta: 100 });
  });
  test('rok do dziś vs rok temu', () => {
    const y = yearPace([E('2026-03-01', 100), E('2025-03-01', 80), E('2025-12-01', 500)], 'all', NOW);
    expect(y).toEqual({ current: 100, last: 80, delta: 25 });
    expect(yearPace([E('2026-03-01', 100)], 'all', NOW).last).toBeNull();
  });
});
