import type { Task } from '@/types/calendar';
import { normText } from './categoryRules';

// Szukanie i filtry zadań (2026-11-14, z listy "czego brakuje" — wzór: Finanse →
// Transakcje). Też jedyne miejsce, gdzie widać UKOŃCZONE zadania (wcześniej znikały
// bez śladu po odhaczeniu). Czysta logika — testy __tests__/taskFilter.test.ts.
export type TaskStatusFilter = 'pending' | 'done' | 'all';
export type TaskDueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none';

export interface TaskFilter { q: string; status: TaskStatusFilter; due: TaskDueFilter; tag: string | null }
export const EMPTY_TASK_FILTER: TaskFilter = { q: '', status: 'pending', due: 'any', tag: null };

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export function matchesDue(t: Task, due: TaskDueFilter, today: string): boolean {
  const d = t.deadline?.slice(0, 10);
  switch (due) {
    case 'any': return true;
    case 'none': return !d;
    case 'overdue': return !!d && d < today;
    case 'today': return d === today;
    case 'week': return !!d && d >= today && d <= addDays(today, 6);
  }
}

export function filterTasks(tasks: Task[], f: TaskFilter, today: string): Task[] {
  const q = normText(f.q);
  const out = tasks.filter((t) => {
    if (f.status !== 'all' && (f.status === 'done' ? t.status !== 'done' : t.status === 'done')) return false;
    if (f.tag && !t.tags.includes(f.tag)) return false;
    if (!matchesDue(t, f.due, today)) return false;
    if (q && !normText(`${t.title} ${t.description ?? ''} ${t.tags.join(' ')}`).includes(q)) return false;
    return true;
  });
  // Ukończone: najświeższe na górze; do zrobienia: najbliższy termin, potem bez terminu.
  return out.sort((a, b) => {
    if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
    if (a.status === 'done') return b.updatedAt.localeCompare(a.updatedAt);
    const da = a.deadline?.slice(0, 10), db = b.deadline?.slice(0, 10);
    if (da && db) return da.localeCompare(db);
    if (da) return -1;
    if (db) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function taskFilterCount(f: TaskFilter): number {
  return (f.q.trim() ? 1 : 0) + (f.status !== 'pending' ? 1 : 0) + (f.due !== 'any' ? 1 : 0) + (f.tag ? 1 : 0);
}
