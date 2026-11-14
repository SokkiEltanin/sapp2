import { foodByCategory } from '@/utils/foodStats';
import type { Expense } from '@/types/finances';

const E = (x: Partial<Expense>): Expense =>
  ({ id: 'e', type: 'expense', amount: 0, date: '2026-11-10', note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', ...x } as Expense);
const item = (name: string, price: number, extra: any = {}) => ({ name, price, quantity: 1, unitPrice: price, ...extra });

describe('jedzenie po kategoriach = kwota jedzenia z Podziału', () => {
  it('"Rozlicz jako: Jedzenie" bez pozycji → Inne jedzenie (wcześniej znikało)', () => {
    const r = foodByCategory([E({ amount: 45, note: 'Obiad na mieście', fvOverride: 'food' })], '2026-11');
    expect(r).toEqual([expect.objectContaining({ label: 'Inne jedzenie', amount: 45 })]);
    expect(r[0].items[0].name).toBe('Obiad na mieście');
  });

  it('pozycje + reszta wydatku oznaczonego jako jedzenie', () => {
    const r = foodByCategory([E({ amount: 50, fvOverride: 'food', receiptItems: [item('Ser', 20, { foodSubcat: 'nabiał' })] as any })], '2026-11');
    expect(Object.fromEntries(r.map((c) => [c.label, c.amount]))).toEqual({ 'Inne jedzenie': 30, Nabiał: 20 });
  });

  it('wydatek przeniesiony do Stałych nie liczy pozycji jako jedzenia', () => {
    expect(foodByCategory([E({ amount: 20, fvOverride: 'fixed', receiptItems: [item('Ser', 20, { foodSubcat: 'nabiał' })] as any })], '2026-11')).toEqual([]);
  });

  it('zwykły paragon bez zmian', () => {
    const r = foodByCategory([E({ amount: 60, receiptItems: [item('Ser', 20, { foodSubcat: 'nabiał' }), item('Kabel', 40)] as any })], '2026-11');
    expect(r.map((c) => [c.label, c.amount])).toEqual([['Nabiał', 20]]);
  });
});
