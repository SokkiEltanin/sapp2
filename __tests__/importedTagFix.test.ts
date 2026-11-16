import { fixImportedTags, fixItemTag } from '@/utils/importedTagFix';
import type { Expense } from '@/types/finances';

const it = (name: string, tag?: string) => ({ name, price: 5, quantity: 1, unitPrice: 5, foodSubcat: tag });
const E = (items: any[]): Expense => ({ id: 'e', type: 'expense', amount: 20, date: '2026-10-01', note: '', tags: [], source: 'manual', createdAt: '', updatedAt: 'old', receiptItems: items } as unknown as Expense);

describe('sprzątanie zaimportowanych tagów', () => {
  test('duplikaty → właściwa kategoria jedzenia', () => {
    expect(fixItemTag(it('Milka', 'czekolada'))?.foodSubcat).toBe('słodycze');
    expect(fixItemTag(it('Tic tac', 'miętówki'))?.foodSubcat).toBe('słodycze');
    expect(fixItemTag(it('Penne', 'makaron'))?.foodSubcat).toBe('makarony');
  });
  test('niejedzeniowe → Zmienne (bez foodSubcat)', () => {
    const a = fixItemTag(it('Domestos', 'chemia'))!;
    expect(a.foodSubcat).toBeUndefined();
    expect(a.nonFoodCategory).toBe('chemia');
    expect(fixItemTag(it('Ibuprom', 'leki'))!.nonFoodCategory).toBe('zdrowie');
    expect(fixItemTag(it('Zszywacz', 'art.biurowe'))!.nonFoodCategory).toBeUndefined();
    expect(fixItemTag(it('Zszywacz', 'art. biurowe'))!.foodSubcat).toBeUndefined();
    expect(fixItemTag(it('X', 'nie jedzenie'))!.foodSubcat).toBeUndefined();
  });
  test('znane kategorie i bez tagu bez zmian; idempotentne', () => {
    expect(fixItemTag(it('Chleb', 'pieczywo'))).toBeNull();
    expect(fixItemTag(it('Coś'))).toBeNull();
    const r = fixImportedTags([E([it('Milka', 'czekolada'), it('Chleb', 'pieczywo')]), E([it('Chleb', 'pieczywo')])], 'now');
    expect(r.changed).toBe(1);
    expect(r.expenses[0].updatedAt).toBe('now');
    expect(r.expenses[1].updatedAt).toBe('old');
    expect(fixImportedTags(r.expenses, 'later').changed).toBe(0);
  });
});
