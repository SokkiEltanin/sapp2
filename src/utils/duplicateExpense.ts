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

// Lepszy wybór kandydata + łączenie paragonu z już złapaną płatnością
// (2026-11-12, user: "jak dodaję paragon z lidla to się mnie pyta czy płatność
// dodać i jak klikam tak to mi dubluje a powinno rozumieć że to to samo co
// złapało z powiadomień tylko bez paragonu"). Baner miał tylko "Zapisz mimo
// to" → dubel. Teraz paragon WCHODZI do istniejącego wpisu.
const firstWord = (s?: string) => (s ?? '').trim().toLowerCase().split(/\s+/)[0] ?? '';

export function storesLookSame(a?: string, b?: string): boolean {
  const x = firstWord(a), y = firstWord(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(y) || y.startsWith(x);
}

// Jak findPossibleDuplicate, ale wśród kilku kandydatów woli ten bez
// paragonu i z tym samym sklepem (to właśnie "goła" płatność z banku).
export function findReceiptTarget(
  candidate: { amount: number; date: string; storeName?: string },
  expenses: Expense[],
): Expense | null {
  const candTime = new Date(`${candidate.date}T00:00:00`).getTime();
  if (!candTime) return null;
  let best: { e: Expense; score: number } | null = null;
  for (const e of expenses) {
    if (e.type !== 'expense' || !amountMatches(e, candidate.amount)) continue;
    const et = new Date(e.date ?? '').getTime();
    if (!et || !sameLocalDay(et, candTime)) continue;
    const score = (e.receiptItems?.length ? 0 : 2) + (storesLookSame(e.storeName || e.note, candidate.storeName) ? 1 : 0);
    if (!best || score > best.score) best = { e, score };
  }
  return best ? best.e : null;
}

// Pewne dopasowanie = łączymy BEZ pytania: wpis z banku (bankMatched), jeszcze
// bez paragonu, ten sam sklep. Wszystko inne → baner z wyborem.
export function isConfidentReceiptMatch(existing: Expense, receiptStore?: string): boolean {
  return !!existing.bankMatched && !existing.receiptItems?.length && storesLookSame(existing.storeName || existing.note, receiptStore);
}

// Pola z paragonu nadpisują/uzupełniają istniejący wpis. Zostaje: id, DATA
// (z godziną powiadomienia — paragon ma sam dzień), bankMatched, source.
export function mergeReceiptInto(
  existing: Expense,
  receipt: Partial<Pick<Expense, 'amount' | 'note' | 'storeName' | 'tags' | 'receiptItems' | 'fvOverride' | 'expenseCategory' | 'paymentMethod' | 'payer'>>,
): Partial<Expense> {
  const tags = [...(existing.tags ?? [])];
  for (const t of receipt.tags ?? []) if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) tags.push(t);
  return {
    amount: receipt.amount ?? existing.amount,
    note: receipt.note?.trim() ? receipt.note.trim() : existing.note,
    storeName: receipt.storeName?.trim() ? receipt.storeName.trim() : existing.storeName,
    tags,
    receiptItems: receipt.receiptItems?.length ? receipt.receiptItems : existing.receiptItems,
    fvOverride: receipt.fvOverride ?? existing.fvOverride,
    expenseCategory: receipt.expenseCategory ?? existing.expenseCategory,
    paymentMethod: existing.paymentMethod ?? receipt.paymentMethod,
    payer: receipt.payer ?? existing.payer,
  };
}
