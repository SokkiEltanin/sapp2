import { amountInScope, spentInMonth, budgetStatus, budgetStatuses, budgetHistory, suggestLimit, newBudgetAlerts, scopeLabel } from '@/utils/budgets';
import type { Expense } from '@/types/finances';
import type { Budget } from '@/types/budgets';

const e = (id: string, date: string, amount: number, extra: Partial<Expense> = {}): Expense => ({
  id, type: 'expense', amount, date, note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', ...extra,
} as unknown as Expense);
const B = (scope: Budget['scope'], limit: number, id = 'b1'): Budget => ({ id, scope, limit, createdAt: '', updatedAt: '' });
const NOW = new Date(2026, 10, 15, 12); // 15.11.2026, 30 dni

const food = (id: string, date: string, amount: number) => e(id, date, amount, { receiptItems: [{ name: 'Chleb', price: amount, quantity: 1, unitPrice: amount, foodSubcat: 'pieczywo' }] } as any);
const expenses = [
  food('f1', '2026-11-02', 300),
  e('v1', '2026-11-05', 200, { expenseCategory: 'rozrywka', fvOverride: 'variable' } as any),
  e('v2', '2026-11-06', 100, { fvOverride: 'variable' } as any),
  e('fx', '2026-11-01', 1500, { fvOverride: 'fixed' } as any),
  e('tr', '2026-11-03', 999, { fvOverride: 'transfer' } as any),
  e('inc', '2026-11-04', 5000, { type: 'income' } as any),
  food('old', '2026-10-10', 900),
  food('old2', '2026-09-10', 700),
];

describe('budżety', () => {
  test('zakresy = kubły z Podziału', () => {
    expect(amountInScope(expenses[0], 'food')).toBe(300);
    expect(amountInScope(expenses[1], 'cat:rozrywka')).toBe(200);
    expect(amountInScope(expenses[2], 'cat:rozrywka')).toBe(0);
    expect(spentInMonth(expenses, 'all', '2026-11')).toBe(2100); // bez przelewu własnego i przychodu
    expect(spentInMonth(expenses, 'variable', '2026-11')).toBe(300);
    expect(scopeLabel('cat:rozrywka')).toBe('Rozrywka');
  });
  test('status: zostało, dziennie, tempo, poziom', () => {
    const s = budgetStatus(B('food', 1000), expenses, NOW);
    expect(s.spent).toBe(300);
    expect(s.left).toBe(700);
    expect(s.daysLeft).toBe(16);
    expect(s.perDay).toBe(43);
    expect(s.level).toBe('ok');
    expect(budgetStatus(B('food', 350), expenses, NOW).level).toBe('warn');
    expect(budgetStatus(B('food', 300), expenses, NOW).level).toBe('over');
    expect(budgetStatus(B('food', 500), expenses, NOW).level).toBe('pace'); // 300 w połowie → ~600 na koniec
    expect(budgetStatus(B('food', 300), expenses, NOW).perDay).toBe(0);
  });
  test('kolejność: najpierw przekroczone', () => {
    const st = budgetStatuses([B('food', 5000, 'a'), B('food', 200, 'b')], expenses, NOW);
    expect(st.map((x) => x.budget.id)).toEqual(['b', 'a']);
  });
  test('historia i podpowiedź limitu', () => {
    const h = budgetHistory(B('food', 800), expenses, 3, NOW);
    expect(h.map((m) => [m.key, m.spent, m.within])).toEqual([['2026-08', 0, true], ['2026-09', 700, true], ['2026-10', 900, false]]);
    expect(suggestLimit(expenses, 'food', NOW)).toBe(800); // (900+700)/2 → w górę do 50
    expect(suggestLimit(expenses, 'cat:zdrowie', NOW)).toBeNull();
  });
  test('powiadomienia: raz na próg w miesiącu', () => {
    const st = budgetStatuses([B('food', 350)], expenses, NOW);
    const a = newBudgetAlerts(st, {}, NOW);
    expect(a).toHaveLength(1);
    expect(a[0].level).toBe('warn');
    expect(newBudgetAlerts(st, { b1: { month: '2026-11', level: 'warn' } }, NOW)).toEqual([]);
    expect(newBudgetAlerts(st, { b1: { month: '2026-10', level: 'over' } }, NOW)).toHaveLength(1);
    const over = budgetStatuses([B('food', 300)], expenses, NOW);
    expect(newBudgetAlerts(over, { b1: { month: '2026-11', level: 'warn' } }, NOW)[0].level).toBe('over');
  });
});
