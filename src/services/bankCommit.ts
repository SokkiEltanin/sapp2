import { useExpensesStore } from '@/store/expensesStore';
import { useWorkStore } from '@/store/workStore';
import { findMatchingExpense, findMatchingIncome, sameLocalDay, localDayKey, amountMatches } from '@/utils/bankNotification';
import { withLock } from '@/utils/asyncLock';
import { recordMerchantAccept, MerchantInfo } from '@/utils/merchantMemory';
import { rememberPaycheckSender, rememberPaycheckSenderEmployer } from '@/utils/paycheckSenders';
import { PendingBankTx, useBankQueue, type BankIngestHistoryEntry } from '@/store/bankQueueStore';
import type { Expense } from '@/types/finances';

// Port z sapp (src/services/bankCommit.ts), ZMNIEJSZONY do tego co sapp2 faktycznie ma:
// sapp tu też auto-opłacał subskrypcje (`subscriptionsStore`) i oznaczał "payday handled"
// (`payday.ts`) — sapp2 jeszcze nie auto-opłaca Subskrypcji z banku (osobna, odłożona
// runda, patrz ARCHITECTURE.md §SUBSKRYPCJE), więc TA konkretna integracja odpada.
// Dopisywanie prefiksu pracodawcy ("workStore") NATOMIAST JEST wpięte (2026-11-09, bug:
// tag 'wypłata' sam nie wystarczał Pracy, patrz `paycheckEmployerId` niżej). Druga,
// ważniejsza różnica: sapp pisał do Firestore NAJPIERW (`await expensesService.add()`),
// dopiero potem do lokalnego store'a — sapp2 jest celowo offline-first (patrz CLAUDE.md/
// AddExpenseModal.tsx), więc commit jest SYNCHRONICZNY: `useExpensesStore.getState()`
// bezpośrednio, Firestore sync to osobna, ręczna warstwa (nigdy nie blokuje zapisu).
function genId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export interface CommitResult {
  ok: boolean;
  matched: boolean;        // scalono z już dodanym wydatkiem, zamiast dodać nowy
  merchant?: MerchantInfo; // zaktualizowane zaufanie (cleanAccepts/auto)
  expenseId?: string;      // do historii/"Cofnij" (patrz bankQueueStore.ts)
}

// Zamienia JEDNĄ potwierdzoną płatność z banku w prawdziwy wydatek: jeśli pasujący
// wydatek (ta sama kwota, blisko w czasie) już istnieje, oznacza go jako dopasowany
// zamiast dodawać drugi; inaczej dodaje nowy. Potem uczy pamięć sprzedawcy (chyba że
// `learn:false`). Współdzielone przez ekran przeglądu i auto-procesor, więc oba
// zachowują się identycznie.
export async function commitBankTx(
  p: PendingBankTx,
  opts?: { corrected?: boolean; learn?: boolean },
): Promise<CommitResult> {
  // Zamek kluczowany kierunek+kwota+dzień — bez tego dwa NIEZALEŻNE commity tej samej
  // płatności (powiadomienie z banku + ręcznie dodany paragon, w odstępie milisekund)
  // oba czytałyby `st.expenses` ZANIM drugi zdążył dopisać swój wpis — każdy z osobna
  // poprawnie NIE widziałby duplikatu, bo go jeszcze nie było. `st` jest POBIERANE
  // WEWNĄTRZ zamka, nie raz na starcie funkcji.
  const lockKey = `${p.direction}:${p.amount.toFixed(2)}:${localDayKey(new Date(p.dateISO).getTime())}`;
  return withLock(lockKey, async (): Promise<CommitResult> => {
    const st = useExpensesStore.getState();
    const now = new Date().toISOString();
    const source: Expense['source'] = p.auto ? 'bank-auto' : 'bank';
    // Waluta obca (2026-11-09, user: "jak obca waluta niech się nie liczy
    // bezpośrednio tylko po kliknięciu trzeba wprowadzić ile to w PLN żeby
    // zapisać i wtedy się liczy") — surowe cyfry obcej waluty NIE wchodzą jako
    // `amount` (zafałszowałyby sumy/saldo, które zakładają PLN); zamiast tego
    // `amount: 0` (0 nic nie wnosi do żadnej sumy, zero specjalnej obsługi
    // potrzebnej w balance.ts/fixedVariable.ts) + oryginał w `originalAmount`/
    // `originalCurrency` — `AddExpenseModal.tsx` pokazuje to jako baner i
    // wymaga realnej kwoty PLN zanim pozwoli zapisać. `originalAmount` to
    // JUŻ ISTNIEJĄCE pole które `amountMatches` (bankNotification.ts) sprawdza
    // jako fallback dedup — powtórnie dostarczone powiadomienie o TEJ SAMEJ
    // płatności (surowa kwota, nie 0) dalej trafi w już-zaksięgowany wpis.
    const isForeign = p.currency !== 'PLN';
    const fxFields = isForeign ? { originalAmount: p.amount, originalCurrency: p.currency } : {};

    // ── Przelew przychodzący → przychód ────────────────────────────────────
    if (p.direction === 'in') {
      const pTimeIn = new Date(p.dateISO).getTime();
      const alreadyIncome = st.expenses.find((e) =>
        e.type === 'income'
        && amountMatches(e, p.amount)
        && !!e.date && sameLocalDay(new Date(e.date).getTime(), pTimeIn));
      if (alreadyIncome) {
        if (!alreadyIncome.bankMatched) st.updateExpense(alreadyIncome.id, { bankMatched: true, updatedAt: now });
        return { ok: true, matched: true, expenseId: alreadyIncome.id };
      }
      const dup = findMatchingIncome(p, st.expenses);
      if (dup) {
        st.updateExpense(dup.id, { bankMatched: true, updatedAt: now });
        return { ok: true, matched: true, expenseId: dup.id };
      }
      // Prefiks pracodawcy (2026-11-09, bug — user: "zaznaczyłem w potwierdzeniach
      // że to wypłata ale nie miałem jak prefiksu... i mi nie łapie"): sam tag
      // 'wypłata' NIE wystarczał `utils/paycheck.ts`'s `isPaycheck()`, która wymaga
      // taga/notatki pasującej do KONKRETNEGO `Employer.workPrefix` — appka po
      // prostu nie dawała gdzie ten prefiks wpisać. `p.paycheckEmployerId` (ustawiane
      // w bank-review.tsx przy przełączeniu "Wypłata z pracy", domyślnie aktywny
      // pracodawca) wskazuje KTÓREGO — jego `workPrefix` dołącza się jako DRUGI tag
      // obok generycznego 'wypłata' (ten zostaje dla ogólnego filtrowania/importu z
      // sapp, patrz dataImportFromSapp.ts's CATEGORY_TO_TAG).
      const payEmployer = p.isPaycheck
        ? useWorkStore.getState().employers.find((e) => e.id === p.paycheckEmployerId)
        : undefined;
      const payTags = p.isPaycheck ? ['wypłata', ...(payEmployer?.workPrefix ? [payEmployer.workPrefix] : [])] : [];
      const newIncomeId = genId();
      st.addExpense({
        id: newIncomeId, type: 'income', amount: isForeign ? 0 : p.amount, date: p.dateISO,
        note: p.store || 'Przychód', tags: payTags,
        paymentMethod: 'card', bankMatched: true, source, createdAt: now, updatedAt: now,
        ...fxFields,
      });
      if (p.isPaycheck) {
        rememberPaycheckSender(p.storeKey).catch(() => {});
        if (payEmployer) rememberPaycheckSenderEmployer(p.storeKey, payEmployer.id).catch(() => {});
      }
      return { ok: true, matched: false, expenseId: newIncomeId };
    }

    // Dedup: redostarczone/powtórnie osuszone powiadomienie NIE może zaksięgować tej
    // samej płatności drugi raz — w tym jednej, którą już kiedyś zaksięgowaliśmy z banku
    // (findMatchingExpense pomija bankMatched, więc nie złapie re-drainu).
    const pTime = new Date(p.dateISO).getTime();
    const storeMatches = (e: { storeName?: string; note?: string }) => {
      const hay = `${e.storeName ?? ''} ${e.note ?? ''}`.toLowerCase();
      return !p.storeKey || hay.includes(p.storeKey) || p.storeKey.includes((e.storeName ?? '').toLowerCase().split(/\s+/)[0] ?? '');
    };
    const already = st.expenses.find((e) =>
      e.type === 'expense'
      && amountMatches(e, p.amount)
      && !!e.date && sameLocalDay(new Date(e.date).getTime(), pTime)
      && storeMatches(e));
    if (already) {
      if (!already.bankMatched) st.updateExpense(already.id, { bankMatched: true, updatedAt: now });
      return { ok: true, matched: true, expenseId: already.id };
    }

    const match = findMatchingExpense(p, st.expenses);
    let expenseId: string;
    if (match) {
      st.updateExpense(match.id, { bankMatched: true, updatedAt: now });
      expenseId = match.id;
    } else {
      expenseId = genId();
      st.addExpense({
        id: expenseId, type: 'expense', amount: isForeign ? 0 : p.amount, date: p.dateISO,
        note: p.store || (p.selfTransfer ? 'Przelew na oszczędności' : 'Płatność'),
        tags: p.tags ?? [],
        ...(p.store ? { storeName: p.store } : {}),
        paymentMethod: p.method === 'cash' ? 'cash' : (p.method === 'blik' ? 'blik' : (p.method === 'transfer' ? 'transfer' : 'card')),
        bankMatched: true, source, createdAt: now, updatedAt: now,
        ...fxFields,
      });
    }
    let merchant: MerchantInfo | undefined;
    if (opts?.learn !== false) {
      merchant = await recordMerchantAccept(p.storeKey, { tags: p.tags ?? [], name: p.store, corrected: !!opts?.corrected });
    }
    return { ok: true, matched: !!match, merchant, expenseId };
  });
}

// "Cofnij" w historii (2026-11-01, user: "mam nadzieję że zrobiłeś w zatwierdzeniu
// historię żebym mógł cofnąć") — para do `commitBankTx`. `matched:false` (commit
// DODAŁ nowy wydatek) → cofnięcie go usuwa całkiem. `matched:true` (commit tylko
// SCALIŁ z już istniejącym wydatkiem, ustawiając `bankMatched`) → cofnięcie NIE
// usuwa tego wydatku (istniał niezależnie od powiadomienia z banku, mógł być dodany
// ręcznie) — tylko odpina `bankMatched`, żeby znowu mógł dopasować się do powiadomienia
// później. Nie "oducza" pamięci sprzedawcy (merchantMemory) — to by wymagało wiedzieć
// czy user zaakceptował tego sprzedawcy inne płatności w międzyczasie, osobny,
// nieproszony problem.
export async function undoBankHistoryEntry(entry: BankIngestHistoryEntry): Promise<boolean> {
  if (!entry.expenseId) return false;
  const st = useExpensesStore.getState();
  if (entry.matched) {
    st.updateExpense(entry.expenseId, { bankMatched: false, updatedAt: new Date().toISOString() });
  } else {
    st.deleteExpense(entry.expenseId);
  }
  useBankQueue.getState().updateHistoryEntry(entry.id, { undone: true });
  return true;
}
