import type { Task, CalendarEvent } from '@/types/calendar';
import { eventCoversDay } from '@/types/calendar';
import { buildWidgetSnapshot } from './widgetTasks';

// Dane dla zegarka Wear OS. Telefon wysyła ten JSON przez Wear Data Layer
// (plugins/withWearSync.js → /sapp2/snapshot), appka na zegarku (wear/) go wyświetla.
// 2026-11-16 (user: "na zegarku nie chciałem sumy wydatków, głównie zadania,
// ewentualnie kalendarz / praca"): BEZ wydatków; zadania z krokami (zegarek odhacza
// kroki → /sapp2/step), wydarzenia dziś i jutro (praca = wydarzenia z tagiem, np. [JD]).
export interface WearStep { id: string; title: string; done: boolean }
export interface WearEvent { day: 'dziś' | 'jutro'; time: string; title: string; color: string }
export interface WearSnapshot {
  t: number;
  day: string;     // RRRR-MM-DD snapshotu — zegarek nie pokaże wczorajszego "dziś" po północy
  tasks: { id: string; title: string; sub: string; overdue: boolean; steps: WearStep[] }[];
  events: WearEvent[];
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function wearEvents(events: CalendarEvent[], now: Date = new Date(), limit = 10): WearEvent[] {
  const today = ymd(now);
  const tomorrow = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const nowHM = hm(now);
  const out: WearEvent[] = [];
  for (const [day, key] of [['dziś', today], ['jutro', tomorrow]] as const) {
    const list = events
      .filter((e) => eventCoversDay(e, key))
      // Dziś: bez tych, które już się skończyły.
      .filter((e) => day !== 'dziś' || e.allDay || !(e.endTime ?? e.startTime) || (e.endTime ?? e.startTime)! > nowHM)
      .sort((a, b) => Number(!a.allDay) - Number(!b.allDay) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    for (const e of list) {
      out.push({
        day,
        time: e.allDay || !e.startTime ? 'cały dzień' : `${e.startTime}${e.endTime ? `–${e.endTime}` : ''}`,
        title: e.title,
        color: e.color || '#A3A3A3',
      });
    }
  }
  return out.slice(0, limit);
}

export function buildWearSnapshot(tasks: Task[], events: CalendarEvent[], now: Date = new Date()): WearSnapshot {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return {
    t: now.getTime(),
    day: ymd(now),
    tasks: buildWidgetSnapshot(tasks, now, 10).rows.map((r) => ({
      id: r.id, title: r.title, sub: r.sub, overdue: r.overdue,
      steps: (byId.get(r.id)?.subtasks ?? []).slice(0, 10).map((s) => ({ id: s.id, title: s.title, done: s.done })),
    })),
    events: wearEvents(events, now),
  };
}
