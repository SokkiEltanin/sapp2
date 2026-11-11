import { pendingFxOf, formatFx } from '@/utils/fx';

// 2026-11-11 — "wszystko co w obcej walucie musi mieć formularz ile to w PLN".
describe('pendingFxOf / formatFx', () => {
  test('obecność originalCurrency + originalAmount = czeka na PLN', () => {
    expect(pendingFxOf({ originalAmount: 22.14, originalCurrency: 'EUR' })).toEqual({ amount: 22.14, currency: 'EUR' });
  });
  test('brak waluty / brak kwoty → nie czeka', () => {
    expect(pendingFxOf({})).toBeUndefined();
    expect(pendingFxOf({ originalCurrency: 'EUR' })).toBeUndefined();
  });
  test('format z przecinkiem', () => {
    expect(formatFx({ amount: 0.99, currency: 'EUR' })).toBe('0,99 EUR');
  });
});
