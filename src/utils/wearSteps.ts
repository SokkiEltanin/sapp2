import type { Task, Subtask } from '@/types/calendar';

// Kroki odhaczone na zegarku (2026-11-16): wiadomości "taskId|stepId|1" (zrobione) albo
// "|0" (odznaczone), w kolejności. Zwraca nowe listy kroków dla zmienionych zadań.
export function applyWearSteps(tasks: Task[], msgs: unknown[]): Map<string, Subtask[]> {
  const out = new Map<string, Subtask[]>();
  for (const m of msgs) {
    const [taskId, stepId, flag] = String(m).split('|');
    if (!taskId || !stepId) continue;
    const t = tasks.find((x) => x.id === taskId);
    if (!t || t.status === 'deleted') continue;
    const steps = out.get(taskId) ?? t.subtasks ?? [];
    if (!steps.some((s) => s.id === stepId)) continue;
    out.set(taskId, steps.map((s) => (s.id === stepId ? { ...s, done: flag !== '0' } : s)));
  }
  return out;
}
