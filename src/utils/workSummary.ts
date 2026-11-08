import type { Expense } from '@/types/finances';
import type { CalendarEvent } from '@/types/calendar';
import type { Employer } from '@/types/work';
import { isWorkEvent, shiftHours, shiftClockRange } from './workEvents';
import { isPaycheck } from './paycheck';
import { paycheckTargetMonth } from './paycheck';

// Port z sapp (src/utils/workSummary.ts) — zaadaptowany na `Employer` zamiast
// sapp's osobnego `WorkSettings` (patrz komentarz w src/types/work.ts: sapp2 nie
// trzyma mirrorowanego globalnego store'a, `Employer` SAM jest "ustawieniami").

export interface PayMonthRow {
  month: string;      // YYYY-MM za który jest wypłata
  amount: number;     // realna kwota wypłaty
  hours: number;      // godziny kalendarza tego miesiąca
  excluded: boolean;  // wykluczony przez usera ze średniej
  date: string;       // data wypłaty (YYYY-MM-DD)
  count: number;      // ile wypłat trafia w ten miesiąc (flaga duplikatu)
}

// Jeden wiersz na realną wypłatę (docelowy miesiąc + kwota + godziny kalendarza tego
// miesiąca), najnowsze pierwsze.
export function computePayMonths(expenses: Expense[], events: CalendarEvent[], emp: Pick<Employer, 'workPrefix' | 'workColor' | 'excludedPayMonths'>): PayMonthRow[] {
  const wp = (emp.workPrefix ?? '').trim();
  const wc = emp.workColor;
  if (!wp && !wc) return [];
  const isWork = (e: CalendarEvent) => isWorkEvent(e, { workColor: wc, workPrefix: wp.toLowerCase() });
  const hoursIn = (ym: string) => events
    .filter((e) => isWork(e) && (e.date ?? '').slice(0, 7) === ym)
    .reduce((s, e) => s + shiftHours(e), 0);
  const excluded = new Set(emp.excludedPayMonths ?? []);
  const paychecks = expenses
    .filter((e) => isPaycheck(e, wp))
    .sort((a, b) => b.date.localeCompare(a.date));
  const countByMonth: Record<string, number> = {};
  for (const p of paychecks) { const m = paycheckTargetMonth(p); countByMonth[m] = (countByMonth[m] ?? 0) + 1; }
  const seen = new Set<string>();
  const rows: PayMonthRow[] = [];
  for (const p of paychecks) {
    const month = paycheckTargetMonth(p);
    if (seen.has(month)) continue;
    seen.add(month);
    rows.push({ month, amount: p.amount, hours: hoursIn(month), excluded: excluded.has(month), date: p.date.slice(0, 10), count: countByMonth[month] });
  }
  return rows;
}

// Średnia zł/h = Σ(wliczona wypłata z godzinami) ÷ Σ(ich godziny) + suma zarobków.
export function payMonthsSummary(rows: PayMonthRow[]): { avgRate: number | null; includedCount: number; totalEarned: number } {
  let sal = 0, hrs = 0, cnt = 0, total = 0;
  for (const r of rows) {
    total += r.amount;
    if (!r.excluded && r.hours > 0) { sal += r.amount; hrs += r.hours; cnt++; }
  }
  return { avgRate: hrs > 0 ? sal / hrs : null, includedCount: cnt, totalEarned: total };
}

export interface EmployerPayMonthRow extends PayMonthRow {
  employerId: string;
  employerName: string;
  employerHidden: boolean;
}

// Łączy `computePayMonths` PER pracodawca w jedną, otagowaną listę — ekran Pracy
// filtruje po `employerId`, ukryci pracodawcy są WYŁĄCZENI z domyślnego (łącznego)
// widoku, ale ich wiersze ZOSTAJĄ w zwróconej liście (wywołujący decyduje czy pokazać).
export function computePayMonthsForEmployers(expenses: Expense[], events: CalendarEvent[], employers: Employer[]): EmployerPayMonthRow[] {
  const rows: EmployerPayMonthRow[] = [];
  for (const emp of employers) {
    const empRows = computePayMonths(expenses, events, emp);
    for (const r of empRows) rows.push({ ...r, employerId: emp.id, employerName: emp.name, employerHidden: !!emp.hidden });
  }
  return rows.sort((a, b) => b.month.localeCompare(a.month));
}

// Jak `payMonthsSummary`, ale tylko po widocznych (nie `hidden`) pracodawcach —
// domyślny widok "łącznie". `includeHidden:true` pokazuje chwilowo wszystko.
export function employerPayMonthsSummary(rows: EmployerPayMonthRow[], opts: { includeHidden?: boolean } = {}): { avgRate: number | null; includedCount: number; totalEarned: number } {
  return payMonthsSummary(opts.includeHidden ? rows : rows.filter((r) => !r.employerHidden));
}

export interface EmployerShift {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
}

// Pojedyncze zmiany danego pracodawcy w danym miesiącu ("mini-kalendarz jak
// pracowałem i ile zarobiłem").
export function shiftsForEmployerInMonth(events: CalendarEvent[], emp: Pick<Employer, 'workPrefix' | 'workColor'>, ym: string): EmployerShift[] {
  const wp = (emp.workPrefix ?? '').trim().toLowerCase();
  const wc = emp.workColor;
  if (!wp && !wc) return [];
  return events
    .filter((e) => isWorkEvent(e, { workColor: wc, workPrefix: wp }) && (e.date ?? '').slice(0, 7) === ym)
    .map((e) => {
      const r = shiftClockRange(e);
      return {
        id: e.id, title: e.title ?? '', date: (e.date ?? '').slice(0, 10),
        startTime: r?.start ?? e.startTime ?? '', endTime: r?.end ?? e.endTime ?? '',
        hours: shiftHours(e),
      };
    })
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}
