import { applyCategoryRules, applyRulesToAll, ruleImpact, normText, storeMatchOf } from '@/utils/categoryRules';
import type { CategoryRule } from '@/types/categoryRules';
import type { Expense } from '@/types/finances';

const R = (field: 'store' | 'item', match: string, kind: 'food' | 'var', tag: string): CategoryRule =>
  ({ id: match, field, match, kind, tag, createdAt: '', updatedAt: '' });
const E = (x: Partial<Expense>): Expense =>
  ({ id: 'e', type: 'expense', amount: 50, date: '2026-11-10', note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', ...x } as Expense);
const item = (name: string, extra: any = {}) => ({ name, price: 10, quantity: 1, unitPrice: 10, ...extra });

describe('reguły kategoryzacji', () => {
  it('sklep → kategoria Zmiennych, bez polskich znaków i wielkości liter', () => {
    const r = applyCategoryRules(E({ storeName: 'APTEKA Gemini Łódź' }), [R('store', 'apteka', 'var', 'zdrowie')]);
    expect(r?.expenseCategory).toBe('zdrowie');
    expect(normText('Łódź  Żabka')).toBe('lodz zabka');
  });

  it('ręczna kategoria wygrywa', () => {
    expect(applyCategoryRules(E({ storeName: 'Apteka', expenseCategory: 'chemia' }), [R('store', 'apteka', 'var', 'zdrowie')])).toBeNull();
  });

  it('pozycje: tylko puste, jedzenie albo zmienne, kaucja pominięta', () => {
    const e = E({ receiptItems: [item('Kabel USB-C'), item('Czekolada Milka'), item('Baton', { foodSubcat: 'nabiał' }), item('Kaucja butelka', { kind: 'deposit' })] as any });
    const r = applyCategoryRules(e, [R('item', 'usb', 'var', 'elektronika'), R('item', 'czekolad', 'food', 'słodycze'), R('item', 'bat', 'food', 'słodycze'), R('item', 'kaucja', 'var', 'dom')])!;
    expect(r.receiptItems!.map((x: any) => x.nonFoodCategory ?? x.foodSubcat ?? null)).toEqual(['elektronika', 'słodycze', 'nabiał', null]);
  });

  it('dłuższy fragment wygrywa', () => {
    const r = applyCategoryRules(E({ storeName: 'Orlen Kawiarnia' }), [R('store', 'orlen', 'var', 'paliwo'), R('store', 'orlen kawiarnia', 'var', 'rozrywka')]);
    expect(r?.expenseCategory).toBe('rozrywka');
  });

  it('przychody nietknięte', () => {
    expect(applyCategoryRules(E({ type: 'income', storeName: 'Apteka' }), [R('store', 'apteka', 'var', 'zdrowie')])).toBeNull();
  });

  it('zastosowanie do wszystkich: liczba i updatedAt', () => {
    const list = [E({ id: 'a', storeName: 'Apteka' }), E({ id: 'b', storeName: 'Lidl' }), E({ id: 'c', note: 'apteka leki', expenseCategory: 'zdrowie' })];
    const rule = R('store', 'apteka', 'var', 'zdrowie');
    expect(ruleImpact(list, rule)).toBe(1);
    const r = applyRulesToAll(list, [rule], 'T');
    expect(r.changed).toBe(1);
    expect(r.expenses[0]).toMatchObject({ expenseCategory: 'zdrowie', updatedAt: 'T' });
    expect(r.expenses[1]).toBe(list[1]);
  });

  it('propozycja fragmentu ze sklepu', () => {
    expect(storeMatchOf({ storeName: 'ORLEN Stacja 123', note: '' })).toBe('orlen stacja');
  });
});

describe('reguła: przelew własny', () => {
  const { applyCategoryRules: apply } = require('@/utils/categoryRules');
  const rule = { id: 'r', field: 'store', match: 'trade republic', kind: 'own', tag: 'transfer', createdAt: '', updatedAt: '' };
  const base = { id: 'e', amount: 500, date: '2026-11-18', tags: [], source: 'bank', createdAt: '', updatedAt: '' };
  it('wydatek i wpływ z „Trade Republic” → przelew własny', () => {
    expect(apply({ ...base, type: 'expense', storeName: 'TRADE REPUBLIC BANK' }, [rule])).toMatchObject({ fvOverride: 'transfer', paymentMethod: 'transfer' });
    expect(apply({ ...base, type: 'income', note: 'Przelew od Trade Republic' }, [rule])).toMatchObject({ fvOverride: 'transfer' });
  });
  it('ręcznie ustawiony kubeł wygrywa', () => {
    expect(apply({ ...base, type: 'expense', storeName: 'Trade Republic', fvOverride: 'variable' }, [rule])).toBeNull();
  });
});
