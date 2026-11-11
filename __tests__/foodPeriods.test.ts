import { foodByWeekOfMonth, foodByDayOfMonth } from '@/utils/foodStats';
import { computeWydatkiData } from '@/utils/wydatkiData';
import type { Expense } from '@/types/finances';

// 2026-11-11 — przełącznik Tygodnie/Dni/Miesiące w Jedzeniu + bug UTC (słupki
// tygodni pokazywały poprzedni miesiąc, bo klucz liczony z toISOString()).
const food = (id: string, date: string, amount: number): Expense => ({
  id, type: 'expense', amount, date, note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', fvOverride: 'food',
});
const exps = [food('o1', '2026-10-28', 500), food('n1', '2026-11-03', 20), food('n2', '2026-11-30', 7)];

describe('foodByWeekOfMonth — miesiąc z LOKALNEJ daty', () => {
  test('1 listopada 00:00 lokalnie → tygodnie listopada, nie października', () => {
    const weeks = foodByWeekOfMonth(exps, new Date(2026, 10, 1));
    expect(weeks.reduce((a, w) => a + w.value, 0)).toBe(27);
    expect(weeks[0].value).toBe(20);
  });
});

describe('foodByDayOfMonth', () => {
  test('słupek na każdy dzień miesiąca, suma per dzień', () => {
    const days = foodByDayOfMonth(exps, new Date(2026, 10, 1));
    expect(days).toHaveLength(30);
    expect(days[2]).toEqual({ label: '3', value: 20 });
    expect(days[29]).toEqual({ label: '30', value: 7 });
  });
});

describe('computeWydatkiData — food periods', () => {
  test('months: 6 miesięcy kończąc na oglądanym', () => {
    const d = computeWydatkiData(exps, new Date(2026, 10, 1));
    expect(d.food.months.map((m) => m.label)).toEqual(['Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis']);
    expect(d.food.months[4].value).toBe(500);
    expect(d.food.months[5].value).toBe(27);
  });
});
