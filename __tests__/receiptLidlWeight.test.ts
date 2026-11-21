import { readFileSync } from 'fs';
import { parseReceiptText } from '@/utils/receiptParser';

// 2026-11-21, user: paragon Lidl — produkty na wagę z ceną za kg z jednym miejscem po przecinku
// („0,494kg x 62.9 31.07 A”) wchodziły jako osobna pozycja „0,494kg x 62.9” bez kategorii.
describe('Lidl: produkty na wagę', () => {
  const r = parseReceiptText(readFileSync(__dirname + '/fixtures/lidl_waga_2026-11-21.txt', 'utf8'));
  it('nazwa z linii nad wagą, ilość = waga, cena za kg', () => {
    const sl = r.items.filter((i) => i.name.startsWith('Śliwka'));
    expect(sl.map((i) => [i.quantity, i.unitPrice])).toEqual([[0.494, 62.9], [0.1, 62.9]]);
    expect(sl.every((i) => i.foodSubcat === 'owoce')).toBe(true);
    expect(r.items.some((i) => /^\d/.test(i.name))).toBe(false);
  });
  it('dopisek jednostki znika z nazwy, kaki = owoce', () => {
    const kaki = r.items.find((i) => i.name.startsWith('Kaki'))!;
    expect(kaki.name).toBe('Kaki');
    expect(kaki.foodSubcat).toBe('owoce');
  });
  it('15 pozycji, suma pozycji = suma paragonu', () => {
    expect(r.items).toHaveLength(15);
    const sum = Math.round(r.items.reduce((a, i) => a + i.price, 0) * 100) / 100;
    expect(sum).toBe(139.97);
    expect(r.total).toBe(139.97);
  });
  it('cukierki na wagę, cena za kg bez groszy', () => {
    const t = ['Lidl sp.z o.o.', 'Cukierki mix kg', '0,350kg x 39 13.65 C', 'Suma PLN 13,65'].join('\n');
    const it = parseReceiptText(t).items[0];
    expect(it).toMatchObject({ name: 'Cukierki mix', quantity: 0.35, unitPrice: 39, price: 13.65, foodSubcat: 'słodycze' });
  });
});
