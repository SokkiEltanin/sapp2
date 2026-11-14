import { filterTasks, EMPTY_TASK_FILTER, taskFilterCount } from '@/utils/taskFilter';
import type { Task } from '@/types/calendar';

const T = (id: string, x: Partial<Task> = {}): Task =>
  ({ id, title: id, status: 'pending', priority: 'normal', tags: [], createdAt: '2026-11-01', updatedAt: '2026-11-01', ...x } as Task);
const today = '2026-11-14';
const tasks = [
  T('Zapłacić czynsz', { deadline: '2026-11-10', tags: ['dom'] }),
  T('Wymienić olej', { deadline: '2026-11-14T18:00' , tags: ['auto'] }),
  T('Kupić prezent', { deadline: '2026-11-19' }),
  T('Przeczytać książkę'),
  T('Umyć auto', { status: 'done', tags: ['auto'], updatedAt: '2026-11-13' }),
  T('Odkurzyć', { status: 'done', updatedAt: '2026-11-12' }),
];
const ids = (f: any) => filterTasks(tasks, { ...EMPTY_TASK_FILTER, ...f }, today).map((t) => t.id);

describe('filtry zadań', () => {
  it('domyślnie: do zrobienia, najbliższy termin pierwszy', () => {
    expect(ids({})).toEqual(['Zapłacić czynsz', 'Wymienić olej', 'Kupić prezent', 'Przeczytać książkę']);
  });
  it('zrobione — najświeższe na górze', () => {
    expect(ids({ status: 'done' })).toEqual(['Umyć auto', 'Odkurzyć']);
  });
  it('termin: zaległe / dziś / tydzień / bez', () => {
    expect(ids({ due: 'overdue' })).toEqual(['Zapłacić czynsz']);
    expect(ids({ due: 'today' })).toEqual(['Wymienić olej']);
    expect(ids({ due: 'week' })).toEqual(['Wymienić olej', 'Kupić prezent']);
    expect(ids({ due: 'none' })).toEqual(['Przeczytać książkę']);
  });
  it('tag i tekst bez polskich znaków', () => {
    expect(ids({ status: 'all', tag: 'auto' })).toEqual(['Wymienić olej', 'Umyć auto']);
    expect(ids({ q: 'ksiazk' })).toEqual(['Przeczytać książkę']);
  });
  it('licznik aktywnych filtrów', () => {
    expect(taskFilterCount(EMPTY_TASK_FILTER)).toBe(0);
    expect(taskFilterCount({ q: 'a', status: 'done', due: 'week', tag: 'x' })).toBe(4);
  });
});
