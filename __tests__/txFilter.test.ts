import { filterTransactions, summarize, activeFilterCount, datePreset, EMPTY_FILTER } from '@/utils/txFilter';
import type { Expense } from '@/types/finances';

const e = (id: string, date: string, amount: number, extra: Partial<Expense> = {}): Expense => ({
  id, type: 'expense', amount, date, note: '', tags: [], source: 'manual', createdAt: date, updatedAt: date, ...extra,
} as unknown as Expense);
const ex = [
  e('a', '2026-11-10', 43.5, { storeName: 'Lidl', receiptItems: [{ name: 'Ser Gouda 150g', price: 6.49, quantity: 1, unitPrice: 6.49, foodSubcat: 'nabial' } as any] }),
  e('b', '2026-11-05', 5000, { type: 'income', note: 'Wypłata' } as any),
  e('c', '2026-10-20', 120, { storeName: 'Kino Helios', expenseCategory: 'rozrywka', fvOverride: 'variable' } as any),
  e('d', '2026-09-01', 12.5, { storeName: 'Żabka', note: 'kawa' }),
];
const ids = (f: any) => filterTransactions(ex, { ...EMPTY_FILTER, ...f }).map((h) => h.e.id);

describe('filtry transakcji', () => {
  test('bez filtrów: wszystko od najnowszych', () => expect(ids({})).toEqual(['a', 'b', 'c', 'd']));
  test('typ', () => {
    expect(ids({ kind: 'income' })).toEqual(['b']);
    expect(ids({ kind: 'expense' })).toEqual(['a', 'c', 'd']);
  });
  test('kwota od–do i data od–do', () => {
    expect(ids({ min: 20, max: 200 })).toEqual(['a', 'c']);
    expect(ids({ from: '2026-10-01', to: '2026-10-31' })).toEqual(['c']);
  });
  test('rodzaj: jedzenie / kategoria', () => {
    expect(ids({ bucket: 'cat:rozrywka' })).toEqual(['c']);
    expect(ids({ bucket: 'variable' })).toContain('c');
  });
  test('szukanie: pozycja paragonu, bez polskich znaków, kwota, kategoria', () => {
    const hits = filterTransactions(ex, { ...EMPTY_FILTER, query: 'gouda' });
    expect(hits.map((h) => h.e.id)).toEqual(['a']);
    expect(hits[0].match).toBe('Ser Gouda 150g');
    expect(ids({ query: 'zabka' })).toEqual(['d']);
    expect(ids({ query: '12,50' })).toEqual(['d']);
    expect(ids({ query: 'rozrywka' })).toEqual(['c']);
    expect(ids({ query: 'lidl ser' })).toEqual(['a']);
  });
  test('podsumowanie, licznik, zakresy dat', () => {
    expect(summarize(filterTransactions(ex, EMPTY_FILTER))).toEqual({ count: 4, out: 176, in: 5000 });
    expect(activeFilterCount({ ...EMPTY_FILTER, kind: 'income', min: 5, from: '2026-01-01' })).toBe(3);
    expect(datePreset('lastMonth', new Date(2026, 0, 15))).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(datePreset('days30', new Date(2026, 10, 30))).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });
});

describe('przelew własny w filtrach', () => {
  const base = { date: '2026-11-10', tags: [], createdAt: '', updatedAt: '' } as any;
  const list = [
    { ...base, id: 'a', type: 'expense', amount: 50 },
    { ...base, id: 'b', type: 'expense', amount: 500, fvOverride: 'transfer' },
    { ...base, id: 'c', type: 'income', amount: 300, fvOverride: 'transfer' },
    { ...base, id: 'd', type: 'income', amount: 100 },
  ];
  it('Własne pokazuje tylko przelewy własne, Wydatki/Przychody je pomijają', () => {
    const { filterTransactions, summarize, EMPTY_FILTER } = require('@/utils/txFilter');
    expect(filterTransactions(list, { ...EMPTY_FILTER, kind: 'own' }).map((h: any) => h.e.id)).toEqual(['b', 'c']);
    expect(filterTransactions(list, { ...EMPTY_FILTER, kind: 'expense' }).map((h: any) => h.e.id)).toEqual(['a']);
    expect(filterTransactions(list, { ...EMPTY_FILTER, kind: 'income' }).map((h: any) => h.e.id)).toEqual(['d']);
    expect(summarize(filterTransactions(list, EMPTY_FILTER))).toEqual({ count: 4, out: 50, in: 100 });
  });
});
