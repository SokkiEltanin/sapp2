import { planTaskReminders, snoozeFields, TASK_REMINDER_PREFIX } from '../src/utils/taskReminders';
import type { Task } from '../src/types/calendar';

const now = new Date('2026-11-14T12:00:00');
const task = (p: Partial<Task>): Task => ({
  id: 'a', title: 'Zadanie', status: 'pending', priority: 'medium' as Task['priority'], tags: [],
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...p,
});

describe('planTaskReminders', () => {
  it('przypomina tylko o zadaniach z godziną, w przyszłości, niezrobionych', () => {
    const plan = planTaskReminders([
      task({ id: 'time', deadline: '2026-11-14T18:30:00', tags: ['UR'] }),
      task({ id: 'dateOnly', deadline: '2026-11-15' }),
      task({ id: 'past', deadline: '2026-11-14T08:00:00' }),
      task({ id: 'done', deadline: '2026-11-14T19:00:00', status: 'done' }),
      task({ id: 'far', deadline: '2027-06-01T10:00:00' }),
    ], now);
    expect(plan.map((p) => p.taskId)).toEqual(['time']);
    expect(plan[0].id).toBe(`${TASK_REMINDER_PREFIX}time`);
    expect(plan[0].body).toBe('Zadanie na 18:30 · #UR');
    expect(plan[0].fireAt).toBe(new Date('2026-11-14T18:30:00').getTime());
  });

  it('własna godzina przypomnienia ma pierwszeństwo i własny tekst', () => {
    const [p] = planTaskReminders([task({ deadline: '2026-11-20', reminderDate: '2026-11-19', reminderTime: '07:15', reminderMessage: 'Weź dokumenty' })], now);
    expect(p.fireAt).toBe(new Date('2026-11-19T07:15:00').getTime());
    expect(p.body).toBe('Weź dokumenty');
  });

  it('sortuje od najbliższego i ogranicza liczbę', () => {
    const many = Array.from({ length: 50 }, (_, i) => task({ id: `t${i}`, deadline: `2026-11-${String(15 + (i % 10)).padStart(2, '0')}T${String(8 + (i % 12)).padStart(2, '0')}:00:00` }));
    const plan = planTaskReminders(many, now);
    expect(plan).toHaveLength(40);
    expect(plan.every((p, i) => i === 0 || plan[i - 1].fireAt <= p.fireAt)).toBe(true);
  });
});

describe('snoozeFields', () => {
  it('przesuwa o godzinę, także przez północ', () => {
    expect(snoozeFields(new Date('2026-11-14T12:05:00'))).toEqual({ reminderDate: '2026-11-14', reminderTime: '13:05' });
    expect(snoozeFields(new Date('2026-11-14T23:30:00'))).toEqual({ reminderDate: '2026-11-15', reminderTime: '00:30' });
  });
  it('zadanie przesunięte "Za godzinę" dostaje nowe przypomnienie', () => {
    const now = new Date('2026-11-14T18:31:00');
    const [p] = planTaskReminders([task({ deadline: '2026-11-14T18:30:00', ...snoozeFields(now) })], now);
    expect(p.fireAt).toBe(new Date('2026-11-14T19:31:00').getTime());
  });
});
