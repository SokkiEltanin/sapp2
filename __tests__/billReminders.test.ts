import { planBillReminders, BILL_REMINDER_HOUR } from '@/utils/billReminders';
import type { Subscription } from '@/types/subscriptions';

// 2026-11-11 — "Przypomnienie: N dni przed" było zapisywane, ale nic go nie
// planowało. Planowanie jako czysta funkcja.
function sub(patch: Partial<Subscription>): Subscription {
  return {
    id: 's1', name: 'Netflix', amount: 49.99, billingCycle: 'monthly', nextBillingDate: '2026-11-20',
    reminderDaysBefore: 3, active: true, createdAt: 0, updatedAt: 0, ...patch,
  };
}
const now = new Date(2026, 10, 11, 12, 0); // 11 lis 2026, 12:00

describe('planBillReminders', () => {
  test('przypomnienie N dni przed terminem, o 9:00, z treścią', () => {
    const [r] = planBillReminders([sub({})], now);
    const fire = new Date(r.fireAt);
    expect([fire.getMonth(), fire.getDate(), fire.getHours()]).toEqual([10, 17, BILL_REMINDER_HOUR]);
    expect(r.id).toBe('bill_s1');
    expect(r.dueDate).toBe('2026-11-20');
    expect(r.title).toBe('Netflix — za 3 dni');
    expect(r.body).toBe('49,99 zł · płatność 20 lis');
  });

  test('"1 dzień przed" → "jutro"', () => {
    const [r] = planBillReminders([sub({ reminderDaysBefore: 1 })], now);
    expect(r.title).toBe('Netflix — jutro');
  });

  test('pomija nieaktywne i bez przypomnienia', () => {
    expect(planBillReminders([sub({ active: false }), sub({ id: 's2', reminderDaysBefore: 0 })], now)).toEqual([]);
  });

  test('okno już minęło (termin za 2 dni, przypomnienie 3 dni przed) → NASTĘPNY cykl, nie spóźnione', () => {
    const [r] = planBillReminders([sub({ nextBillingDate: '2026-11-13' })], now);
    expect(r.dueDate).toBe('2026-12-13');
    expect(new Date(r.fireAt).getDate()).toBe(10);
  });

  test('zaległa data (nieprzesunięta jeszcze przez ekran) → liczy od realnego następnego terminu', () => {
    const [r] = planBillReminders([sub({ nextBillingDate: '2026-09-25' })], now);
    expect(r.dueDate).toBe('2026-11-25');
  });

  test('przypomnienie dziś później niż teraz → zostaje na ten termin', () => {
    const early = new Date(2026, 10, 17, 7, 0); // 17 lis 7:00, przypomnienie 17 lis 9:00
    const [r] = planBillReminders([sub({})], early);
    expect(r.dueDate).toBe('2026-11-20');
  });
});

describe('planBillReminders — obca waluta', () => {
  test('subskrypcja bez kwoty PLN → treść z oryginałem, nie "0,00 zł"', () => {
    const [r] = planBillReminders([sub({ amount: 0, originalAmount: 0.99, originalCurrency: 'EUR' })], now);
    expect(r.body).toBe('0,99 EUR · płatność 20 lis');
  });
});
