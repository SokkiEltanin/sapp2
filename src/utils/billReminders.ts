import type { Subscription } from '@/types/subscriptions';
import { advanceNextBillingDate, isDurationExpired } from './recurringBills';
import { ymdLocal } from './dateMath';

// Plan przypomnień o Stałych opłatach (2026-11-11) — `reminderDaysBefore`
// ("Przypomnienie: 3 dni przed") było od początku ZAPISYWANE w formularzu, ale
// nic go nie planowało: martwy przełącznik (CLAUDE.md #7). Czysta funkcja —
// sama decyzja "co i kiedy", bez notifee (to w `services/billReminders.ts`),
// żeby dało się ją przetestować.
export const BILL_REMINDER_PREFIX = 'bill_';
export const BILL_REMINDER_HOUR = 9;

export interface PlannedBillReminder {
  id: string;        // `bill_<subId>` — ponowne zaplanowanie tego samego id ZASTĘPUJE poprzednie
  subscriptionId: string;
  fireAt: number;    // ms
  dueDate: string;   // YYYY-MM-DD
  title: string;
  body: string;
}

const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

function fireTimeFor(dueDate: string, daysBefore: number): Date {
  const d = new Date(`${dueDate}T00:00:00`);
  d.setDate(d.getDate() - daysBefore);
  d.setHours(BILL_REMINDER_HOUR, 0, 0, 0);
  return d;
}

function whenLabel(daysBefore: number): string {
  if (daysBefore === 1) return 'jutro';
  return `za ${daysBefore} dni`;
}

export function planBillReminders(subs: Subscription[], now: Date = new Date()): PlannedBillReminder[] {
  const today = ymdLocal(now);
  const out: PlannedBillReminder[] = [];
  for (const sub of subs) {
    if (!sub.active || !sub.reminderDaysBefore || sub.reminderDaysBefore <= 0) continue;
    if (isDurationExpired(sub)) continue;
    // Zaległa data (ekran Subskrypcji ją przesuwa, ale dopiero przy wejściu na
    // niego) — liczymy na następnym realnym terminie, bez zapisywania.
    let due = sub.nextBillingDate;
    let guard = 0;
    while (due <= today && guard++ < 120) due = advanceNextBillingDate(due, sub.billingCycle);
    // Okno przypomnienia na ten termin już minęło (np. ustawione dzień przed
    // płatnością wieczorem) → planujemy od razu na NASTĘPNY cykl, zamiast
    // odpalać spóźnione powiadomienie przy każdym starcie appki.
    let fire = fireTimeFor(due, sub.reminderDaysBefore);
    if (fire.getTime() <= now.getTime()) {
      due = advanceNextBillingDate(due, sub.billingCycle);
      fire = fireTimeFor(due, sub.reminderDaysBefore);
    }
    const [, m, d] = due.split('-').map(Number);
    out.push({
      id: `${BILL_REMINDER_PREFIX}${sub.id}`,
      subscriptionId: sub.id,
      fireAt: fire.getTime(),
      dueDate: due,
      title: `${sub.name} — ${whenLabel(sub.reminderDaysBefore)}`,
      body: `${sub.amount.toFixed(2).replace('.', ',')} zł · płatność ${d} ${MONTHS[m - 1]}`,
    });
  }
  return out.sort((a, b) => a.fireAt - b.fireAt);
}
