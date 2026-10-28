// Port z sapp (src/types/index.ts) — Faza 1 "Kalendarz" portu (user: "najpierw
// zostawiamy z sapp... kalendarz (obustronny edytowalny — na nim opieramy plan,
// pracę itp)"). `CalendarEvent` 1:1, bez zmian. `Task` ZAMIERZENIE trimmed —
// usunięte pola wiążące się z funkcjami, których sapp2 jeszcze nie ma i które nie
// są same z siebie uniwersalne (nie "zabieramy całość na przyszłość", tylko to co
// realnie coś reprezentuje TU):
//   - `counterId` — link do Licznika (odliczanie), sapp2 nie ma jeszcze tego konceptu.
//   - `classEventId`/`classEventLabel`/`classReminderMinutesBefore` — Plan zajęć,
//     sapp-only feature.
//   - `postCompletionMood` — integracja z trackerem nastroju, nie portowanym (jeszcze).
//   - `kind`/`waitingFor`/`wakeAt` — model quick/deep/waiting z sapp'owej listy
//     zadań; ARCHITECTURE.md (sekcja ZADANIA) mówi wprost "UI/UX zupełnie nowy" dla
//     tej zakładki — ciągnięcie starego modelu klasyfikacji do warstwy danych PRZED
//     zaprojektowaniem nowego UX byłoby zgadywaniem, nie portem.
export type EventPriority = 'high' | 'normal' | 'low';
export type TaskStatus = 'pending' | 'done' | 'snoozed';
export type TaskRecurring = 'none' | 'daily' | 'weekly' | 'monthly';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;        // ISO date — dzień startu (wielodniowy: pierwszy dzień)
  endDate?: string;    // YYYY-MM-DD — ostatni dzień (wielodniowy 16.08→24.08); brak = jednodniowy
  startTime?: string;  // HH:mm
  endTime?: string;
  allDay: boolean;
  priority: EventPriority;
  color?: string;
  createdAt: string;
}

// Czy event OBEJMUJE dany dzień (YYYY-MM-DD) — jednodniowy: tylko swój dzień;
// wielodniowy: od date do endDate włącznie.
export function eventCoversDay(e: CalendarEvent, dayYMD: string): boolean {
  const start = (e.date || '').slice(0, 10);
  if (!start) return false;
  const end = (e.endDate || start).slice(0, 10);
  return dayYMD >= start && dayYMD <= end;
}
// Wielodniowy? (endDate po dacie startu)
export function isMultiDay(e: CalendarEvent): boolean {
  return !!e.endDate && e.endDate.slice(0, 10) > e.date.slice(0, 10);
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  deadline?: string;        // ISO date
  scheduledDate?: string;   // YYYY-MM-DD — day it's planned for
  scheduledTime?: string;   // HH:MM — optional time slot
  status: TaskStatus;
  priority: EventPriority;
  estimatedPomodoros?: number;
  completedPomodoros?: number;
  tags: string[];
  snoozedUntil?: string;
  recurring?: TaskRecurring;
  subtasks?: Subtask[];
  reminderTime?: string;    // HH:mm — custom reminder time
  reminderDate?: string;    // YYYY-MM-DD — day the reminder fires; independent of deadline
  reminderMessage?: string; // custom notification text
  createdAt: string;
  updatedAt: string;
}
