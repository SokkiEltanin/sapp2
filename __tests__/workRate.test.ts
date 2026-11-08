import { computeWorkRate } from '@/utils/workRate';
import type { Employer } from '@/types/work';
import type { Expense } from '@/types/finances';
import type { CalendarEvent } from '@/types/calendar';

// NOWY (nie ma odpowiednika w sapp — `computeWorkRate` to statyczny port tylko RDZENIA
// priorytetu stawek z sapp's `useWorkEarnings.ts`'s `perSecond`, bez żywego tickera,
// patrz komentarz w src/utils/workRate.ts). Testuje TĘ SAMĄ kolejność pierwszeństwa.

const emp = (o: Partial<Employer>): Employer => ({
  id: 'e', name: 'Firma X', createdAt: 0, monthlySalary: 5000, hoursPerMonth: 168, ...o,
});
const income = (o: Partial<Expense>): Expense => ({
  id: `e-${Math.random()}`, type: 'income', amount: 0, tags: [], note: '',
  date: '2026-01-01', source: 'manual', createdAt: '', updatedAt: '', ...o,
});
const shift = (o: Partial<CalendarEvent>): CalendarEvent => ({
  id: `c-${Math.random()}`, title: '', date: '2026-01-01', allDay: false, priority: 'normal', createdAt: '', ...o,
});

describe('workRate — computeWorkRate, kolejność pierwszeństwa', () => {
  test('1) rateOverride wygrywa zawsze, niezależnie od reszty danych', () => {
    const e = emp({ workPrefix: '[JD]', rateOverride: 99 });
    const r = computeWorkRate(e, [], [], new Date(2026, 8, 15));
    expect(r.rate).toBe(99);
  });

  test('2) średnia napędzana wypłatami: Σwypłata ÷ Σgodziny kalendarza miesiąca za który jest', () => {
    const e = emp({ workPrefix: '[JD]' });
    const events = [shift({ title: '[JD] 08:00 - 16:00', date: '2026-08-10' })]; // 8h w sierpniu
    const expenses = [income({ amount: 800, tags: ['[jd]'], date: '2026-09-05' })]; // target: 2026-08
    const r = computeWorkRate(e, events, expenses, new Date(2026, 9, 1));
    expect(r.rate).toBeCloseTo(100); // 800 / 8h
  });

  test('wyłączony (excludedPayMonths) miesiąc pomijany przy średniej z wielu wypłat', () => {
    const e = emp({ workPrefix: '[JD]', excludedPayMonths: ['2026-07'] }); // lipiec (niższa stawka) wykluczony
    const events = [
      shift({ title: '[JD] 08:00 - 16:00', date: '2026-07-10' }), // 8h lipca → 500/8 = 62.5 zł/h gdyby się liczyło
      shift({ title: '[JD] 08:00 - 16:00', date: '2026-08-10' }), // 8h sierpnia → 800/8 = 100 zł/h
    ];
    const expenses = [
      income({ amount: 500, tags: ['[jd]'], date: '2026-08-05' }), // target: 2026-07
      income({ amount: 800, tags: ['[jd]'], date: '2026-09-05' }), // target: 2026-08
    ];
    const r = computeWorkRate(e, events, expenses, new Date(2026, 9, 1));
    expect(r.rate).toBeCloseTo(100); // tylko sierpień wliczony, lipiec wykluczony
  });

  test('3) potwierdzone miesiące wygrywają nad zgadywaniem, gdy brak wypłat do dopasowania', () => {
    const e = emp({
      workPrefix: '[JD]',
      confirmedMonths: { '2026-07': { salary: 4000, hours: 160 }, '2026-06': { salary: 3000, hours: 150, excluded: true } },
    });
    const r = computeWorkRate(e, [], [], new Date(2026, 8, 1));
    expect(r.rate).toBeCloseTo(4000 / 160); // wykluczony czerwiec pominięty
  });

  test('4) tryb kalendarzowy bez wypłat/potwierdzeń → pensja ÷ godziny poprzedniego miesiąca', () => {
    const e = emp({ workPrefix: '[JD]', monthlySalary: 4200 });
    const events = [shift({ title: '[JD] 08:00 - 16:00', date: '2026-08-10' })]; // 8h w sierpniu
    const r = computeWorkRate(e, events, [], new Date(2026, 8, 15)); // "teraz" = wrzesień
    expect(r.rate).toBeCloseTo(4200 / 8);
  });

  test('hoursOverride wygrywa nad godzinami z kalendarza w gałęzi 4', () => {
    const e = emp({ workPrefix: '[JD]', monthlySalary: 4200, hoursOverride: 100 });
    const events = [shift({ title: '[JD] 08:00 - 16:00', date: '2026-08-10' })];
    const r = computeWorkRate(e, events, [], new Date(2026, 8, 15));
    expect(r.rate).toBeCloseTo(4200 / 100);
  });

  test('5) tryb ręczny (bez koloru/prefiksu) → pensja ÷ hoursPerMonth wprost, kalendarz ignorowany', () => {
    const e = emp({ workMode: 'manual', monthlySalary: 5040, hoursPerMonth: 168 });
    const events = [shift({ title: '[JD] 08:00 - 16:00', date: '2026-08-10', color: '#FF0000' })];
    const r = computeWorkRate(e, events, [], new Date(2026, 8, 15));
    expect(r.rate).toBeCloseTo(30); // 5040/168
    expect(r.isCalendarMode).toBe(false);
  });

  test('zero danych w ogóle → fallback do monthlySalary/hoursPerMonth domyślnych pracodawcy', () => {
    const e = emp({ workPrefix: '[JD]', monthlySalary: 5000, hoursPerMonth: 168 });
    const r = computeWorkRate(e, [], [], new Date(2026, 8, 15));
    expect(r.rate).toBeCloseTo(5000 / 168);
  });
});
