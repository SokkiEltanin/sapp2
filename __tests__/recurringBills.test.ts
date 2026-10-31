import { looksLikeBill, billTagFor } from '@/utils/recurringBills';

// Port z sapp (__tests__/recurringBills.test.ts) — OGRANICZONY do tego co faktycznie
// portujemy w Fazie 2.1 (słownik + dopasowanie tekstu). Testy sapp'a dla
// `advanceNextBillingDate`/`isDurationExpired`/`rollOverdueSubscription` pominięte —
// te funkcje świadomie NIE zostały portowane (wiążą się z konkretną Subskrypcją,
// której ekran/store sapp2 jeszcze nie ma, patrz komentarz w recurringBills.ts).
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
