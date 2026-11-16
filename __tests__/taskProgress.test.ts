import { taskProgress, progressLine, doneStats, cheer } from '@/utils/taskProgress';
import type { Task } from '@/types/calendar';

const T = (p: Partial<Task>): Task => ({ id: Math.random().toString(), title: 'x', status: 'pending', priority: 'normal', tags: [], createdAt: '', updatedAt: '2026-01-01T00:00:00Z', ...p } as Task);
const NOW = new Date(2026, 10, 16, 12);
const at = (d: number, h = 10) => new Date(2026, 10, d, h).toISOString();

describe('postęp kroków', () => {
  test('liczby i następny krok', () => {
    const p = taskProgress({ subtasks: [{ id: 'a', title: 'Wstęp', done: true }, { id: 'b', title: 'Rozdział 1', done: false }, { id: 'c', title: 'Rozdział 2', done: false }] });
    expect(p).toMatchObject({ done: 1, total: 3, next: { id: 'b' } });
    expect(progressLine(p)).toBe('Następny krok: Rozdział 1');
  });
  test('napisy: start, ostatni, komplet, brak kroków', () => {
    expect(progressLine(taskProgress({ subtasks: [{ id: 'a', title: 'A', done: false }] }))).toBe('Zacznij od: A');
    expect(progressLine(taskProgress({ subtasks: [{ id: 'a', title: 'A', done: true }, { id: 'b', title: 'B', done: false }] }))).toBe('Został ostatni krok: B');
    expect(progressLine(taskProgress({ subtasks: [{ id: 'a', title: 'A', done: true }] }))).toMatch(/odhacz/);
    expect(taskProgress({}).total).toBe(0);
  });
});

describe('dziś / seria', () => {
  test('seria liczy dni z rzędu, dziś pusty nie przerywa', () => {
    const tasks = [
      T({ status: 'done', completedAt: at(15) }), T({ status: 'done', completedAt: at(14) }), T({ status: 'done', completedAt: at(14, 18) }),
      T({ status: 'done', completedAt: at(12) }), T({ status: 'pending', completedAt: at(16) }),
    ];
    expect(doneStats(tasks, NOW)).toEqual({ today: 0, week: 4, streak: 2 });
    const withToday = [...tasks, T({ status: 'done', completedAt: at(16) })];
    expect(doneStats(withToday, NOW)).toEqual({ today: 1, week: 5, streak: 3 });
    expect(cheer({ today: 3, week: 5, streak: 3 })).toBe('To już 3. zadanie dziś.');
  });
  test('stare zadania bez completedAt — updatedAt', () => {
    expect(doneStats([T({ status: 'done', updatedAt: at(16) })], NOW).today).toBe(1);
  });
});
