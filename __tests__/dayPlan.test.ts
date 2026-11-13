import { dayPlan, daySummary, knownEventTags, tagOf } from '@/utils/dayPlan';
import type { CalendarEvent, Task } from '@/types/calendar';

const ev = (o: Partial<CalendarEvent>): CalendarEvent => ({
  id: `e${Math.random()}`, title: '', date: '2026-11-13', allDay: false, priority: 'normal', createdAt: '', ...o,
});
const task = (o: Partial<Task>): Task => ({
  id: `t${Math.random()}`, title: 'x', status: 'pending', priority: 'normal', tags: [], createdAt: '', updatedAt: '', ...o,
});

describe('dayPlan', () => {
  const events = [
    ev({ id: 'jd', title: '[JD] 16:00 - 22:00' }),
    ev({ id: 'ur1', title: '[UR] Analiza', startTime: '08:00', endTime: '09:30' }),
    ev({ id: 'ur2', title: '[UR] Fizyka', startTime: '11:45', endTime: '15:30' }),
    ev({ id: 'x', title: 'Urodziny Ani', allDay: true }),
    ev({ id: 'other', title: '[UR] Jutro', date: '2026-11-14', startTime: '10:00', endTime: '12:00' }),
  ];
  const tasks = [
    task({ id: 'td', title: 'Oddać pracę', deadline: '2026-11-13T18:00:00' }),
    task({ id: 'ts', title: 'Pranie', scheduledDate: '2026-11-13' }),
    task({ id: 'done', title: 'Zrobione', deadline: '2026-11-13', status: 'done' }),
  ];

  test('wybrane tagi + zadania na dziś, posortowane', () => {
    const p = dayPlan(events, tasks, '2026-11-13', ['UR', 'JD']);
    expect(p.map((x) => x.id)).toEqual(['ts', 'ur1', 'ur2', 'jd', 'td']);
    expect(p.find((x) => x.id === 'jd')).toMatchObject({ title: 'JD', start: '16:00', end: '22:00' });
  });

  test('null = wszystkie wydarzenia (też bez tagu)', () => {
    expect(dayPlan(events, [], '2026-11-13', null).map((x) => x.id)).toContain('x');
  });

  test('skrót jutra per tag', () => {
    const p = dayPlan(events, tasks, '2026-11-13', ['UR', 'JD']);
    expect(daySummary(p)).toBe('[UR] 08:00–15:30 · [JD] 16:00–22:00 · 2 zadania');
  });

  test('tagi z wydarzeń z licznikiem', () => {
    expect(knownEventTags(events, new Date(2026, 10, 13))[0]).toEqual({ tag: 'UR', count: 3 });
    expect(tagOf('[PUR] x')).toBe('PUR');
  });
});
