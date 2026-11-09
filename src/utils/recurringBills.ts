import type { Subscription, BillingCycle } from '@/types/subscriptions';
import { addMonthsClipped, addYearsClipped, ymdLocal } from '@/utils/dateMath';

// Port z sapp (src/utils/recurringBills.ts). Słownik rachunków + dopasowanie tekstu
// (`looksLikeBill`/`billTagFor`) — logika 1:1, bez zmian. 2026-11-09 (user: "czy w
// sapp mozemy eksportować szablony te do łapania powiadomien i stałych... zeby w
// kafelku w stałych opłatach zaznaczyć kiedy co musimy opłacić") — DOŁĄCZONA tu też
// subskrypcyjna część portu (`advanceNextBillingDate`/`rollOverdueSubscription`/
// `isDurationExpired` + nowe `upcomingSubscriptions`/`nextDueSubscription` dla
// kafli), bo jest to DOKŁADNIE ten gap, który poprzedni komentarz w tym pliku już
// flagował jako odłożony na później ("dorzucimy to gdy ten ekran faktycznie
// powstanie" — patrz src/types/subscriptions.ts po pełny opis co z sapp'owej
// Subskrypcji portowane, a co ŚWIADOMIE nie (bank-auto-matching, martwa-sub UI,
// realne powiadomienia-przypomnienia). `detectRecurringBills` (auto-wykrywanie
// kandydatów na rachunek z historii wydatków + dismiss-list) NIE portowane —
// osobna, sama w sobie średnia funkcja (dashboard-suggest banner), sapp2 w v1
// dostaje tylko RĘCZNE dodawanie subskrypcji (ekran `app/subscriptions.tsx`).
//
// `icon` = nazwa komponentu z `lucide-react-native`, rozwiązywana dynamicznie tam
// gdzie potrzebna (ten sam wzorzec co w sapp) — Internet/Prąd/Gaz/Woda dostają WŁASNĄ
// ikonę zamiast dziedziczyć jedną wspólną "dom".
export const BILL_TYPES: { match: string[]; name: string; tag: string; icon: string }[] = [
  { match: ['czynsz', 'mieszkanie', 'administr', 'adm ', 'spółdziel', 'spoldziel', 'wspólnot', 'wspolnot'], name: 'Czynsz / mieszkanie', tag: 'czynsz', icon: 'Home' },
  { match: ['prąd', 'prad', 'pge', 'tauron', 'energa', 'enea', 'energia elektr'], name: 'Prąd', tag: 'prąd', icon: 'Zap' },
  { match: ['internet'], name: 'Internet', tag: 'internet', icon: 'Wifi' },
  { match: ['gaz '], name: 'Gaz', tag: 'gaz', icon: 'Flame' },
  { match: ['woda', 'ścieki', 'scieki', 'wod-kan'], name: 'Woda', tag: 'woda', icon: 'Droplet' },
  { match: ['ogrzewani', 'ciepł', 'cieplo'], name: 'Ogrzewanie', tag: 'ogrzewanie', icon: 'Thermometer' },
  { match: ['ubezpiecz'], name: 'Ubezpieczenie', tag: 'ubezpieczenie', icon: 'Shield' },
  { match: ['abonament', 'telefon'], name: 'Telefon / abonament', tag: 'telefon', icon: 'Phone' },
];

// Czy tekst (note + storeName + tags złączone) brzmi jak rachunek stały.
export function looksLikeBill(text: string): boolean {
  const hay = text.toLowerCase();
  return BILL_TYPES.some((bt) => bt.match.some((m) => hay.includes(m)));
}

// Który BILL_TYPE (jeśli jakiś) pasuje do wydatku — sprawdzane po note + storeName +
// tags, więc wydatek z samym storeName="PGE" (bez note/tagu) i tak złapie "Prąd".
export function billTagFor(e: { note?: string; storeName?: string; tags?: string[] }): { tag: string; name: string; icon: string } | null {
  const hay = `${e.note ?? ''} ${e.storeName ?? ''} ${(e.tags ?? []).join(' ')}`.toLowerCase();
  const t = BILL_TYPES.find((bt) => bt.match.some((m) => hay.includes(m)));
  return t ? { tag: t.tag, name: t.name, icon: t.icon } : null;
}

// Port 1:1 sapp's `advanceNextBillingDate` (day-overflow-safe — patrz dateMath.ts).
export function advanceNextBillingDate(current: string, cycle: BillingCycle): string {
  const start = new Date(`${current}T00:00:00`);
  let d = start;
  switch (cycle) {
    case 'weekly':    d = new Date(start); d.setDate(d.getDate() + 7); break;
    case 'monthly':   d = addMonthsClipped(start, 1); break;
    case 'quarterly': d = addMonthsClipped(start, 3); break;
    case 'yearly':    d = addYearsClipped(start, 1); break;
  }
  return ymdLocal(d);
}

// Cicho przesuwa zaległą `nextBillingDate` w przyszłość (bez pytania usera — ten
// sam wybór co sapp: dopytywanie "czy opłaciłeś?" dwa razy dziennie było
// uciążliwe). `null` gdy sub nie jest zaległa. `missedCycles` tylko PRZYRASTA
// tutaj — jeśli/kiedy sapp2 dostanie bank-auto-match dla subskrypcji, zerowanie
// będzie tam, analogicznie do sapp's bankCommit.ts (na razie: czyste dane, bez
// UI "martwa subskrypcja", patrz types/subscriptions.ts).
export function rollOverdueSubscription(
  sub: Pick<Subscription, 'nextBillingDate' | 'billingCycle' | 'missedCycles'>,
  todayISO: string,
): { nextBillingDate: string; missedCycles: number } | null {
  if (sub.nextBillingDate > todayISO) return null;
  let next = sub.nextBillingDate;
  let missed = 0;
  do { next = advanceNextBillingDate(next, sub.billingCycle); missed++; } while (next <= todayISO);
  return { nextBillingDate: next, missedCycles: (sub.missedCycles ?? 0) + missed };
}

// Port 1:1 sapp's `isDurationExpired` — subskrypcja z ograniczonym czasem trwania
// (np. "3 mies. próbnie") kwalifikuje się do auto-wyłączenia.
export function isDurationExpired(sub: Pick<Subscription, 'durationMonths' | 'startDate'>): boolean {
  if (!sub.durationMonths || sub.durationMonths === 0 || !sub.startDate) return false;
  const end = addMonthsClipped(new Date(`${sub.startDate}T00:00:00`), sub.durationMonths);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return end <= today;
}

export interface UpcomingSubscription {
  sub: Subscription;
  daysUntil: number; // ujemne = zaległa (nie powinno się zdarzyć po rollOverdueSubscription, ale defensywnie)
}

// Aktywne subskrypcje posortowane po najbliższej płatności — zasila "Najbliższa
// opłata" (Finanse) i Dashboard's "Stałe opłaty" wśród "Najbliższych eventów".
export function upcomingSubscriptions(subs: Subscription[], now: Date = new Date()): UpcomingSubscription[] {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return subs
    .filter((s) => s.active)
    .map((sub) => ({ sub, daysUntil: Math.round((new Date(`${sub.nextBillingDate}T00:00:00`).getTime() - today.getTime()) / 86400000) }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export function nextDueSubscription(subs: Subscription[], now: Date = new Date()): UpcomingSubscription | null {
  return upcomingSubscriptions(subs, now)[0] ?? null;
}
