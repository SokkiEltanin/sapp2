import type { Task, Subtask } from '@/types/calendar';

// Kamienie milowe i motywacja (2026-11-16, user: "zadania zrób serio lepiej...
// żeby motywowało... kamienie milowe, że do ukończenia muszę jeszcze zrobić to i
// to... widać na widgecie, na zakładce i po kliknięciu"). `Task.subtasks` = kroki.
// Czyste funkcje — TaskRow, TaskDetailSheet, widget (utils/widgetTasks.ts), Daily.

export interface TaskProgress { done: number; total: number; pct: number; next: Subtask | null }

export function taskProgress(t: Pick<Task, 'subtasks'>): TaskProgress {
  const steps = t.subtasks ?? [];
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, pct: steps.length ? done / steps.length : 0, next: steps.find((s) => !s.done) ?? null };
}

// Krótki napis pod postępem — co zostało, zamiast suchych liczb.
export function progressLine(p: TaskProgress): string {
  if (!p.total) return 'Rozbij zadanie na kroki — łatwiej zacząć.';
  const left = p.total - p.done;
  if (left === 0) return 'Wszystkie kroki zrobione — odhacz zadanie!';
  if (p.done === 0) return `Zacznij od: ${p.next!.title}`;
  if (left === 1) return `Został ostatni krok: ${p.next!.title}`;
  if (p.pct >= 0.5) return `Ponad połowa za Tobą. Dalej: ${p.next!.title}`;
  return `Następny krok: ${p.next!.title}`;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Kiedy zadanie zostało zrobione: `completedAt` (od 2026-11-16), dla starszych `updatedAt`.
export const completedDay = (t: Task): string | null =>
  t.status === 'done' ? dayKey(new Date(t.completedAt ?? t.updatedAt)) : null;

export interface DoneStats { today: number; week: number; streak: number }

// Seria = dni z rzędu z co najmniej jednym zrobionym zadaniem, licząc od dziś
// (albo od wczoraj, jeśli dziś jeszcze nic — seria wciąż żyje do końca dnia).
export function doneStats(tasks: Task[], now: Date = new Date()): DoneStats {
  const days = new Map<string, number>();
  for (const t of tasks) {
    const k = completedDay(t);
    if (k) days.set(k, (days.get(k) ?? 0) + 1);
  }
  const at = (i: number) => dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
  let week = 0;
  for (let i = 0; i < 7; i++) week += days.get(at(i)) ?? 0;
  let streak = 0;
  for (let i = days.has(at(0)) ? 0 : 1; days.has(at(i)); i++) streak++;
  return { today: days.get(at(0)) ?? 0, week, streak };
}

// Napis po odhaczeniu zadania.
export function cheer(stats: DoneStats): string {
  if (stats.today >= 5) return `${stats.today}. zadanie dziś — świetny dzień!`;
  if (stats.today > 1) return `To już ${stats.today}. zadanie dziś.`;
  if (stats.streak > 1) return `Seria: ${stats.streak} dni z rzędu.`;
  return 'Pierwsze dziś — tak trzymaj.';
}

export const newStep = (title: string): Subtask => ({ id: `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, title: title.trim(), done: false });
