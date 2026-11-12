import type { Expense } from '@/types/finances';
import type { CalendarEvent } from '@/types/calendar';
import type { Employer } from '@/types/work';
import { computeWorkRate } from './workRate';
import { shiftsForEmployerInMonth } from './workSummary';
import { isPaycheck, paycheckTargetMonth } from './paycheck';

// Kafel "Praca" w Finansach (2026-11-11, user: "więcej info w kafelku pracy może
// ile wypłaty przyszłej oraz ile godzin przepracowanych z ilu oraz ile średnio na
// h wychodzi"). Jedno czyste miejsce, żeby kafel nie liczył niczego sam:
//   • hoursDone / hoursPlanned — zmiany tego miesiąca z kalendarza: ile już
//     MINĘŁO (trwająca zmiana liczy się częściowo) z ilu w ogóle zaplanowanych,
//   • rate — ta sama stawka co wszędzie (`computeWorkRate`, bez drugiej definicji),
//   • nextPay — NAJBLIŻSZA wypłata, której jeszcze nie ma w historii. Pensja idzie
//     z dołu, więc na początku miesiąca to zwykle jeszcze wypłata ZA POPRZEDNI
//     (gdy jej nie zaksięgowano), a po jej wpłynięciu — prognoza za bieżący
//     (wszystkie zaplanowane godziny × stawka).
// Tryb ręczny (bez kalendarza) nie zna zmian → godziny null, wypłata = pensja.
const pad = (n: number) => String(n).padStart(2, '0');
const ymOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

function at(date: string, hhmm: string): Date | null {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  if (!y || !m || !d || Number.isNaN(h) || Number.isNaN(mi)) return null;
  return new Date(y, m - 1, d, h, mi);
}

export interface WorkMonthProgress {
  rate: number | null;
  hoursDone: number | null;
  hoursPlanned: number | null;
  nextPay: { month: string; amount: number } | null;
  isCalendarMode: boolean;
}

export function workMonthProgress(emp: Employer, events: CalendarEvent[], expenses: Expense[], now: Date = new Date()): WorkMonthProgress {
  const wr = computeWorkRate(emp, events, expenses, now);
  const ym = ymOf(now);
  if (!wr.isCalendarMode) {
    return { rate: wr.rate, hoursDone: null, hoursPlanned: null, nextPay: wr.salaryUsed > 0 ? { month: ym, amount: wr.salaryUsed } : null, isCalendarMode: false };
  }

  const shifts = shiftsForEmployerInMonth(events, emp, ym);
  let hoursDone = 0;
  let hoursPlanned = 0;
  for (const sh of shifts) {
    hoursPlanned += sh.hours;
    const start = sh.startTime ? at(sh.date, sh.startTime) : null;
    if (!start) {
      // Bez godzin (całodniowa z ręcznie wpisanym czasem w tytule nie dała zakresu)
      // — liczy się jako przepracowana, gdy dzień już minął.
      if (sh.date < `${ym}-${pad(now.getDate())}`) hoursDone += sh.hours;
      continue;
    }
    const elapsed = (now.getTime() - start.getTime()) / 3_600_000;
    hoursDone += Math.min(sh.hours, Math.max(0, elapsed));
  }

  const rate = wr.rate;
  let nextPay: WorkMonthProgress['nextPay'] = null;
  if (rate != null && rate > 0) {
    const paychecks = expenses.filter((e) => isPaycheck(e, emp.workPrefix));
    const paidMonths = new Set(paychecks.map(paycheckTargetMonth));
    const prevYm = ymOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const prevHours = shiftsForEmployerInMonth(events, emp, prevYm).reduce((s, x) => s + x.hours, 0);
    // Tylko gdy wypłaty w ogóle są księgowane (≥1 w historii) — inaczej każdy
    // poprzedni miesiąc wyglądałby na "niewypłacony" na zawsze.
    if (paychecks.length > 0 && prevHours > 0 && !paidMonths.has(prevYm)) {
      nextPay = { month: prevYm, amount: prevHours * rate };
    } else if (hoursPlanned > 0) {
      nextPay = { month: ym, amount: hoursPlanned * rate };
    }
  }

  return { rate, hoursDone, hoursPlanned, nextPay, isCalendarMode: true };
}

// Najbliższe zmiany (ekran Praca, 2026-11-12 — CLAUDE.md zasada 10: dane na
// górze). Bieżący + następny miesiąc, tylko te, które jeszcze się nie skończyły.
export function upcomingShifts(
  emp: Employer, events: CalendarEvent[], now: Date = new Date(), limit = 3,
): { id: string; date: string; startTime: string; endTime: string; hours: number }[] {
  const ym = ymOf(now);
  const next = ymOf(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  return [...shiftsForEmployerInMonth(events, emp, ym), ...shiftsForEmployerInMonth(events, emp, next)]
    .filter((sh) => {
      const start = sh.startTime ? at(sh.date, sh.startTime) : null;
      if (!start) return sh.date >= `${ym}-${pad(now.getDate())}`;
      return start.getTime() + sh.hours * 3_600_000 > now.getTime();
    })
    .slice(0, limit);
}
