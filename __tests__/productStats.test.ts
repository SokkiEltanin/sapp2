import { itemKg, productStats, topProductsByKg, fmtKg } from '@/utils/productStats';
import { productGroupKey, canonicalProductName } from '@/utils/productMemory';
import type { Expense } from '@/types/finances';

const it = (name: string, price: number, quantity = 1) => ({ name, price, quantity, unitPrice: price / quantity });
const e = (id: string, date: string, items: ReturnType<typeof it>[]): Expense => ({
  id, type: 'expense', amount: items.reduce((s, x) => s + x.price, 0), date, note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', receiptItems: items,
} as unknown as Expense);
const NOW = new Date(2026, 10, 15);
const key = (n: string) => productGroupKey(canonicalProductName(n, {}));

describe('waga pozycji', () => {
  test('z nazwy, z pamięci, ważone', () => {
    expect(itemKg(it('Ser Gouda 150g', 6), {})).toBe(0.15);
    expect(itemKg(it('Ser Gouda 150g', 12, 2), {})).toBe(0.3);
    expect(itemKg(it('Chipsy 6x40g', 9), {})).toBe(0.24);
    expect(itemKg(it('Ser Gouda plastry', 7), {})).toBeUndefined();
    expect(itemKg(it('Ser Gouda plastry', 7), { 'ser gouda plastry': 0.25 })).toBe(0.25);
    expect(itemKg(it('Banany', 3.2, 0.534), {})).toBe(0.534);
  });
  test('format', () => {
    expect(fmtKg(0.15)).toBe('150 g');
    expect(fmtKg(1.25)).toBe('1,3 kg');
  });
});

describe('statystyki produktu', () => {
  const ex = [
    e('a', '2026-09-03', [it('Ser Gouda 150g', 6)]),
    e('b', '2026-10-05', [it('Ser Gouda 150g', 12, 2), it('Mleko 1L', 4)]),
    e('c', '2026-11-02', [it('Ser Gouda 150g', 6)]),
  ];
  test('kg/mies., g/tydz., zł/kg, miesiące', () => {
    const s = productStats(ex, key('Ser Gouda 150g'), {}, {}, NOW);
    expect(s.purchases).toBe(3);
    expect(s.knownKg).toBe(0.6);
    expect(s.coverage).toBe(1);
    expect(s.pricePerKg).toBe(40);
    expect(s.months.map((m) => m.kg)).toEqual([0, 0, 0, 0.15, 0.3, 0.15]);
    expect(s.kgPerMonth).toBeCloseTo(0.6 / 2.5, 3); // od września: 2 pełne + pół listopada
    expect(s.gPerWeek).toBe(Math.round((0.24 * 1000 * 12) / 52));
  });
  test('top produktów po kg', () => {
    const top = topProductsByKg(ex, {}, {}, NOW);
    expect(top[0].groupKey).toBe(key('Mleko 1L'));
    expect(top.map((t) => t.groupKey)).toContain(key('Ser Gouda 150g'));
  });
});

import { isLiquidName } from '@/utils/productStats';
test('płyny w litrach', () => {
  expect(isLiquidName('Mleko 1L')).toBe(true);
  expect(isLiquidName('Woda 1,5l')).toBe(true);
  expect(isLiquidName('Ser 150g')).toBe(false);
  expect(fmtKg(1.5, true)).toBe('1,5 l');
  expect(fmtKg(0.5, true)).toBe('500 ml');
});
