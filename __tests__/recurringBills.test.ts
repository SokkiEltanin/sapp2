import {
  looksLikeBill, billTagFor,
  advanceNextBillingDate, isDurationExpired, rollOverdueSubscription,
  upcomingSubscriptions, nextDueSubscription,
} from '@/utils/recurringBills';
import type { Subscription } from '@/types/subscriptions';

// Port z sapp (__tests__/recurringBills.test.ts). Faza 2.1: TYLKO słownik +
// dopasowanie tekstu. 2026-11-09 (port Subskrypcji, patrz ARCHITECTURE.md §
// SUBSKRYPCJE): `advanceNextBillingDate`/`isDurationExpired`/
// `rollOverdueSubscription` DOŁĄCZONE — porty 1:1 sapp's testów (ta sama logika,
// ten sam day-overflow bug/fix, teraz przez wspólny `dateMath.ts`). Nowe
// `upcomingSubscriptions`/`nextDueSubscription` nie istnieją w sapp — zasilają
// Finanse's "Najbliższa opłata"/Dashboard's "Stałe opłaty".
describe('recurringBills — looksLikeBill / billTagFor', () => {
  test('rozpoznaje typowe rachunki po słowach kluczowych, bez rozróżniania wielkości liter', () => {
    expect(looksLikeBill('Czynsz za mieszkanie')).toBe(true);
    expect(looksLikeBill('PGE Polska')).toBe(true);
    expect(looksLikeBill('Opłata za internet')).toBe(true);
    expect(looksLikeBill('Biedronka zakupy')).toBe(false);
  });

  test('billTagFor sprawdza note + storeName + tags, zwraca tag/nazwę/ikonę', () => {
    expect(billTagFor({ storeName: 'PGE' })).toEqual({ tag: 'prąd', name: 'Prąd', icon: 'Zap' });
    expect(billTagFor({ note: 'zakupy spożywcze' })).toBeNull();
    expect(billTagFor({ tags: ['ubezpieczenie'] })).toEqual({ tag: 'ubezpieczenie', name: 'Ubezpieczenie', icon: 'Shield' });
  });
});

describe('advanceNextBillingDate — cykle płatności nie gubią miesiąca przy dniu 29-31', () => {
  test('weekly dodaje 7 dni bez zmian', () => {
    expect(advanceNextBillingDate('2026-01-15', 'weekly')).toBe('2026-01-22');
  });

  test('monthly z 31. dnia stycznia → 28 lutego (przycięte), NIE 3 marca (przewinięte)', () => {
    expect(advanceNextBillingDate('2026-01-31', 'monthly')).toBe('2026-02-28');
  });

  test('quarterly z 30. dnia listopada → 28 lutego (przycięte), NIE 2 marca', () => {
    expect(advanceNextBillingDate('2026-11-30', 'quarterly')).toBe('2027-02-28');
  });

  test('yearly z 29. lutego roku przestępnego → 28 lutego roku zwykłego (przycięte)', () => {
    expect(advanceNextBillingDate('2028-02-29', 'yearly')).toBe('2029-02-28');
  });

  test('monthly z bezpiecznego dnia (15.) → zwykłe dodanie miesiąca', () => {
    expect(advanceNextBillingDate('2026-01-15', 'monthly')).toBe('2026-02-15');
  });
});

describe('isDurationExpired — to samo dla durationMonths liczonych od startDate 29-31', () => {
  afterEach(() => { jest.useRealTimers(); });

  test('1.03 (po przyciętym końcu 28.02, ale PRZED przewiniętym 3.03) → wygasła', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T12:00:00'));
    expect(isDurationExpired({ durationMonths: 1, startDate: '2026-01-31' })).toBe(true);
  });

  test('27.02 (przed przyciętym końcem) → wciąż aktywna', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-02-27T12:00:00'));
    expect(isDurationExpired({ durationMonths: 1, startDate: '2026-01-31' })).toBe(false);
  });

  test('brak durationMonths/startDate → nigdy nie wygasa', () => {
    expect(isDurationExpired({ durationMonths: undefined, startDate: '2026-01-31' })).toBe(false);
    expect(isDurationExpired({ durationMonths: 1, startDate: undefined })).toBe(false);
    expect(isDurationExpired({ durationMonths: 0, startDate: '2026-01-31' })).toBe(false);
  });
});

describe('rollOverdueSubscription — wykrywanie zaległych cykli', () => {
  test('nie zaległa → null, missedCycles się nie zmienia', () => {
    expect(rollOverdueSubscription({ nextBillingDate: '2026-10-01', billingCycle: 'monthly', missedCycles: 0 }, '2026-09-28')).toBeNull();
  });

  test('zaległa dwa cykle (od 1.08, dziś 28.09 — 1.08 I 1.09 już minęły) → +2 missedCycles', () => {
    const r = rollOverdueSubscription({ nextBillingDate: '2026-08-01', billingCycle: 'monthly', missedCycles: 0 }, '2026-09-28');
    expect(r).toEqual({ nextBillingDate: '2026-10-01', missedCycles: 2 });
  });

  test('appka nieotwierana kilka miesięcy → wszystkie przegapione cykle liczą się naraz', () => {
    const r = rollOverdueSubscription({ nextBillingDate: '2026-05-01', billingCycle: 'monthly', missedCycles: 0 }, '2026-09-28');
    expect(r).toEqual({ nextBillingDate: '2026-10-01', missedCycles: 5 });
  });

  test('kumuluje się z istniejącym missedCycles (nie resetuje)', () => {
    const r = rollOverdueSubscription({ nextBillingDate: '2026-08-01', billingCycle: 'monthly', missedCycles: 2 }, '2026-09-28');
    expect(r).toEqual({ nextBillingDate: '2026-10-01', missedCycles: 4 });
  });
});

function sub(patch: Partial<Subscription>): Subscription {
  return {
    id: 's1', name: 'Netflix', amount: 49.99, billingCycle: 'monthly',
    nextBillingDate: '2026-12-01', reminderDaysBefore: 3, active: true,
    createdAt: 0, updatedAt: 0, ...patch,
  };
}

describe('upcomingSubscriptions / nextDueSubscription — zasila "Najbliższa opłata"/"Stałe opłaty"', () => {
  const now = new Date('2026-11-09T12:00:00');

  test('sortuje aktywne po najbliższej płatności, pomija nieaktywne', () => {
    const subs = [
      sub({ id: 'a', nextBillingDate: '2026-11-20' }),
      sub({ id: 'b', nextBillingDate: '2026-11-12' }),
      sub({ id: 'c', nextBillingDate: '2026-11-10', active: false }),
    ];
    const result = upcomingSubscriptions(subs, now);
    expect(result.map((r) => r.sub.id)).toEqual(['b', 'a']);
    expect(result[0].daysUntil).toBe(3);
  });

  test('brak aktywnych subskrypcji → pusta lista, nextDueSubscription → null', () => {
    expect(upcomingSubscriptions([sub({ active: false })], now)).toEqual([]);
    expect(nextDueSubscription([sub({ active: false })], now)).toBeNull();
  });

  test('nextDueSubscription zwraca najbliższą', () => {
    const subs = [sub({ id: 'a', nextBillingDate: '2026-11-20' }), sub({ id: 'b', nextBillingDate: '2026-11-12' })];
    expect(nextDueSubscription(subs, now)?.sub.id).toBe('b');
  });
});
