import { buildExpenseTable, heat } from '@/utils/expenseTable';
import type { Expense } from '@/types/finances';

const E = (date: string, amount: number, extra: Partial<Expense> = {}): Expense => ({ id: date + amount + Math.random(), type: 'expense', amount, date, note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', ...extra } as unknown as Expense);
const NOW = new Date(2026, 10, 16);

describe('tabela wydatków', () => {
  const ex = [
    E('2026-11-02', 30, { receiptItems: [{ name: 'Czekolada', price: 12.5, quantity: 1, unitPrice: 12.5, foodSubcat: 'słodycze' }, { name: 'Chleb', price: 17.5, quantity: 1, unitPrice: 17.5, foodSubcat: 'pieczywo' }] } as any),
    E('2026-10-10', 300, { storeName: 'PGE', note: 'prąd' } as any),
    E('2026-10-12', 100, { fvOverride: 'variable', expenseCategory: 'rozrywka' } as any),
    E('2026-10-01', 5000, { type: 'income' } as any),
  ];
  const t = buildExpenseTable(ex, 3, NOW);
  test('kolumny = miesiące, bieżący ostatni', () => {
    expect(t.months.map((m) => m.label)).toEqual(['wrz 26', 'paź 26', 'lis 26']);
  });
  test('grupy z podkategoriami i sumy', () => {
    const food = t.groups.find((g) => g.key === 'food')!;
    expect(food.values).toEqual([0, 0, 30]);
    expect(food.rows.map((r) => r.label)).toEqual(['Pieczywo', 'Słodycze']);
    const fixed = t.groups.find((g) => g.key === 'fixed')!;
    expect(fixed.rows[0].label).toBe('Prąd');
    expect(t.total.values).toEqual([0, 400, 30]);
    expect(t.balance.values[1]).toBe(4600);
  });
  test('średnia z pełnych miesięcy z wydatkami, heat', () => {
    expect(t.total.avg).toBe(400);
    expect(heat(50, 100)).toBe(0.5);
    expect(heat(0, 100)).toBe(0);
  });
});

describe('średnia z zerami (zapasy kupione w przód)', () => {
  const sweets = (date: string, price: number) => E(date, price, { receiptItems: [{ name: 'Czekolada', price, quantity: 1, unitPrice: price, foodSubcat: 'słodycze' }] } as any);
  test('miesiąc bez zakupów liczy się jako 0, miesiące przed danymi nie', () => {
    const t = buildExpenseTable([sweets('2026-08-05', 90), sweets('2026-10-05', 30), sweets('2026-11-05', 999)], 6, NOW);
    const s = t.groups.find((g) => g.key === 'food')!.rows.find((r) => r.label === 'Słodycze')!;
    expect(s.values).toEqual([0, 0, 90, 0, 30, 999]);
    expect(s.avg).toBe(40); // (90 + 0 + 30) / 3 — czerwiec, lipiec pominięte, listopad niepełny
  });
});
