import type { Task, CalendarEvent } from '@/types/calendar';
import { eventCoversDay } from '@/types/calendar';
import { buildWidgetSnapshot } from './widgetTasks';
import type { Employer } from '@/types/work';
import type { Expense } from '@/types/finances';
import type { MoodEntry } from '@/types/mood';
import { isWorkEvent, shiftClockRange } from './workEvents';
import { computeWorkRate } from './workRate';

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
  // 2026-11-21 (user: "jak jestem w pracy ile zarabiam na sekundę… ładnie dodające się
  // liczby, jak wykrywa z kalendarza że jestem w pracy"): zmiany z kalendarza od wczoraj
  // do jutra, czasy bezwzględne (ms) — zegarek sam liczy na żywo, także bez telefonu.
  work?: WearShift[];
  // Humor dziś (zegarek pokazuje "zapisane" albo zachętę) — dzień = `day` snapshotu.
  mood?: { n: number; mood: number | null; energy: number | null };
}
export interface WearShift { name: string; color: string; s: number; e: number; rate: number }

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

/**
 * Zmiany pracy dla zegarka: wydarzenia pracy (kolor/prefiks pracodawcy, jak w Finansach →
 * Praca) z godzinami z tytułu (shiftClockRange), stawka = computeWorkRate (ta sama co w
 * Finansach). Od wczoraj (zmiana przez północ) do jutra, bez zakończonych.
 */
export function wearShifts(employers: Employer[], events: CalendarEvent[], expenses: Expense[], now: Date = new Date()): WearShift[] {
  const days = [-1, 0, 1].map((k) => ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + k)));
  const out: WearShift[] = [];
  for (const emp of employers) {
    if (emp.hidden || emp.workMode === 'manual' || !(emp.workColor || emp.workPrefix)) continue;
    const opts = { workColor: emp.workColor, workPrefix: emp.workPrefix };
    const mine = events.filter((e) => !e.allDay && days.includes((e.date ?? '').slice(0, 10)) && isWorkEvent(e, opts));
    if (!mine.length) continue;
    const rate = computeWorkRate(emp, events, expenses, now).rate;
    if (!rate || !isFinite(rate) || rate <= 0) continue;
    for (const e of mine) {
      const r = shiftClockRange(e);
      if (!r) continue;
      const [y, m, d] = e.date.slice(0, 10).split('-').map(Number);
      const [sh, sm] = r.start.split(':').map(Number);
      const [eh, em] = r.end.split(':').map(Number);
      const s = new Date(y, m - 1, d, sh, sm).getTime();
      let end = new Date(y, m - 1, d, eh, em).getTime();
      if (end <= s) end += 24 * 3600 * 1000;
      if (end <= now.getTime()) continue;
      out.push({ name: emp.name, color: emp.workColor || e.color || '#4ADE80', s, e: end, rate: Math.round(rate * 100) / 100 });
    }
  }
  return out.sort((a, b) => a.s - b.s).slice(0, 4);
}

export function wearMoodToday(entries: MoodEntry[], now: Date = new Date()): WearSnapshot['mood'] {
  const today = entries.filter((e) => e.date === ymd(now)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = today[today.length - 1];
  return { n: today.length, mood: last ? Math.round(last.mood * 100) / 100 : null, energy: last ? Math.round(last.energy * 100) / 100 : null };
}

export interface WearExtras { employers?: Employer[]; expenses?: Expense[]; mood?: MoodEntry[] }

export function buildWearSnapshot(tasks: Task[], events: CalendarEvent[], now: Date = new Date(), extras: WearExtras = {}): WearSnapshot {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return {
    t: now.getTime(),
    day: ymd(now),
    tasks: buildWidgetSnapshot(tasks, now, 10).rows.map((r) => ({
      id: r.id, title: r.title, sub: r.sub, overdue: r.overdue,
      steps: (byId.get(r.id)?.subtasks ?? []).slice(0, 10).map((s) => ({ id: s.id, title: s.title, done: s.done })),
    })),
    events: wearEvents(events, now),
    work: extras.employers?.length ? wearShifts(extras.employers, events, extras.expenses ?? [], now) : [],
    mood: wearMoodToday(extras.mood ?? [], now),
  };
}
