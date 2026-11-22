import { globalSearch } from '@/utils/globalSearch';

const E = (id: string, x: any) => ({ id, type: 'expense', amount: 10, date: '2026-11-01', note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', ...x });
const data: any = {
  expenses: [
    E('a', { storeName: 'Lidl', receiptItems: [{ name: 'Ser gouda', price: 8, quantity: 1, unitPrice: 8 }], date: '2026-11-02' }),
    E('b', { storeName: 'Żabka', note: 'kawa', amount: 12.5, date: '2026-11-05' }),
    E('c', { type: 'income', note: 'Wypłata', amount: 5000 }),
  ],
  notes: [{ id: 'n', kind: 'text', title: '', text: 'Kupić ser i chleb', items: [], strokes: [], pinned: false, createdAt: '', updatedAt: '2026-11-03' }],
  tasks: [{ id: 't', title: 'Zabkowice wyjazd', tags: ['auto'], status: 'pending', priority: 'normal', createdAt: '', updatedAt: '' }],
  subscriptions: [{ id: 's', name: 'Netflix', amount: 49, billingCycle: 'monthly', nextBillingDate: '2026-11-20', reminderDaysBefore: 0, active: true }],
  replacements: [{ id: 'r', name: 'Filtr wody', every: 2, unit: 'months', lastDate: '2026-10-01', remindDaysBefore: 3 }],
  vehicles: [{ id: 'v', name: 'Octavia', kind: 'car', tag: 'octavia', color: '#fff' }],
};

describe('wyszukiwanie w całej appce', () => {
  it('pozycja paragonu i notatka', () => {
    const r = globalSearch(data, 'ser');
    expect(r.expense.map((h) => [h.id, h.sub])).toEqual([['a', 'pozycja: Ser gouda']]);
    expect(r.note[0].title).toBe('Kupić ser i chleb');
  });
  it('bez polskich znaków, kilka słów naraz', () => {
    expect(globalSearch(data, 'zabka kawa').expense.map((h) => h.id)).toEqual(['b']);
    expect(globalSearch(data, 'zabk').task.map((h) => h.id)).toEqual(['t']);
  });
  it('po kwocie', () => {
    expect(globalSearch(data, '12,50').expense.map((h) => h.id)).toEqual(['b']);
    expect(globalSearch(data, '49 zł').subscription.map((h) => h.id)).toEqual(['s']);
  });
  it('wymiany, pojazdy, przychody ze znakiem', () => {
    const r = globalSearch(data, 'filtr');
    expect(r.replacement[0].title).toBe('Filtr wody');
    expect(globalSearch(data, 'octa').vehicle).toHaveLength(1);
    expect(globalSearch(data, 'wypłata').expense[0].amount).toBe(5000);
  });
  it('za krótkie zapytanie = nic', () => {
    expect(globalSearch(data, 's').total).toBe(0);
  });
});

describe('szukanie: dobre rzeczy dnia', () => {
  it('znajduje po tekście, od najnowszej', () => {
    const good = [{ id: 'g_2026-11-20', date: '2026-11-20', text: 'Spacer z psem', createdAt: '', updatedAt: '' }, { id: 'g_2026-11-21', date: '2026-11-21', text: 'spacer nad rzeką', createdAt: '', updatedAt: '' }];
    const r = globalSearch({ ...data, good }, 'spacer');
    expect(r.good.map((h) => h.id)).toEqual(['2026-11-21', '2026-11-20']);
    expect(globalSearch(data, 'spacer').good).toEqual([]);
  });
});
