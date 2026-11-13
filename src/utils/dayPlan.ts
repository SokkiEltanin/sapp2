import type { CalendarEvent, Task } from '@/types/calendar';
import { eventCoversDay } from '@/types/calendar';
import { shiftClockRange } from './workEvents';

// Plan dnia w Daily (2026-11-13, user: "plan lekcji / plan pracy na dzień, tylko
// z tymi tagami, które ja chcę, i z zadaniami, jeżeli mam zaplanowane na konkretny
// dzień... a pod spodem zapowiedź jutra: jutro masz zajęcia od tej do tej").
// Tag = prefiks tytułu w nawiasach kwadratowych ("[UR] Analiza", "[JD] 08:00 -
// 16:00"), ten sam co `splitTag` w ui/layout.tsx. `tags === null` = wszystkie.
export function tagOf(title: string): string | null {
  const m = (title ?? '').match(/^\s*\[([^\]]+)\]/);
  return m ? m[1].trim() : null;
}
const stripTag = (title: string) => (title ?? '').replace(/^\s*\[[^\]]+\]\s*/, '');

export interface PlanItem {
  id: string;
  kind: 'event' | 'task';
  tag: string | null;
  title: string;
  start: string | null; // HH:MM
  end: string | null;
  allDay: boolean;
  color?: string;
}

const isTimeOnly = (s: string) => /^\s*\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}\s*$/.test(s);

export function dayPlan(events: CalendarEvent[], tasks: Task[], day: string, tags: string[] | null): PlanItem[] {
  const want = tags ? new Set(tags.map((t) => t.toLowerCase())) : null;
  const items: PlanItem[] = [];
  for (const e of events) {
    if (!eventCoversDay(e, day)) continue;
    const tag = tagOf(e.title);
    if (want && (!tag || !want.has(tag.toLowerCase()))) continue;
    const r = shiftClockRange(e);
    const rest = stripTag(e.title);
    items.push({
      id: e.id, kind: 'event', tag,
      // "[JD] 08:00 - 16:00" → tytuł = sam tag (godziny i tak są w kolumnie czasu)
      title: isTimeOnly(rest) || !rest ? (tag ?? 'Wydarzenie') : rest,
      start: e.allDay && !r ? null : (r?.start ?? e.startTime ?? null),
      end: e.allDay && !r ? null : (r?.end ?? e.endTime ?? null),
      allDay: !!e.allDay && !r,
      color: e.color,
    });
  }
  for (const t of tasks) {
    if (t.status !== 'pending') continue;
    const dl = t.deadline?.slice(0, 10);
    if (t.scheduledDate !== day && dl !== day) continue;
    const time = t.scheduledDate === day && t.scheduledTime ? t.scheduledTime
      : (t.deadline && t.deadline.includes('T') ? t.deadline.slice(11, 16) : null);
    items.push({ id: t.id, kind: 'task', tag: tagOf(t.title), title: stripTag(t.title) || t.title, start: time, end: null, allDay: !time });
  }
  return items.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    if (a.kind !== b.kind && (!a.start || !b.start)) return a.kind === 'event' ? -1 : 1;
    return (a.start ?? '99').localeCompare(b.start ?? '99');
  });
}

// Skrót dnia per tag: "[UR] 08:00–15:30 · [JD] 16:00–22:00" (+ "2 zadania").
export function daySummary(items: PlanItem[]): string {
  const groups = new Map<string, { start: string | null; end: string | null; n: number }>();
  let tasksN = 0;
  for (const it of items) {
    if (it.kind === 'task') { tasksN++; continue; }
    const key = it.tag ?? it.title;
    const g = groups.get(key) ?? { start: null, end: null, n: 0 };
    g.n++;
    if (it.start && (!g.start || it.start < g.start)) g.start = it.start;
    const e = it.end ?? it.start;
    if (e && (!g.end || e > g.end)) g.end = e;
    groups.set(key, g);
  }
  const parts = [...groups.entries()].map(([k, g]) => {
    const label = items.find((x) => (x.tag ?? x.title) === k)?.tag ? `[${k}]` : k;
    if (!g.start) return label;
    return `${label} ${g.start}${g.end && g.end !== g.start ? `–${g.end}` : ''}`;
  });
  if (tasksN) parts.push(`${tasksN} ${tasksN === 1 ? 'zadanie' : tasksN < 5 ? 'zadania' : 'zadań'}`);
  return parts.join(' · ');
}

// Tagi z wydarzeń (±60 dni) z liczbą wystąpień — do wyboru w Daily.
export function knownEventTags(events: CalendarEvent[], now: Date = new Date()): { tag: string; count: number }[] {
  const from = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 60 * 86400000).toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  for (const e of events) {
    const d = (e.date ?? '').slice(0, 10);
    if (d < from || d > to) continue;
    const t = tagOf(e.title);
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}
