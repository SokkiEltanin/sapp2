jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { useCalendarStore } from '@/store/calendarStore';
import { filterTasks, EMPTY_TASK_FILTER } from '@/utils/taskFilter';
import { planTaskReminders } from '@/utils/taskReminders';
import type { Task } from '@/types/calendar';

const T = (id: string, p: Partial<Task> = {}): Task => ({ id, title: id, status: 'pending', priority: 'normal', tags: [], createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...p } as Task);

describe('kosz zadań', () => {
  test('usunięcie → kosz z datą, przywrócenie czyści daty', () => {
    useCalendarStore.setState({ tasks: [T('a', { subtasks: [{ id: 's', title: 'krok', done: true }] })] });
    useCalendarStore.getState().updateTask('a', { status: 'deleted' });
    let t = useCalendarStore.getState().tasks[0];
    expect(t.status).toBe('deleted');
    expect(t.deletedAt).toBeTruthy();
    useCalendarStore.getState().updateTask('a', { status: 'pending' });
    t = useCalendarStore.getState().tasks[0];
    expect(t.status).toBe('pending');
    expect(t.deletedAt).toBeUndefined();
    expect(t.subtasks?.[0].done).toBe(true); // kroki zostają
  });
  test('purge: tylko kosz starszy niż 30 dni', () => {
    const old = new Date(Date.now() - 31 * 86400000).toISOString();
    const fresh = new Date(Date.now() - 2 * 86400000).toISOString();
    useCalendarStore.setState({ tasks: [T('old', { status: 'deleted', deletedAt: old }), T('fresh', { status: 'deleted', deletedAt: fresh }), T('done', { status: 'done', updatedAt: old })] });
    useCalendarStore.getState().purgeDeleted();
    expect(useCalendarStore.getState().tasks.map((t) => t.id)).toEqual(['fresh', 'done']);
  });
  test('kosz nie trafia do szukania ani przypomnień', () => {
    const del = T('x', { status: 'deleted', deadline: '2099-01-01T10:00:00' });
    expect(filterTasks([del], { ...EMPTY_TASK_FILTER, status: 'all' }, '2026-11-16')).toHaveLength(0);
    expect(planTaskReminders([del], new Date(2026, 10, 16))).toHaveLength(0);
  });
});
