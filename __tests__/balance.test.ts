import { affectsBalance, accountBalance } from '@/utils/balance';
import type { Expense } from '@/types/finances';

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', type: 'expense', amount: 10, date: '2026-11-01', note: '', tags: [],
  source: 'manual', createdAt: '', updatedAt: '', ...o,
});

describe('balance — affectsBalance', () => {
  test('domyślnie (payer nieustawiony, karta) → liczy się do salda', () => {
    expect(affectsBalance(e({}))).toBe(true);
  });
  test('gotówka (niezależnie kto płacił) → NIE liczy się do salda', () => {
    expect(affectsBalance(e({ paymentMethod: 'cash' }))).toBe(false);
  });
  test('zapłacone przez partnera, nawet kartą → NIE liczy się do salda', () => {
    expect(affectsBalance(e({ payer: 'partner', paymentMethod: 'card' }))).toBe(false);
  });
  test('BLIK/przelew przez "ja" → liczy się do salda', () => {
    expect(affectsBalance(e({ paymentMethod: 'blik' }))).toBe(true);
    expect(affectsBalance(e({ paymentMethod: 'transfer' }))).toBe(true);
  });
});

describe('balance — accountBalance', () => {
  test('offset + wydatki kartą odliczone, gotówka i partner zignorowani', () => {
    const expenses: Expense[] = [
      e({ type: 'expense', amount: 50, paymentMethod: 'card' }),
      e({ type: 'income', amount: 100, paymentMethod: 'card' }),
      e({ type: 'expense', amount: 999, paymentMethod: 'cash' }),
      e({ type: 'expense', amount: 500, payer: 'partner', paymentMethod: 'card' }),
    ];
    expect(accountBalance(expenses, 1000)).toBe(1000 - 50 + 100);
  });
});
