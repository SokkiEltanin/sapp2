import type { Expense } from '@/types/finances';
import { amountMatches, sameLocalDay } from './bankNotification';

// Wykrywanie potencjalnego duplikatu przy RĘCZNYM zapisie NOWEGO wydatku
// (2026-11-11, user: "jak dodałem z opóźnieniem paragon to mi nie złapało że
// to ta sama suma pieniążków i dzień, i przez to mi się zdublowało" — paragon
// za zakup w Lidlu dodany ręcznie Z OPÓŹNIENIEM, mimo że TA SAMA transakcja
// była już w historii, złapana wcześniej np. przez powiadomienie z banku).
//
// Inny kierunek niż `findMatchingExpense` (bankNotification.ts): tamta
// funkcja dopasowuje PRZYCHODZĄCE powiadomienie z banku do już istniejącego
// wydatku, żeby je PODPIĄĆ — i świadomie pomija `bankMatched` (szuka
// wydatku jeszcze nie podpiętego). Tu user RĘCZNIE zapisuje nowy wydatek —
// sprawdzamy więc KAŻDY już istniejący wydatek (bankMatched czy nie) z tą
// samą kwotą tego samego dnia, bo właśnie bank-matched wpis jest tym, co
// najczęściej już istnieje, zanim user doda paragon z opóźnieniem.
export function findPossibleDuplicate(
  candidate: { amount: number; date: string },
  expenses: Expense[],
): Expense | null {
  const candTime = new Date(`${candidate.date}T00:00:00`).getTime();
  if (!candTime) return null;
  for (const e of expenses) {
    if (e.type !== 'expense') continue;
    if (!amountMatches(e, candidate.amount)) continue;
    const et = new Date(e.date ?? '').getTime();
    if (!et || !sameLocalDay(et, candTime)) continue;
    return e;
  }
  return null;
}
