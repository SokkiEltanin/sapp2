import {
  looksLikeBill, billTagFor,
  advanceNextBillingDate, isDurationExpired, rollOverdueSubscription,
  upcomingSubscriptions, nextDueSubscription,
  detectRecurringBills, nextBillingDate, upcomingPayments, nextUpcomingPayment,
} from '@/utils/recurringBills';
import type { Subscription } from '@/types/subscriptions';
import type { Expense } from '@/types/finances';

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

function exp(patch: Partial<Expense>): Expense {
  return {
    id: 'e1', type: 'expense', amount: 100, date: '2026-09-15', note: '', tags: [],
    source: 'manual', createdAt: '', updatedAt: '', ...patch,
  };
}

// 2026-11-09, user: "a nie jest git w finansach ta ostatnia platnosc najbliższą
// ma być automatyczna po stałych i subskrypcjach łapać czy cos ma przewidywać
// stale kiedy sa" — rachunki logowane jako zwykłe wydatki (bez osobnej
// Subskrypcji) dostają przewidywany termin z historii.
describe('detectRecurringBills — rozpoznaje cykliczne rachunki logowane jako zwykłe wydatki', () => {
  test('ten sam typ w ≥2 odrębnych miesiącach → kandydat, dayOfMonth z OSTATNIEGO wystąpienia', () => {
    const out = detectRecurringBills([
      exp({ id: 'a', storeName: 'PGE', amount: 180, date: '2026-08-05' }),
      exp({ id: 'b', storeName: 'PGE', amount: 200, date: '2026-09-07' }),
    ], []);
    expect(out).toEqual([{ tag: 'prąd', name: 'Prąd', icon: 'Zap', avgAmount: 190, months: 2, lastDate: '2026-09-07', dayOfMonth: 7 }]);
  });

  test('tylko 1 miesiąc → za mało historii, pomijane', () => {
    expect(detectRecurringBills([exp({ storeName: 'PGE', date: '2026-09-07' })], [])).toEqual([]);
  });

  test('typ już pokryty przez AKTYWNĄ Subskrypcję (tag lub nazwa) → pomijany, bez podwójnego liczenia', () => {
    const expenses = [
      exp({ id: 'a', storeName: 'PGE', date: '2026-08-05' }),
      exp({ id: 'b', storeName: 'PGE', date: '2026-09-07' }),
    ];
    expect(detectRecurringBills(expenses, [sub({ tags: ['prąd'] })])).toEqual([]);
    expect(detectRecurringBills(expenses, [sub({ active: false, tags: ['prąd'] })])).toHaveLength(1); // nieaktywna NIE blokuje
  });

  test('dzień z OSTATNIEGO wystąpienia > 28 (np. 30) przycięty do 28 (bezpieczny dla day-overflow w nextBillingDate)', () => {
    const out = detectRecurringBills([
      exp({ id: 'a', storeName: 'PGE', date: '2026-08-05' }),
      exp({ id: 'b', storeName: 'PGE', date: '2026-09-30' }),
    ], []);
    expect(out[0].lastDate).toBe('2026-09-30');
    expect(out[0].dayOfMonth).toBe(28);
  });

  test('sortuje po liczbie miesięcy (najdłuższa historia pierwsza)', () => {
    const out = detectRecurringBills([
      exp({ id: 'a', storeName: 'PGE', date: '2026-07-05' }),
      exp({ id: 'b', storeName: 'PGE', date: '2026-08-05' }),
      exp({ id: 'c', note: 'internet', date: '2026-08-05' }),
      exp({ id: 'd', note: 'internet', date: '2026-09-05' }),
      exp({ id: 'e', storeName: 'PGE', date: '2026-09-05' }),
    ], []);
    expect(out.map((b) => b.tag)).toEqual(['prąd', 'internet']); // prąd: 3 mies., internet: 2
  });
});

describe('nextBillingDate — najbliższe wystąpienie dnia miesiąca', () => {
  test('dzień jeszcze w tym miesiącu (przed "dziś") → ten miesiąc', () => {
    expect(nextBillingDate(20, new Date(2026, 10, 9))).toBe('2026-11-20');
  });

  test('dzień już minął w tym miesiącu → następny miesiąc', () => {
    expect(nextBillingDate(5, new Date(2026, 10, 9))).toBe('2026-12-05');
  });

  test('dzień = dokładnie dziś → traktowany jako już miniony, następny miesiąc', () => {
    expect(nextBillingDate(9, new Date(2026, 10, 9))).toBe('2026-12-09');
  });
});

describe('upcomingPayments / nextUpcomingPayment — Subskrypcje + przewidywane rachunki stałe RAZEM', () => {
  const now = new Date(2026, 10, 9);

  test('łączy i sortuje oba źródła po najbliższym terminie', () => {
    const expenses = [
      exp({ id: 'a', storeName: 'PGE', date: '2026-09-07' }),
      exp({ id: 'b', storeName: 'PGE', date: '2026-10-15' }), // dayOfMonth=15 → przewidywany termin 15 listopada, za 6 dni
    ];
    const subs = [sub({ id: 's1', name: 'Netflix', nextBillingDate: '2026-11-20' })]; // za 11 dni, dalej niż rachunek
    const out = upcomingPayments(expenses, subs, now);
    expect(out.map((p) => p.kind)).toEqual(['bill', 'subscription']);
    expect(out[0].name).toBe('Prąd');
    expect(out[1].name).toBe('Netflix');
  });

  test('brak subskrypcji i rozpoznanych rachunków → pusta lista, nextUpcomingPayment → null', () => {
    expect(upcomingPayments([], [], now)).toEqual([]);
    expect(nextUpcomingPayment([], [], now)).toBeNull();
  });

  test('nextUpcomingPayment zwraca pierwszy element połączonej listy', () => {
    const expenses = [
      exp({ id: 'a', storeName: 'PGE', date: '2026-09-07' }),
      exp({ id: 'b', storeName: 'PGE', date: '2026-10-07' }),
    ];
    const result = nextUpcomingPayment(expenses, [], now);
    expect(result?.kind).toBe('bill');
    expect(result?.name).toBe('Prąd');
  });
});
