import type { Task } from '@/types/calendar';
import { deadlineHasTime, parseDeadline } from './taskDeadline';

// Przypomnienia o zadaniach (2026-11-14) — zadanie z DOKŁADNĄ godziną ("Dokładny
// termin" w formularzu) dostaje powiadomienie o tej godzinie z przyciskiem
// "Zrobione". Czysta decyzja "co i kiedy"; natywne planowanie: services/taskReminders.ts
// (ten sam wzorzec co przypomnienia o wymianach i opłatach). Własna godzina
// przypomnienia (`reminderDate` + `reminderTime`, pola z sapp) ma pierwszeństwo.
export const TASK_REMINDER_PREFIX = 'task_';
/** id przycisku "Zrobione" w powiadomieniu. */
export const TASK_DONE_ACTION = 'task_done';
const HORIZON_DAYS = 60;
const MAX = 40; // Android ma limit alarmów na appkę — najbliższe wystarczą, reszta przy kolejnym otwarciu.

export interface PlannedTaskReminder { id: string; taskId: string; fireAt: number; title: string; body: string }

function fireTime(t: Task): Date | null {
  if (t.reminderDate && t.reminderTime && /^\d{2}:\d{2}$/.test(t.reminderTime)) return new Date(`${t.reminderDate}T${t.reminderTime}:00`);
  if (t.deadline && deadlineHasTime(t.deadline)) return parseDeadline(t.deadline);
  return null;
}

export function planTaskReminders(tasks: Task[], now: Date = new Date()): PlannedTaskReminder[] {
  const limit = now.getTime() + HORIZON_DAYS * 86400000;
  const out: PlannedTaskReminder[] = [];
  for (const t of tasks) {
    if (t.status === 'done') continue;
    const at = fireTime(t);
    if (!at || isNaN(at.getTime())) continue;
    const ms = at.getTime();
    if (ms <= now.getTime() || ms > limit) continue;
    const hhmm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
    const tags = t.tags.length ? ` · #${t.tags.join(' #')}` : '';
    out.push({ id: `${TASK_REMINDER_PREFIX}${t.id}`, taskId: t.id, fireAt: ms, title: t.title, body: t.reminderMessage || `Zadanie na ${hhmm}${tags}` });
  }
  return out.sort((a, b) => a.fireAt - b.fireAt).slice(0, MAX);
}
