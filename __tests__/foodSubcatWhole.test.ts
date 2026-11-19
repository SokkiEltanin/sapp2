import { foodSplitOf, foodByCategory } from '@/utils/foodStats';
import { guessMealSubcat } from '@/utils/food';
import { reassignCategory, categoryUsage } from '@/utils/categoryRegistry';

const E = (x: any) => ({ id: 'e1', type: 'expense', amount: 30, date: '2026-11-18', note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', ...x });

describe('rodzaj jedzenia całego wydatku', () => {
  it('Jedzenie bez paragonu → wybrany rodzaj zamiast „inne”', () => {
    const e = E({ storeName: 'Dobre Precle WARSZAWA', fvOverride: 'food', foodSubcat: 'fast food' });
    expect([...foodSplitOf(e as any)]).toEqual([['fast food', 30]]);
    expect(foodByCategory([e as any]).map((b) => b.label)).toEqual(['Fast food i na mieście']);
  });
  it('bez wyboru dalej „inne”; nieznany klucz → „inne”', () => {
    expect([...foodSplitOf(E({ fvOverride: 'food' }) as any)]).toEqual([['inne', 30]]);
    expect([...foodSplitOf(E({ fvOverride: 'food', foodSubcat: 'xyz' }) as any)]).toEqual([['inne', 30]]);
  });
  it('pozycje paragonu mają pierwszeństwo, reszta → rodzaj całego wydatku', () => {
    const e = E({ amount: 50, fvOverride: 'food', foodSubcat: 'dania gotowe', receiptItems: [{ name: 'Cola', price: 10, quantity: 1, unitPrice: 10, foodSubcat: 'napoje' }] });
    expect(Object.fromEntries(foodSplitOf(e as any))).toEqual({ napoje: 10, 'dania gotowe': 40 });
  });
  it('podpowiedź z nazwy', () => {
    expect(guessMealSubcat('Dobre Precle WARSZAWA')).toBe('fast food');
    expect(guessMealSubcat('Kebab u Aliego')).toBe('fast food');
    expect(guessMealSubcat('Lidl')).toBeUndefined();
  });
  it('zmiana nazwy / usunięcie kategorii jedzenia obejmuje też cały wydatek', () => {
    const list = [E({ foodSubcat: 'fast food' })] as any;
    expect(categoryUsage(list, 'food', 'fast food')).toBe(1);
    expect(reassignCategory(list, 'food', 'fast food', 'dania gotowe').expenses[0].foodSubcat).toBe('dania gotowe');
  });
});

describe('stare wydatki bez wybranego rodzaju', () => {
  it('nazwa wskazuje jedzenie na mieście → fast food', () => {
    const e = { id: 'x', type: 'expense', amount: 20, date: '2026-11-01', note: '', tags: [], storeName: 'KEBAB KING', fvOverride: 'food', createdAt: '', updatedAt: '' };
    expect([...foodSplitOf(e as any)]).toEqual([['fast food', 20]]);
  });
});
