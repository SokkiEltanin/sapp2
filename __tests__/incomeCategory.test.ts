import { incomeCategoryOf, incomeByCategory } from '@/utils/incomeCategory';

const I = (x: any) => ({ id: Math.random().toString(), type: 'income', amount: 100, date: '2026-11-05', note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', ...x });

describe('kategorie przychodów', () => {
  it('zgadywanie z tagów i opisu, bez polskich znaków', () => {
    expect(incomeCategoryOf(I({ tags: ['wypłata'] }))).toBe('pensja');
    expect(incomeCategoryOf(I({ note: 'Zwrot za buty' }))).toBe('zwrot');
    expect(incomeCategoryOf(I({ storeName: 'Vinted' }))).toBe('sprzedaz');
    expect(incomeCategoryOf(I({ note: 'od mamy na urodziny' }))).toBe('prezent');
    expect(incomeCategoryOf(I({ note: 'Kapitalizacja odsetek' }))).toBe('odsetki');
    expect(incomeCategoryOf(I({ note: 'cokolwiek' }))).toBe('inne');
  });
  it('ręczny wybór wygrywa', () => {
    expect(incomeCategoryOf(I({ note: 'wypłata', incomeCategory: 'prezent' }))).toBe('prezent');
  });
  it('suma po kategoriach w miesiącu, bez przelewów własnych', () => {
    const r = incomeByCategory([
      I({ tags: ['wypłata'], amount: 5000 }), I({ note: 'zwrot', amount: 50 }), I({ note: 'zwrot', amount: 30, date: '2026-10-01' }),
      I({ amount: 999, fvOverride: 'transfer' }), { ...I({}), type: 'expense' },
    ] as any, '2026-11');
    expect(r.map((c) => [c.tag, c.amount])).toEqual([['pensja', 5000], ['zwrot', 50]]);
  });
});
