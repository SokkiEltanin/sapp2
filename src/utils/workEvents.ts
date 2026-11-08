import type { CalendarEvent } from '@/types/calendar';

// Port z sapp (src/utils/workEvents.ts) — podzbiór: tylko funkcje które statyczne
// (nie-żywe) liczenie stawki/godzin faktycznie potrzebuje. `shiftFireTimes`/
// `elapsedShiftHours` ŚWIADOMIE NIE portowane — służyły planowaniu powiadomień
// początek/koniec zmiany i "ile już przepracowano DZIŚ" dla żywego licznika, których
// sapp2 nie ma (patrz komentarz w src/types/work.ts).
//
// Zmiany pracy często żyją w Kalendarzu Google, gdzie własne godziny eventu to
// powtarzalny domyślny zakres (np. 09:00–17:00), a REALNE przepracowane godziny są
// wpisane w tytule, np. "[JD] 10:00 - 21:00. (11h)". Tytuł jest źródłem prawdy: czyta
// się z niego zakres "HH:MM - HH:MM" (albo znacznik "(Nh)"), a dopiero gdy tytuł nie ma
// żadnego z nich, używa się własnych godzin eventu.

const TIME_RANGE_RE = /(\d{1,2})[:.](\d{2})\s*(?:[-–—]|do)\s*(\d{1,2})[:.](\d{2})/i;
const HOUR_RANGE_RE = /(?:^|\s|\])\s*(?:od\s*)?(\d{1,2})\s*(?:[-–—]|do)\s*(\d{1,2})(?=\s|\.|$|\()/i;
const HOURS_PAREN_RE = /\(\s*(\d+(?:[.,]\d+)?)\s*h\s*\)/i;

function minToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function titleTimeRange(title?: string): { startMin: number; endMin: number } | null {
  if (!title) return null;
  const m = title.match(TIME_RANGE_RE);
  if (m) {
    const s = (+m[1]) * 60 + (+m[2]);
    let e = (+m[3]) * 60 + (+m[4]);
    if (e <= s) e += 24 * 60;
    return { startMin: s, endMin: e };
  }
  const h = title.match(HOUR_RANGE_RE);
  if (h) {
    const sh = +h[1], eh = +h[2];
    if (sh <= 24 && eh <= 24 && sh !== eh) {
      let s = sh * 60; let e = eh * 60;
      if (e <= s) e += 24 * 60;
      return { startMin: s, endMin: e };
    }
  }
  return null;
}

export function shiftClockRange(ev: Pick<CalendarEvent, 'title' | 'startTime' | 'endTime'>): { start: string; end: string } | null {
  const tr = titleTimeRange(ev.title);
  if (tr) return { start: minToHHMM(tr.startMin), end: minToHHMM(tr.endMin) };
  if (ev.startTime && ev.endTime) return { start: ev.startTime, end: ev.endTime };
  return null;
}

export function shiftMinutes(ev: Pick<CalendarEvent, 'title' | 'startTime' | 'endTime'>): number {
  const tr = titleTimeRange(ev.title);
  if (tr) return tr.endMin - tr.startMin;
  if (ev.title) {
    const h = ev.title.match(HOURS_PAREN_RE);
    if (h) return Math.round(parseFloat(h[1].replace(',', '.')) * 60);
  }
  if (ev.startTime && ev.endTime) {
    let d = hhmmToMin(ev.endTime) - hhmmToMin(ev.startTime);
    if (d < 0) d += 24 * 60;
    return Math.max(0, d);
  }
  return 0;
}

export function shiftHours(ev: Pick<CalendarEvent, 'title' | 'startTime' | 'endTime'>): number {
  return shiftMinutes(ev) / 60;
}

export function isWorkEvent(
  ev: Pick<CalendarEvent, 'title' | 'startTime' | 'endTime' | 'color'>,
  opts: { workColor?: string; workPrefix?: string },
): boolean {
  const wc = opts.workColor;
  const wp = opts.workPrefix?.trim().toLowerCase();
  const hasTimes = (!!ev.startTime && !!ev.endTime) || !!titleTimeRange(ev.title) || HOURS_PAREN_RE.test(ev.title ?? '');
  if (!hasTimes) return false;
  if (wc && ev.color === wc) return true;
  if (wp && (ev.title ?? '').toLowerCase().startsWith(wp)) return true;
  return false;
}
