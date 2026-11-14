import type { CalendarEvent } from '@/types/calendar';

// Kopia wydarzeń Kalendarza Google dla komputera (2026-11-14, user: "nie ładuje się
// kalendarz" na wersji webowej). Telefon pobiera je natywnym logowaniem Google (na
// stronie go nie ma) — więc wysyła okno wydarzeń przez synchronizację (dokument
// `sync_docs/gcal`, services/cloudSync.ts), a komputer tylko je czyta. Okno i limit
// trzymają dokument daleko od limitu 1 MB Firestore.
export const GCAL_MIRROR_DAYS_BACK = 45;
export const GCAL_MIRROR_DAYS_FORWARD = 180;
export const GCAL_MIRROR_MAX = 1200;
const DESC_MAX = 300;

const ymdShift = (now: Date, days: number) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function gcalMirror(events: CalendarEvent[], now: Date = new Date()): CalendarEvent[] {
  const from = ymdShift(now, -GCAL_MIRROR_DAYS_BACK);
  const to = ymdShift(now, GCAL_MIRROR_DAYS_FORWARD);
  return events
    .filter((e) => {
      const start = (e.date || '').slice(0, 10);
      const end = (e.endDate || start).slice(0, 10);
      return !!start && end >= from && start <= to;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .slice(0, GCAL_MIRROR_MAX)
    .map((e) => {
      const out: CalendarEvent = { ...e };
      if (out.description && out.description.length > DESC_MAX) out.description = `${out.description.slice(0, DESC_MAX)}…`;
      for (const k of Object.keys(out) as (keyof CalendarEvent)[]) if (out[k] === undefined) delete out[k];
      return out;
    });
}
