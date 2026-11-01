import { buildProductCatalog, findDuplicateCandidates } from '@/utils/productCatalog';
import type { Expense, ReceiptItem } from '@/types/finances';

let seq = 0;
const item = (o: Partial<ReceiptItem>): ReceiptItem => ({ name: 'x', price: 5, quantity: 1, unitPrice: 5, ...o });
const expense = (items: ReceiptItem[], o: Partial<Expense> = {}): Expense => ({
  id: `e${seq++}`, type: 'expense', amount: items.reduce((s, i) => s + i.price, 0), date: '2026-10-01',
  note: '', tags: [], receiptItems: items, source: 'manual', createdAt: '', updatedAt: '', ...o,
});

describe('productCatalog — buildProductCatalog', () => {
  test('grupuje wariacje tej samej nazwy (productGroupKey) w jeden wpis', () => {
    const expenses = [
      expense([item({ name: 'Serek wiejski lekki', price: 4 })], { date: '2026-10-01' }),
      expense([item({ name: 'Serek wiejski Pilos', price: 5 })], { date: '2026-10-05' }),
    ];
    const catalog = buildProductCatalog(expenses);
    expect(catalog).toHaveLength(1);
    expect(catalog[0].timesBought).toBe(2);
    expect(catalog[0].totalSpent).toBe(9);
    expect(catalog[0].lastDate).toBe('2026-10-05');
    expect(catalog[0].lastPrice).toBe(5);
  });

  test('kaucja (kind:deposit) nigdy nie trafia do katalogu', () => {
    const expenses = [expense([item({ name: 'Kaucja (butelka)', price: 0.5, kind: 'deposit' })])];
    expect(buildProductCatalog(expenses)).toHaveLength(0);
  });

  test('foodSubcat wpisu = najczęstszy tag spośród zakupów w tej grupie', () => {
    const expenses = [
      expense([item({ name: 'Jogurt naturalny', foodSubcat: 'nabiał' })]),
      expense([item({ name: 'Jogurt naturalny', foodSubcat: 'nabiał' })]),
      expense([item({ name: 'Jogurt naturalny', foodSubcat: undefined })]),
    ];
    expect(buildProductCatalog(expenses)[0].foodSubcat).toBe('nabiał');
  });

  test('alias scala DWIE inaczej nazwane pozycje (różny pierwszy token) w JEDEN wpis katalogu', () => {
    const expenses = [
      expense([item({ name: 'Chleb żytni razowy', price: 3 })]),
      expense([item({ name: 'Chlebek żytni', price: 4 })]),
    ];
    const withoutAlias = buildProductCatalog(expenses);
    expect(withoutAlias).toHaveLength(2); // różne groupKey ("chleb" vs "chlebek") — bez aliasu NIE scala się samo

    const aliases = { 'chleb zytni razowy': 'Chleb żytni razowy', 'chlebek zytni': 'Chleb żytni razowy' };
    const withAlias = buildProductCatalog(expenses, aliases);
    expect(withAlias).toHaveLength(1);
    expect(withAlias[0].timesBought).toBe(2);
  });
});

describe('productCatalog — findDuplicateCandidates', () => {
  test('etykiety różnych grup, ale w paśmie niepewności (podobny, nie identyczny rdzeń) → kandydat na duplikat', () => {
    const expenses = [
      expense([item({ name: 'Chleb żytni razowy' })]),
      expense([item({ name: 'Chlebek żytni' })]),
    ];
    const catalog = buildProductCatalog(expenses);
    expect(catalog).toHaveLength(2); // warunek wstępny — inaczej test nic nie sprawdza
    const candidates = findDuplicateCandidates(catalog);
    expect(candidates.length).toBeGreaterThan(0);
  });

  test('zupełnie różne produkty → brak kandydatów', () => {
    const expenses = [
      expense([item({ name: 'Mleko 2%' })]),
      expense([item({ name: 'Proszek do prania' })]),
    ];
    expect(findDuplicateCandidates(buildProductCatalog(expenses))).toEqual([]);
  });
});
