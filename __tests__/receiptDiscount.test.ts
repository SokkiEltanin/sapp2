import { parseDiscountInput, setItemDiscount, applyReceiptDiscount, receiptSavings, grossPrice } from '@/utils/receiptDiscount';

const item = (name: string, price: number, extra: any = {}) => ({ name, price, quantity: 1, unitPrice: price, ...extra });

describe('zniżki na paragonie', () => {
  it('wpis kwoty albo procentu', () => {
    expect(parseDiscountInput('3,99', 10)).toBe(3.99);
    expect(parseDiscountInput('20%', 12.5)).toBe(2.5);
    expect(parseDiscountInput('abc', 10)).toBeNull();
    expect(parseDiscountInput('', 10)).toBeNull();
  });

  it('ustawienie, zmiana i usunięcie zniżki pozycji', () => {
    const a = setItemDiscount(item('Ser', 12.98), 3.99);
    expect(a).toMatchObject({ price: 8.99, discount: 3.99 });
    const b = setItemDiscount({ ...a, promotion: '1+1' }, 2);
    expect(b).toMatchObject({ price: 10.98, discount: 2 });
    expect(grossPrice(b)).toBe(12.98);
    const c = setItemDiscount(b, 0);
    expect(c).toEqual(expect.objectContaining({ price: 12.98 }));
    expect(c.discount).toBeUndefined();
    expect(c.promotion).toBeUndefined();
    expect(setItemDiscount(item('X', 5), 99).price).toBe(0);
  });

  it('rabat na cały paragon proporcjonalnie, bez kaucji i wykluczonych', () => {
    const items = [item('A', 30), item('B', 10), item('Kaucja', 0.5, { kind: 'deposit' }), item('C', 20, { excluded: true })];
    const out = applyReceiptDiscount(items, 4);
    expect(out.map((x: any) => x.price)).toEqual([27, 9, 0.5, 20]);
    expect(out[0]).toMatchObject({ discount: 3, promotion: 'rabat na paragon' });
    expect(receiptSavings(out)).toEqual({ amount: 4, count: 2 });
  });

  it('grosze się zgadzają', () => {
    const out = applyReceiptDiscount([item('A', 1), item('B', 1), item('C', 1)], 1);
    expect(out.reduce((a, x) => a + x.discount!, 0)).toBeCloseTo(1, 5);
  });
});
