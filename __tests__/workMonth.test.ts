import { workMonthProgress } from '@/utils/workMonth';
import type { Employer } from '@/types/work';
import type { Expense } from '@/types/finances';
import type { CalendarEvent } from '@/types/calendar';

const emp = (o: Partial<Employer>): Employer => ({
  id: 'e', name: 'Firma X', createdAt: 0, monthlySalary: 5000, hoursPerMonth: 168, ...o,
});
const income = (o: Partial<Expense>): Expense => ({
  id: `e-${Math.random()}`, type: 'income', amount: 0, tags: [], note: '',
  date: '2026-01-01', source: 'manual', createdAt: '', updatedAt: '', ...o,
});
const shift = (date: string, range = '08:00 - 16:00'): CalendarEvent => ({
  id: `c-${Math.random()}`, title: `[JD] ${range}`, date, allDay: false, priority: 'normal', createdAt: '',
});

describe('workMonthProgress — kafel Praca', () => {
  const e = emp({ workPrefix: '[JD]', rateOverride: 25 });
  const events = [shift('2026-11-03'), shift('2026-11-11'), shift('2026-11-20')]; // 3 × 8h

  test('godziny: minione zmiany w całości, trwająca częściowo, przyszłe 0', () => {
    const r = workMonthProgress(e, events, [], new Date(2026, 10, 11, 12, 0)); // 11.11 12:00
    expect(r.hoursPlanned).toBe(24);
    expect(r.hoursDone).toBeCloseTo(12); // 8 + 4
    expect(r.rate).toBe(25);
  });

  test('bez wypłat w historii → prognoza za bieżący miesiąc z zaplanowanych godzin', () => {
    const r = workMonthProgress(e, [...events, shift('2026-10-10')], [], new Date(2026, 10, 11, 12));
    expect(r.nextPay).toEqual({ month: '2026-11', amount: 600 });
  });

  test('wypłata za poprzedni miesiąc jeszcze nie wpłynęła → najbliższa = za poprzedni', () => {
    const exp = [income({ amount: 200, tags: ['[jd]'], date: '2026-10-05' })]; // za wrzesień
    const r = workMonthProgress(e, [...events, shift('2026-10-10'), shift('2026-10-12')], exp, new Date(2026, 10, 2));
    expect(r.nextPay).toEqual({ month: '2026-10', amount: 400 });
  });

  test('wypłata za poprzedni już jest → najbliższa = za bieżący', () => {
    const exp = [income({ amount: 400, tags: ['[jd]'], date: '2026-11-05' })]; // za październik
    const r = workMonthProgress(e, [...events, shift('2026-10-10')], exp, new Date(2026, 10, 11));
    expect(r.nextPay).toEqual({ month: '2026-11', amount: 600 });
  });

  test('tryb ręczny: brak godzin, wypłata = pensja', () => {
    const r = workMonthProgress(emp({ workMode: 'manual' }), events, [], new Date(2026, 10, 11));
    expect(r.hoursDone).toBeNull();
    expect(r.hoursPlanned).toBeNull();
    expect(r.nextPay).toEqual({ month: '2026-11', amount: 5000 });
  });
});
