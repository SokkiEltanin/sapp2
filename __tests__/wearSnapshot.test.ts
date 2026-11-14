import { buildWearSnapshot } from '@/utils/wearSnapshot';

const E = (x: any) => ({ id: Math.random().toString(), type: 'expense', amount: 10, date: '2026-11-14', note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', ...x });
const T = (id: string, x: any = {}) => ({ id, title: id, status: 'pending', priority: 'normal', tags: [], createdAt: '2026-11-01', updatedAt: '', ...x });

describe('dane dla zegarka', () => {
  it('wydatki dziś i w miesiącu, ostatnie transakcje ze znakiem', () => {
    const s = buildWearSnapshot([], [
      E({ amount: 20, storeName: 'Żabka' }), E({ amount: 30, date: '2026-11-02' }), E({ amount: 99, date: '2026-10-30' }),
      E({ type: 'income', amount: 5000, note: 'Wypłata', date: '2026-11-10' }), E({ amount: 7, date: '2026-11-20' }),
    ], new Date(2026, 10, 14, 12));
    expect(s.today).toBe(20);
    expect(s.month).toBe(50);
    expect(s.recent[0]).toEqual({ label: 'Żabka', amount: -20, date: '2026-11-14' });
    expect(s.recent.find((r) => r.label === 'Wypłata')!.amount).toBe(5000);
    expect(s.recent.some((r) => r.date === '2026-11-20')).toBe(false); // przyszłe pominięte
  });
  it('zadania: zaległe pierwsze, zrobione pominięte', () => {
    const s = buildWearSnapshot([T('a'), T('b', { deadline: '2026-11-10' }), T('c', { status: 'done' })], [], new Date(2026, 10, 14, 12));
    expect(s.tasks.map((t) => t.id)).toEqual(['b', 'a']);
    expect(s.tasks[0].overdue).toBe(true);
  });
});
