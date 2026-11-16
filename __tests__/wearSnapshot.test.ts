import { buildWearSnapshot, wearEvents } from '@/utils/wearSnapshot';

const T = (id: string, x: any = {}) => ({ id, title: id, status: 'pending', priority: 'normal', tags: [], createdAt: '2026-11-01', updatedAt: '', ...x });
const Ev = (x: any) => ({ id: Math.random().toString(), title: 'E', date: '2026-11-14', allDay: false, priority: 'normal', createdAt: '', ...x });
const NOW = new Date(2026, 10, 14, 12, 0);

describe('dane dla zegarka', () => {
  it('bez wydatków; zadania: zaległe pierwsze, zrobione pominięte, z krokami', () => {
    const s = buildWearSnapshot([T('a', { subtasks: [{ id: 's1', title: 'Wstęp', done: true }, { id: 's2', title: 'R1', done: false }] }), T('b', { deadline: '2026-11-10' }), T('c', { status: 'done' })], [], NOW);
    expect(s.tasks.map((t) => t.id)).toEqual(['b', 'a']);
    expect(s.tasks[0].overdue).toBe(true);
    expect(s.tasks[1].steps).toEqual([{ id: 's1', title: 'Wstęp', done: true }, { id: 's2', title: 'R1', done: false }]);
    expect((s as any).today).toBeUndefined();
    expect(s.day).toBe('2026-11-14');
  });
  it('wydarzenia dziś (bez minionych) i jutro, całodniowe pierwsze', () => {
    const ev = wearEvents([
      Ev({ title: '[PUR] Seminarium', startTime: '08:00', endTime: '09:30' }),
      Ev({ title: '[JD] 13:00-20:00', startTime: '13:00', endTime: '20:00', color: '#EAB308' }),
      Ev({ title: 'Urodziny', allDay: true }),
      Ev({ title: 'Jutro rano', date: '2026-11-15', startTime: '07:00' }),
      Ev({ title: 'Za 2 dni', date: '2026-11-16', startTime: '07:00' }),
    ] as any, NOW);
    expect(ev.map((e) => `${e.day} ${e.time} ${e.title}`)).toEqual([
      'dziś cały dzień Urodziny', 'dziś 13:00–20:00 [JD] 13:00-20:00', 'jutro 07:00 Jutro rano',
    ]);
  });
});
