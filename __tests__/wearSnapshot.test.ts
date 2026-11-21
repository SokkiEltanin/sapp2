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

describe('zegarek: zmiany pracy i humor', () => {
  const { wearShifts, wearMoodToday } = require('@/utils/wearSnapshot');
  const emp = { id: 'e', name: 'JD', workPrefix: '[JD]', monthlySalary: 3000, hoursPerMonth: 100, rateOverride: 30, createdAt: 0 };
  it('zmiana dziś z godzin w tytule, przez północ, bez zakończonych i ukrytych pracodawców', () => {
    const ev = [
      Ev({ title: '[JD] 13:00-20:00', startTime: '09:00', endTime: '17:00' }),
      Ev({ title: '[JD] 06:00-10:00', startTime: '06:00', endTime: '10:00' }), // już minęła
      Ev({ title: '[JD] 22:00-06:00', date: '2026-11-15', startTime: '22:00', endTime: '06:00' }),
      Ev({ title: 'Kino', startTime: '18:00', endTime: '20:00' }),
    ] as any;
    const s = wearShifts([emp], ev, [], NOW);
    expect(s.map((x: any) => [new Date(x.s).toString().slice(16, 21), new Date(x.e).getDate(), new Date(x.e).toString().slice(16, 21), x.rate])).toEqual([
      ['13:00', 14, '20:00', 30], ['22:00', 16, '06:00', 30],
    ]);
    expect(wearShifts([{ ...emp, hidden: true }], ev, [], NOW)).toEqual([]);
  });
  it('humor dziś: liczba wpisów i ostatni', () => {
    const m = wearMoodToday([
      { id: '1', date: '2026-11-14', mood: 2, energy: 3, tags: [], createdAt: '2026-11-14T08:00:00Z', updatedAt: '' },
      { id: '2', date: '2026-11-14', mood: 4.333, energy: 2, tags: [], createdAt: '2026-11-14T10:00:00Z', updatedAt: '' },
      { id: '3', date: '2026-11-13', mood: 1, energy: 1, tags: [], createdAt: '2026-11-13T10:00:00Z', updatedAt: '' },
    ] as any, NOW);
    expect(m).toEqual({ n: 2, mood: 4.33, energy: 2 });
    expect(wearMoodToday([], NOW)).toEqual({ n: 0, mood: null, energy: null });
  });
});
