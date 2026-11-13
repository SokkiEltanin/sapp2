import type { ReplaceItem } from '@/types/replacements';
import { replaceDue } from './replacements';

// Plan przypomnień o wymianach (2026-11-13) — czysta decyzja "co i kiedy",
// natywne planowanie w services/replaceReminders.ts (ten sam wzorzec co
// utils/billReminders.ts). Jedno przypomnienie na rzecz: o 9:00 w dniu
// (nextDate − remindDaysBefore). Gdy ta pora minęła (termin już był) — jeszcze
// jedno "po terminie" następnego dnia o 9:00, potem cisza do kolejnej wymiany.
export const REPLACE_REMINDER_PREFIX = 'repl_';
export const REPLACE_REMINDER_HOUR = 9;

export interface PlannedReplaceReminder { id: string; itemId: string; fireAt: number; title: string; body: string }

const at9 = (ymd: string, minusDays: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d - minusDays, REPLACE_REMINDER_HOUR, 0, 0, 0);
};

export function planReplaceReminders(items: ReplaceItem[], now: Date = new Date()): PlannedReplaceReminder[] {
  const out: PlannedReplaceReminder[] = [];
  for (const it of items) {
    if (it.remindDaysBefore < 0) continue;
    const due = replaceDue(it, now);
    let fire = at9(due.nextDate, it.remindDaysBefore);
    let body: string;
    if (fire.getTime() > now.getTime()) {
      body = it.remindDaysBefore === 0 ? 'Dziś czas na wymianę.' : it.remindDaysBefore === 1 ? 'Wymiana jutro.' : `Wymiana za ${it.remindDaysBefore} dni.`;
    } else {
      // Po terminie: jedno przypomnienie dzień po terminie, jeśli jeszcze przed nami.
      fire = at9(due.nextDate, -1);
      if (fire.getTime() <= now.getTime()) continue;
      body = 'Termin wymiany minął wczoraj — wymienione? Zaznacz w appce.';
    }
    out.push({ id: `${REPLACE_REMINDER_PREFIX}${it.id}`, itemId: it.id, fireAt: fire.getTime(), title: it.name, body });
  }
  return out;
}
