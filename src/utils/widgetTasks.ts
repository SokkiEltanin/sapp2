import type { Task } from '@/types/calendar';
import { deadlineLabel, parseDeadline } from './taskDeadline';

// Wybór i formatowanie zadań pod widget pulpitu (2026-11-13). Czyste (zero RN) —
// services/widgetSync.ts zapisuje wynik do pliku, natywny TasksWidgetProvider.kt
// tylko go renderuje. Kolejność: zaległe → z terminem rosnąco → bez terminu
// (najnowsze pierwsze). Kropka: czerwona zaległe, jasna dziś, szara reszta.
export interface WidgetTaskRow { id: string; title: string; sub: string; color: string; overdue: boolean }
export interface WidgetSnapshot { header: string; rows: WidgetTaskRow[] }

export function buildWidgetSnapshot(tasks: Task[], now: Date = new Date(), limit = 6): WidgetSnapshot {
  const pending = tasks.filter((t) => t.status === 'pending');
  const sorted = [...pending].sort((a, b) => {
    if (a.deadline && b.deadline) return parseDeadline(a.deadline).getTime() - parseDeadline(b.deadline).getTime();
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const rows = sorted.slice(0, limit).map((t) => {
    // Kolory kropek czytelne na ciemnym tle (2026-11-14 — #3A3A3A/#6E6E6E ginęły przy 80% czerni).
    if (!t.deadline) return { id: t.id, title: t.title, sub: '', color: '#8A8A8A', overdue: false };
    const { text, overdue } = deadlineLabel(t.deadline, now);
    const d = parseDeadline(t.deadline);
    const isToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === today;
    return { id: t.id, title: t.title, sub: text.replace(/^Zaległe · /, ''), color: overdue ? '#F87171' : isToday ? '#F2F2F2' : '#B5B5B5', overdue };
  });
  const overdueCount = pending.filter((t) => t.deadline && deadlineLabel(t.deadline, now).overdue).length;
  const header = pending.length === 0 ? 'ZADANIA'
    : `ZADANIA · ${pending.length}${overdueCount > 0 ? ` · ${overdueCount} ZALEGŁE` : ''}`;
  return { header, rows };
}
