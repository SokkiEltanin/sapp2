// "Stałe opłaty" / Subskrypcje (2026-11-09, user: "czy w sapp mozemy eksportować
// szablony te do łapania powiadomien i stałych? Zeby przeniesc je do sapp2? I
// wtedy w kafelku tam w stałych opłatach zaznaczyć kiedy co musimy opłacić") —
// port sapp's `Subscription` (src/types/index.ts). Co ZMIENIONE vs sapp:
//
// - `category: ExpenseCategory` USUNIĘTE — sapp2 nie ma systemu kategorii
//   wydatków, tylko wolne tagi (patrz `Expense.tags`, ten sam wzorzec co
//   Pojazdy/Praca). Ikona na liście wynika z `billTagFor`/`BILL_TYPES`
//   (`recurringBills.ts`) dopasowanego do `tags`/`name`, a nie z osobnego pola.
// - `currency` USUNIĘTE — sapp2 jest jednowalutowe na poziomie subskrypcji
//   (kwota zawsze w PLN; `Expense.originalAmount/originalCurrency` to osobny,
//   dużo rzadziej używany mechanizm dla transakcji bankowych w walucie obcej,
//   subskrypcje praktycznie nigdy nie są w walucie obcej w tym użyciu appki).
//
// ŚWIADOMIE NIE portowane z sapp (osobny, dużo większy temat na przyszłość):
// cała inteligencja auto-dopasowania do powiadomień bankowych
// (`subscriptionAuto.ts`'s `matchSubscriptionForPayment`/`isConfidentSubMatch`/
// `subscriptionPriceChanged`/kolejka `PendingSubConfirm` "czy to Twoja
// subskrypcja?"/zmiana ceny/martwa subskrypcja) — to jest głęboko sprzęgnięte z
// sapp's bank-notification pipeline, którego sapp2 jeszcze nie ma w tej formie.
// `missedCycles` ZOSTAJE jako pole (liczone przy auto-rollu, patrz
// `recurringBills.ts`'s `rollOverdueSubscription`), ale NIE wyzwala żadnego
// UI-banera "martwa subskrypcja" w v1 — czysto dane na przyszłość.
// Lokalne powiadomienia-przypomnienia — PODPIĘTE 2026-11-11:
// `reminderDaysBefore` planuje realny trigger notifee o 9:00 rano (patrz
// `utils/billReminders.ts` / `services/billReminders.ts`).
export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export const CYCLE_LABEL: Record<BillingCycle, string> = {
  weekly: 'Co tydzień', monthly: 'Co miesiąc', quarterly: 'Co kwartał', yearly: 'Co rok',
};
export const CYCLE_SHORT: Record<BillingCycle, string> = {
  weekly: '/tydz.', monthly: '/mies.', quarterly: '/kw.', yearly: '/rok',
};

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  billingCycle: BillingCycle;
  nextBillingDate: string; // ISO YYYY-MM-DD
  reminderDaysBefore: number; // 0 = brak; N = powiadomienie N dni przed, o 9:00 (patrz wyżej)
  active: boolean;
  tags?: string[];
  note?: string;
  durationMonths?: number; // 0/undefined = na zawsze, N = auto-wyłącz po N mies.
  startDate?: string; // potrzebne tylko gdy durationMonths > 0
  missedCycles?: number; // licznik zaległych cykli bez złapanej płatności (dane, bez UI w v1)
  // Obca waluta czekająca na kwotę PLN (2026-11-11) — ta sama konwencja co
  // `Expense` (patrz utils/fx.ts): obecność `originalCurrency` = czeka,
  // `amount` = 0 dopóki user nie wpisze PLN w formularzu (zapis czyści oba).
  originalAmount?: number;
  originalCurrency?: string;
  createdAt: number;
  updatedAt: number;
}
