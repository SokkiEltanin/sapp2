import { ingestBankNotification } from '@/services/bankIngest';
import { useBankQueue } from '@/store/bankQueueStore';

// Port z sapp (__tests__/bankNotificationDedup.test.ts) 1:1 — dedup po `notifKey`
// (pkg:postTime), nie tylko po kolejce. Android `NotificationListenerService`
// (withBankNotificationListener.js) ma DWIE ścieżki dostawy — `onNotificationPosted`
// normalnie, ale też `onListenerConnected` (system re-bind po np. OEM battery-saver
// zabijającym usługę) zamiata WSZYSTKIE wciąż widoczne powiadomienia. Jeśli bankowa
// apka nie skasowała swojego powiadomienia od razu, TEN SAM realny event potrafi
// zostać dostarczony PONOWNIE dni później, długo po tym jak oryginał został
// zatwierdzony i usunięty z `pending` — `seenNotifications` (trwała, międzysesyjna
// pamięć) łapie to tam, gdzie zwykły dedup kolejki już nie ma jak.
const P4_NOTIF = 'Zapłacono kwotę 60,00 PLN kartą *8743 dnia 08-09-2026 godz. 09:00:00 w P4 SP Z O O WARSZAWA. Bank Pekao S.A.';

describe('ingestBankNotification — dedup po notifKey (postTime), nie tylko po kolejce', () => {
  beforeEach(() => {
    useBankQueue.setState({ pending: [], enabled: true, autoAll: false, seenNotifications: [] });
  });

  test('bez notifKey — zachowanie jak dawniej (brak dodatkowego dedupu)', async () => {
    const ok = await ingestBankNotification('Pekao', P4_NOTIF);
    expect(ok).toBe(true);
    expect(useBankQueue.getState().pending).toHaveLength(1);
  });

  test('ten sam notifKey drugi raz → odrzucone, NAWET gdy oryginał już opuścił kolejkę (scommitowany)', async () => {
    const key = 'eu.eleader.mobilebanking.pekao:1000000000000';
    const ok1 = await ingestBankNotification('Pekao', P4_NOTIF, key);
    expect(ok1).toBe(true);
    const [tx] = useBankQueue.getState().pending;

    // symuluje realny przepływ: user zaakceptował płatność w bank-review → wpis znika z
    // `pending` (staje się prawdziwym Expense gdzie indziej) — "wczorajszy" wpis już nie
    // siedzi w kolejce do porównania.
    useBankQueue.getState().remove(tx.id);
    expect(useBankQueue.getState().pending).toHaveLength(0);

    // dni później: onListenerConnected zamiata wciąż-niewidoczne powiadomienie, TEN SAM
    // postTime, TA SAMA treść.
    const ok2 = await ingestBankNotification('Pekao', P4_NOTIF, key);
    expect(ok2).toBe(false);
    expect(useBankQueue.getState().pending).toHaveLength(0); // NIE dodany drugi raz
  });

  test('różny notifKey (naprawdę inna płatność, inny czas) → NIE jest blokowany', async () => {
    const notifAt = (hhmm: string) => `Zapłacono kwotę 60,00 PLN kartą *8743 dnia 08-09-2026 godz. ${hhmm}:00 w P4 SP Z O O WARSZAWA. Bank Pekao S.A.`;
    const ok1 = await ingestBankNotification('Pekao', notifAt('09:00'), 'pkg:1111');
    const ok2 = await ingestBankNotification('Pekao', notifAt('09:10'), 'pkg:2222');
    expect(ok1).toBe(true);
    expect(ok2).toBe(true); // dwie osobne, realne płatności — notifKey dedup nie ma prawa ich złapać
    expect(useBankQueue.getState().pending).toHaveLength(2);
  });

  test('nieparsowalne powiadomienie NIE zapisuje notifKey jako "widziany" (nie blokuje przyszłego, realnego)', async () => {
    const key = 'pkg:9999';
    const ok1 = await ingestBankNotification('Pekao', 'zupełnie nie-bankowa treść', key);
    expect(ok1).toBe(false);
    expect(useBankQueue.getState().wasNotificationSeen(key)).toBe(false);
  });

  test('seenNotifications jest ograniczone (nie rośnie w nieskończoność)', async () => {
    for (let i = 0; i < 510; i++) {
      await ingestBankNotification('Pekao', P4_NOTIF, `pkg:${i}`);
    }
    expect(useBankQueue.getState().seenNotifications.length).toBeLessThanOrEqual(500);
    // najnowszy klucz musi przetrwać przycięcie (obcinamy od początku, nie od końca)
    expect(useBankQueue.getState().wasNotificationSeen('pkg:509')).toBe(true);
  });
});
