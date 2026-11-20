import type { MoodEntry } from '@/types/mood';

// Zachęta do wpisu humoru (2026-11-18, user: "zachęcić do wpisywania humoru, jak nie został
// wpisany danego dnia"). Czyste funkcje (__tests__/moodReminder.test.ts); natywne
// powiadomienia: services/moodReminders.ts, kafel: app/(tabs)/daily.tsx.
export const MOOD_REMINDER_PREFIX = 'mood-rem-';
export const MOOD_QUICK_PREFIX = 'mood-q-';           // akcja powiadomienia: mood-q-2 / -3 / -4
export const MOOD_QUICK: { level: number; label: string }[] = [
  { level: 2, label: 'Słabo' }, { level: 3, label: 'OK' }, { level: 4, label: 'Dobrze' },
];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Seria: kolejne dni z wpisem kończące się dziś (albo wczoraj, gdy dziś jeszcze brak). */
export function moodStreak(entries: Pick<MoodEntry, 'date'>[], now: Date = new Date()): { days: number; today: boolean } {
  const set = new Set(entries.map((e) => e.date));
  const today = set.has(ymd(now));
  let n = 0;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (today ? 0 : 1));
  while (set.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
  return { days: n, today };
}

export interface MoodReminderPlan { id: string; date: string; fireAt: number; body: string }

/**
 * Przypomnienia na najbliższe `days` dni o godzinie hh:mm — tylko dni BEZ wpisu i w
 * przyszłości (dzień z wpisem / minione = brak). Dziś: tekst z bieżącą serią.
 */
export function planMoodReminders(entries: Pick<MoodEntry, 'date'>[], now: Date, cfg: { enabled: boolean; hour: number; minute: number }, days = 7): MoodReminderPlan[] {
  if (!cfg.enabled) return [];
  const has = new Set(entries.map((e) => e.date));
  const streak = moodStreak(entries, now);
  const out: MoodReminderPlan[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, cfg.hour, cfg.minute, 0, 0);
    const date = ymd(d);
    if (has.has(date) || d.getTime() <= now.getTime()) continue;
    const body = i === 0 && streak.days > 0
      ? `Seria ${streak.days} ${streak.days === 1 ? 'dzień' : 'dni'} — wpisz, żeby jej nie przerwać.`
      : 'Jedno stuknięcie wystarczy.';
    out.push({ id: MOOD_REMINDER_PREFIX + date, date, fireAt: d.getTime(), body });
  }
  return out;
}
