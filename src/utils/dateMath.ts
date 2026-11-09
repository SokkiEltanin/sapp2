// Day-overflow-safe date math — sapp2 nie ma `date-fns` (sapp ma, i stąd już RAZ
// łapał tego typu buga, patrz sapp's recurringBills.ts komentarz przy
// `advanceNextBillingDate`: goły `setMonth`/`setFullYear` na dzień nieistniejący w
// docelowym miesiącu PRZEWIJA zamiast przyciąć — 31 stycznia + 1 miesiąc ląduje 3
// marca, nie 28/29 lutego). Wydzielone (2026-11-09, port Subskrypcji) z
// `vehicleMatch.ts`'s lokalnej `addMonthsClipped` — ta sama funkcja była
// potrzebna drugi raz (serwis pojazdów + teraz cykl rozliczeniowy subskrypcji),
// więc jedna wspólna implementacja zamiast dwóch kopii.

export function addMonthsClipped(date: Date, months: number): Date {
  const targetMonthIndex = date.getMonth() + months;
  const daysInTarget = new Date(date.getFullYear(), targetMonthIndex + 1, 0).getDate();
  return new Date(date.getFullYear(), targetMonthIndex, Math.min(date.getDate(), daysInTarget));
}

export function addYearsClipped(date: Date, years: number): Date {
  const targetYear = date.getFullYear() + years;
  // Jedyny przypadek przewijania przy latach: 29 lutego w roku nieprzestępnym.
  const daysInTarget = new Date(targetYear, date.getMonth() + 1, 0).getDate();
  return new Date(targetYear, date.getMonth(), Math.min(date.getDate(), daysInTarget));
}

export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
