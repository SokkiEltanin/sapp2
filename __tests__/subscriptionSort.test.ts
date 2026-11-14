import { sortSubscriptions, monthlyCost } from '@/utils/subscriptionSort';

const S = (name: string, amount: number, billingCycle: any, nextBillingDate: string) =>
  ({ id: name, name, amount, billingCycle, nextBillingDate, reminderDaysBefore: 0, active: true }) as any;
const subs = [S('Netflix', 49, 'monthly', '2026-11-20'), S('Ubezpieczenie', 1200, 'yearly', '2026-11-16'), S('Ćwiczenia', 30, 'weekly', '2026-11-30')];

describe('stałe opłaty: sortowanie', () => {
  it('koszt miesięczny', () => {
    expect(monthlyCost(subs[1])).toBe(100);
    expect(Math.round(monthlyCost(subs[2]))).toBe(130);
  });
  it('termin / koszt / nazwa (polski porządek)', () => {
    expect(sortSubscriptions(subs, 'date').map((s) => s.name)).toEqual(['Ubezpieczenie', 'Netflix', 'Ćwiczenia']);
    expect(sortSubscriptions(subs, 'price').map((s) => s.name)).toEqual(['Ćwiczenia', 'Ubezpieczenie', 'Netflix']);
    expect(sortSubscriptions(subs, 'name').map((s) => s.name)).toEqual(['Ćwiczenia', 'Netflix', 'Ubezpieczenie']);
  });
});
