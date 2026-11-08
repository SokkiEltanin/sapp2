import type { Expense } from '@/types/finances';
import type { CalendarEvent } from '@/types/calendar';
import type { Employer } from '@/types/work';
import { isWorkEvent, shiftMinutes } from './workEvents';
import { isPaycheck, paycheckTargetMonth } from './paycheck';

// Statyczny odpowiednik sapp's `useWorkEarnings.ts`'s `perSecond` — TA SAMA kolejność
// pierwszeństwa (nadpisanie stawki → średnia napędzana wypłatami → potwierdzone
// miesiące → nadpisanie godzin/poprzedni miesiąc → ręczny tryb), ale zwraca zł/h, nie
// zł/s, i bez żywego tickera/aktywnej zmiany/`setInterval` (patrz src/types/work.ts —
// świadomie nieportowane, osobna, większa funkcja).
const pad = (n: number) => String(n).padStart(2, '0');
const ymOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export interface WorkRateResult {
  rate: number | null; // zł/h
  monthWorkHours: number; // godziny tego (częściowego) miesiąca, do teraz
  salaryUsed: number;
  isCalendarMode: boolean;
}

export function computeWorkRate(emp: Employer, events: CalendarEvent[], expenses: Expense[], now: Date = new Date()): WorkRateResult {
  const isCalendarMode = emp.workMode !== 'manual' && !!(emp.workColor || emp.workPrefix);
  const wc = emp.workColor;
  const wp = emp.workPrefix?.trim().toLowerCase();

  const workEvents = isCalendarMode ? events.filter((e) => isWorkEvent(e, { workColor: wc, workPrefix: wp })) : [];
  const hoursForMonth = (ym: string) => workEvents
    .filter((e) => (e.date ?? '').slice(0, 7) === ym)
    .reduce((s, e) => s + shiftMinutes(e), 0) / 60;

  const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const monthWorkHours = workEvents
    .filter((e) => (e.date ?? '').slice(0, 10) >= monthStart)
    .reduce((s, e) => s + shiftMinutes(e), 0) / 60;

  // Wypłata z przychodów otagowanych prefiksem pracodawcy — najnowsza wygrywa.
  const paychecks = isCalendarMode
    ? expenses.filter((e) => isPaycheck(e, emp.workPrefix)).sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const lastPaycheck = paychecks[0] ?? null;
  const salaryUsed = (emp.salaryOverride && emp.salaryOverride > 0) ? emp.salaryOverride : (lastPaycheck?.amount ?? emp.monthlySalary);

  // 1) Stałe nadpisanie stawki wygrywa zawsze.
  if (emp.rateOverride && emp.rateOverride > 0) {
    return { rate: emp.rateOverride, monthWorkHours, salaryUsed, isCalendarMode };
  }

  // 2) Średnia napędzana realnymi wypłatami: Σ(wypłata) ÷ Σ(godziny kalendarza miesiąca
  //    za który jest), po jednej wypłacie na docelowy miesiąc, pomijając wyłączone.
  if (isCalendarMode && paychecks.length > 0) {
    const excluded = new Set(emp.excludedPayMonths ?? []);
    const seen = new Set<string>();
    let totS = 0, totH = 0;
    for (const p of paychecks) {
      const tm = paycheckTargetMonth(p);
      if (seen.has(tm) || excluded.has(tm)) continue;
      seen.add(tm);
      const h = hoursForMonth(tm);
      if (h > 0) { totS += p.amount; totH += h; }
    }
    if (totH > 0) return { rate: totS / totH, monthWorkHours, salaryUsed, isCalendarMode };
  }

  // 3) Potwierdzone miesiące wygrywają nad zgadywaniem — Σpensja/Σgodziny po tych,
  //    którym user osobiście zaufał (i nie wyłączył).
  const confirmed = Object.values(emp.confirmedMonths ?? {}).filter((m) => !m.excluded);
  if (confirmed.length > 0) {
    const totSalary = confirmed.reduce((s, m) => s + (m.salary || 0), 0);
    const totHours = confirmed.reduce((s, m) => s + (m.hours || 0), 0);
    if (totHours > 0) return { rate: totSalary / totHours, monthWorkHours, salaryUsed, isCalendarMode };
  }

  // 4) Ręczne nadpisanie godzin wygrywa nad kalendarzem. Pensje wypłaca się z dołu, więc
  //    baza godzin = miesiąc PRZED miesiącem wypłaty; bez wypłaty — poprzedni pełny miesiąc
  //    (bieżący jest częściowy).
  if (isCalendarMode) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = ymOf(prev);
    const monthBefore = (ym: string) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 2, 1); return ymOf(d); };
    const paycheckDateMonth = lastPaycheck ? lastPaycheck.date.slice(0, 7) : null;
    const basisMonth = paycheckDateMonth ? monthBefore(paycheckDateMonth) : prevMonth;
    const hoursOverride = (emp.hoursOverride && emp.hoursOverride > 0) ? emp.hoursOverride : 0;
    const hours = hoursOverride || hoursForMonth(basisMonth) || hoursForMonth(prevMonth) || emp.hoursPerMonth;
    return { rate: hours > 0 ? salaryUsed / hours : null, monthWorkHours, salaryUsed, isCalendarMode };
  }

  // 5) Tryb ręczny (bez kalendarza) — stawka wprost z pensji/godzin miesięcznych.
  const hoursOverride = (emp.hoursOverride && emp.hoursOverride > 0) ? emp.hoursOverride : 0;
  const hours = hoursOverride || emp.hoursPerMonth;
  return { rate: hours > 0 ? salaryUsed / hours : null, monthWorkHours, salaryUsed, isCalendarMode };
}
