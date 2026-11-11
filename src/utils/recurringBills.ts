import type { Expense } from '@/types/finances';
import type { Subscription, BillingCycle } from '@/types/subscriptions';
import { addMonthsClipped, addYearsClipped, ymdLocal } from '@/utils/dateMath';
import { pendingFxOf, type PendingFx } from '@/utils/fx';

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
// realne powiadomienia-przypomnienia).
//
// `detectRecurringBills`/`nextBillingDate`/`upcomingPayments` DOŁĄCZONE 2026-11-09
// (user: "a nie jest git w finansach ta ostatnia platnosc najbliższą ma być
// automatyczna po stałych i subskrypcjach łapać czy cos ma przewidywać stale
// kiedy sa") — pierwsza wersja Subskrypcji CELOWO nie portowała
// `detectRecurringBills` ("sapp2 w v1 dostaje tylko RĘCZNE dodawanie
// subskrypcji"), ale "Najbliższa opłata" licząca WYŁĄCZNIE ręcznie dodane
// Subskrypcje pomijała rachunki, które user loguje jako zwykłe wydatki (czynsz,
// prąd...) bez zakładania im osobnej Subskrypcji — dokładnie to user tu
// zgłasza. Teraz: rachunek rozpoznany (`billTagFor`) w ≥2 odrębnych miesiącach
// dostaje PRZEWIDYWANY termin (dzień miesiąca z ostatniego wystąpienia,
// `nextBillingDate`) bez potrzeby ręcznego zakładania Subskrypcji — `upcoming-
// Payments` łączy to z realnymi Subskrypcjami w jedną, posortowaną listę.
//
// Kwota przewidywanej płatności — POPRAWIONA 2026-11-11 (user, patrząc na
// "Najbliższe eventy": "czemu mi na dole pokazuje czynsz mieszkanie, i tam
// zła Kwota?... a tak to widać ile płace z historii finansów") —
// pierwsza wersja liczyła ŚREDNIĄ ze WSZYSTKICH historycznych kwot tego
// typu rachunku (`avgAmount`), co przy normalnej zmienności (podwyżka,
// jednorazowa korekta) dawało liczbę, która nie odpowiadała ŻADNEJ realnej
// płatności. Teraz `lastAmount` — kwota z OSTATNIEGO realnego wystąpienia,
// dokładnie ta sama logika co `dayOfMonth` już ma (patrz niżej).
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

export interface BillCandidate {
  tag: string;
  name: string;
  icon: string;
  // Kwota do przewidzenia następnej płatności — kwota z OSTATNIEGO
  // wystąpienia, NIE średnia z całej historii (2026-11-11, user: "czemu mi
  // na dole pokazuje czynsz mieszkanie i tam zła kwota... a tak to widać
  // ile płacę z historii finansów" — avgAmount [stara wersja] mieszał
  // zwykłą zmienność kwot w jedną uśrednioną liczbę, która nie odpowiadała
  // żadnej realnej płatności; user oczekuje konkretnej, realnej ostatniej
  // kwoty, nie statystyki).
  lastAmount: number;
  months: number;     // distinct months it appeared in
  lastDate: string;   // YYYY-MM-DD
  dayOfMonth: number; // day to predict the next occurrence on (from the last one)
}

// Port z sapp's `detectRecurringBills` — rachunki, które user loguje ręcznie co
// miesiąc (czynsz, prąd, internet...) BEZ założenia im osobnej Subskrypcji.
// Potrzebuje ≥2 odrębnych miesięcy, żeby uznać coś za cykliczne (jedno
// wystąpienie to zbyt mało, żeby zgadywać dzień miesiąca). Pomija typ już
// pokryty przez AKTYWNĄ Subskrypcję z pasującym tagiem/nazwą — ten sam rachunek
// nie ma liczyć się podwójnie w `upcomingPayments` niżej.
export function detectRecurringBills(expenses: Expense[], subs: Subscription[], dismissed: readonly string[] = []): BillCandidate[] {
  const byTag: Record<string, { months: Set<string>; lastDate: string; lastAmount: number }> = {};
  for (const e of expenses) {
    if (e.type === 'income') continue;
    const t = billTagFor(e);
    if (!t) continue;
    const date = (e.date ?? '').slice(0, 10);
    if (!date) continue;
    const g = (byTag[t.tag] ??= { months: new Set(), lastDate: '', lastAmount: 0 });
    g.months.add(date.slice(0, 7));
    if (date > g.lastDate) { g.lastDate = date; g.lastAmount = e.amount; }
  }

  const out: BillCandidate[] = [];
  for (const t of BILL_TYPES) {
    const g = byTag[t.tag];
    if (!g || g.months.size < 2) continue;
    if (dismissed.includes(t.tag)) continue; // user: "to nie stała opłata"
    if (subs.some((s) => s.active && ((s.tags ?? []).includes(t.tag) || s.name.toLowerCase().includes(t.tag)))) continue;
    out.push({
      tag: t.tag, name: t.name, icon: t.icon, lastAmount: g.lastAmount, months: g.months.size,
      lastDate: g.lastDate, dayOfMonth: Math.min(28, Math.max(1, parseInt(g.lastDate.slice(8, 10), 10) || 10)),
    });
  }
  return out.sort((a, b) => b.months - a.months);
}

// Port 1:1 sapp's `nextBillingDate` — najbliższe wystąpienie dnia miesiąca (ten
// miesiąc, jeśli jeszcze nie minął, inaczej następny). `dayOfMonth` przychodzi
// zawsze przycięty do 1-28 (patrz `detectRecurringBills` wyżej), więc `setMonth`
// nigdy nie przewija miesiąca — każdy ma co najmniej 28 dni.
export function nextBillingDate(dayOfMonth: number, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (d.getTime() <= now.getTime()) d.setMonth(d.getMonth() + 1);
  return ymdLocal(d);
}

export interface UpcomingPayment {
  id: string;   // sub.id dla 'subscription', `bill_<tag>` dla 'bill' — stabilny React key
  kind: 'subscription' | 'bill';
  name: string;
  amount: number;
  daysUntil: number;
  dueDate: string; // YYYY-MM-DD
  icon?: string; // tylko 'bill' (BILL_TYPES'owa ikona) — subskrypcja nie ma własnej
  // Subskrypcja w obcej walucie jeszcze bez kwoty PLN (utils/fx.ts) — `amount` 0,
  // wołający pokazuje oryginał zamiast "0,00".
  fx?: PendingFx;
}

// Łączy realne Subskrypcje z PRZEWIDYWANYMI terminami rozpoznanych rachunków
// stałych w JEDNĄ, posortowaną listę — zasila "Najbliższa opłata" (Finanse) i
// Dashboard's "Stałe opłaty" wśród "Najbliższych eventów", zamiast każde z osobna
// czytać tylko Subskrypcje.
export function upcomingPayments(expenses: Expense[], subs: Subscription[], now: Date = new Date(), dismissed: readonly string[] = []): UpcomingPayment[] {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const out: UpcomingPayment[] = [];
  for (const { sub, daysUntil } of upcomingSubscriptions(subs, now)) {
    out.push({ id: sub.id, kind: 'subscription', name: sub.name, amount: sub.amount, daysUntil, dueDate: sub.nextBillingDate, fx: pendingFxOf(sub) });
  }
  for (const b of detectRecurringBills(expenses, subs, dismissed)) {
    const dueDate = nextBillingDate(b.dayOfMonth, today);
    const daysUntil = Math.round((new Date(`${dueDate}T00:00:00`).getTime() - today.getTime()) / 86400000);
    out.push({ id: `bill_${b.tag}`, kind: 'bill', name: b.name, amount: b.lastAmount, daysUntil, dueDate, icon: b.icon });
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function nextUpcomingPayment(expenses: Expense[], subs: Subscription[], now: Date = new Date(), dismissed: readonly string[] = []): UpcomingPayment | null {
  return upcomingPayments(expenses, subs, now, dismissed)[0] ?? null;
}
