import {
  addInterval, replaceDue, dueLabel, everyLabel, markReplaced, undoLastReplace, realAvgDays,
  findBuys, pendingBuy, yearlyCost, sortByDue, nextHomeReplacement, REPLACE_PRESETS,
} from '@/utils/replacements';
import type { ReplaceItem } from '@/types/replacements';
import type { Expense } from '@/types/finances';

const item = (p: Partial<ReplaceItem> = {}): ReplaceItem => ({
  id: 'a', name: 'Filtr w dzbanku', preset: 'jug', every: 1, unit: 'm', lastDate: '2026-10-20', history: [],
  remindDaysBefore: 0, keywords: ['dafi', 'brita'], createdAt: '', updatedAt: '', ...p,
});
const exp = (id: string, date: string, items: [string, number][] = [], note = ''): Expense => ({
  id, type: 'expense', amount: items.reduce((s, [, p]) => s + p, 0) || 10, date, note, tags: [], source: 'manual',
  receiptItems: items.map(([name, price]) => ({ name, price, quantity: 1, unitPrice: price })),
} as unknown as Expense);
const NOW = new Date(2026, 10, 13, 10); // 13.11.2026

describe('terminy', () => {
  test('interwały: miesiące przycinane, tygodnie, dni', () => {
    expect(addInterval('2026-01-31', 1, 'm')).toBe('2026-02-28');
    expect(addInterval('2026-11-01', 2, 'w')).toBe('2026-11-15');
    expect(addInterval('2026-11-30', 3, 'd')).toBe('2026-12-03');
  });
  test('replaceDue: dni do, zużycie, etykieta', () => {
    const d = replaceDue(item(), NOW);
    expect(d.nextDate).toBe('2026-11-20');
    expect(d.daysLeft).toBe(7);
    expect(d.label).toBe('za 7 dni');
    expect(d.used).toBeCloseTo(24 / 31, 2);
  });
  test('etykiety', () => {
    expect(dueLabel(-1)).toBe('1 dzień po terminie');
    expect(dueLabel(-3)).toBe('3 dni po terminie');
    expect(dueLabel(0)).toBe('dziś');
    expect(dueLabel(1)).toBe('jutro');
    expect(dueLabel(90)).toBe('za ~3 mies.');
    expect(everyLabel(1, 'm')).toBe('co miesiąc');
    expect(everyLabel(3, 'm')).toBe('co 3 miesiące');
    expect(everyLabel(2, 'w')).toBe('co 2 tygodnie');
    expect(everyLabel(5, 'm')).toBe('co 5 miesięcy');
  });
  test('sortowanie i najbliższa', () => {
    const a = item({ id: 'a', name: 'A', lastDate: '2026-11-01' });
    const b = item({ id: 'b', name: 'B', lastDate: '2026-10-01' });
    expect(sortByDue([a, b], NOW).map((x) => x.item.id)).toEqual(['b', 'a']);
    expect(nextHomeReplacement([a, b], NOW)).toEqual({ name: 'B', daysLeft: -12, label: '12 dni po terminie' });
    expect(nextHomeReplacement([], NOW)).toBeNull();
  });
});

describe('historia', () => {
  test('wymiana przesuwa poprzednią do historii, cofnięcie wraca', () => {
    const m = markReplaced(item(), '2026-11-13', 'x');
    expect(m.lastDate).toBe('2026-11-13');
    expect(m.history).toEqual(['2026-10-20']);
    expect(undoLastReplace(m, 'y').lastDate).toBe('2026-10-20');
    expect(markReplaced(m, '2026-11-13')).toBe(m);
  });
  test('wsteczna data ląduje w historii, nie jako ostatnia', () => {
    const m = markReplaced(item(), '2026-09-15', 'x');
    expect(m.lastDate).toBe('2026-10-20');
    expect(m.history).toEqual(['2026-09-15']);
  });
  test('realny średni odstęp', () => {
    expect(realAvgDays(item())).toBeNull();
    expect(realAvgDays(item({ lastDate: '2026-11-10', history: ['2026-10-10', '2026-09-10'] }))).toBe(31);
  });
});

describe('zakupy z paragonów', () => {
  const expenses = [
    exp('e1', '2026-11-05', [['WKLAD DAFI UNIMAX 3SZT', 39.99], ['MLEKO', 3.5]]),
    exp('e2', '2026-09-01', [['Wkład Brita Maxtra', 29.99]]),
    exp('e3', '2026-11-06', [['Filtr do kawy', 5]]),
    exp('e4', '2026-11-07', [], 'dafi rossmann'),
  ];
  test('znajduje pozycje po słowach (bez polskich znaków i wielkości liter)', () => {
    const buys = findBuys(item(), expenses);
    expect(buys.map((b) => b.expenseId)).toEqual(['e4', 'e1', 'e2']);
    expect(buys[1].price).toBe(39.99);
  });
  test('zakup po ostatniej wymianie = do potwierdzenia; odrzucony pomijany', () => {
    expect(pendingBuy(item(), expenses)?.expenseId).toBe('e4');
    expect(pendingBuy(item({ dismissedBuys: ['e4'] }), expenses)?.expenseId).toBe('e1');
    expect(pendingBuy(item({ lastDate: '2026-11-10' }), expenses)).toBeNull();
  });
  test('koszt roczny z ostatniej ceny', () => {
    expect(yearlyCost(item(), [expenses[0]])).toBe(480);
    expect(yearlyCost(item({ keywords: [] }), expenses)).toBeNull();
  });
  test('szablony mają słowa i interwał', () => {
    for (const p of REPLACE_PRESETS) { expect(p.keywords.length).toBeGreaterThan(0); expect(p.every).toBeGreaterThan(0); }
  });
});

import { planReplaceReminders } from '@/utils/replaceReminders';
describe('przypomnienia', () => {
  test('w dniu terminu o 9:00 / N dni przed / bez', () => {
    const [p] = planReplaceReminders([item()], NOW);
    expect(new Date(p.fireAt)).toEqual(new Date(2026, 10, 20, 9));
    expect(p.id).toBe('repl_a');
    const [q] = planReplaceReminders([item({ remindDaysBefore: 3 })], NOW);
    expect(new Date(q.fireAt)).toEqual(new Date(2026, 10, 17, 9));
    expect(planReplaceReminders([item({ remindDaysBefore: -1 })], NOW)).toEqual([]);
  });
  test('po terminie: raz następnego dnia, potem nic', () => {
    const [p] = planReplaceReminders([item({ lastDate: '2026-10-13' })], NOW); // termin 13.11, 10:00 > 9:00
    expect(new Date(p.fireAt)).toEqual(new Date(2026, 10, 14, 9));
    expect(planReplaceReminders([item({ lastDate: '2026-10-01' })], NOW)).toEqual([]);
  });
});
