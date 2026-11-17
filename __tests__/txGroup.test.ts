import { groupTransactions, groupLabel, txDetail, txColor } from '@/utils/txGroup';

const NOW = new Date(2026, 10, 17, 12);
const E = (id: string, date: string, amount: number, extra: any = {}) => ({ id, type: 'expense', amount, date, note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', ...extra }) as any;

describe('grupowanie transakcji', () => {
  const hits = [
    E('a', '2026-11-17T12:00:00', 10), E('b', '2026-11-17', 5, { type: 'income' }), E('c', '2026-11-16', 20),
    E('d', '2026-11-10', 30), E('e', '2026-10-31', 40, { fvOverride: 'transfer' }),
  ].map((e) => ({ e }));
  it('dni: Dziś / Wczoraj, sumy bez przelewów własnych', () => {
    const g = groupTransactions(hits, 'day', NOW);
    expect(g.map((x) => x.label)).toEqual(['Dziś', 'Wczoraj', 'wtorek, 10 lis', 'sobota, 31 paź']);
    expect(g[0]).toMatchObject({ out: 10, in: 5 });
    expect(g[3]).toMatchObject({ out: 0, in: 0 });
  });
  it('tygodnie od poniedziałku, miesiące, lata', () => {
    expect(groupTransactions(hits, 'week', NOW).map((x) => x.label)).toEqual(['Ten tydzień', '9–15 lis', '26 paź – 1 lis']);
    expect(groupTransactions(hits, 'month', NOW).map((x) => x.label)).toEqual(['listopad 2026', 'październik 2026']);
    expect(groupTransactions(hits, 'year', NOW)[0].out).toBe(60);
    expect(groupLabel('2025-03-03', 'day', NOW)).toBe('poniedziałek, 3 mar 2025');
  });
  it('szczegóły: paragon → kategorie pozycji; bez paragonu → opis, kategoria, tagi', () => {
    const r = E('r', '2026-11-17', 50, { storeName: 'Lidl', receiptItems: [
      { name: 'Czekolada', price: 20, quantity: 1, unitPrice: 20, foodSubcat: 'słodycze' },
      { name: 'Chleb', price: 5, quantity: 1, unitPrice: 5, foodSubcat: 'pieczywo' },
      { name: 'Płyn', price: 10, quantity: 1, unitPrice: 10, nonFoodCategory: 'chemia' },
    ] });
    expect(txDetail(r)).toBe('3 poz. · słodycze, chemia, pieczywo');
    expect(txDetail(E('n', '2026-11-17', 9, { storeName: 'Revolut', note: 'na oszczędności', tags: ['revolut', 'oszczędności'] }))).toBe('na oszczędności · #oszczędności');
    expect(txColor(E('t', '2026-11-17', 9, { fvOverride: 'transfer' }))).toBe('#6E6E6E');
  });
});
