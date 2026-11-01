import { useBankQueue } from '@/store/bankQueueStore';
import { commitBankTx } from './bankCommit';

// Port z sapp (src/services/bankAutoProcess.ts) — sapp pokazywał toast po zakończeniu
// (`toastStore`), sapp2 nie ma jeszcze systemu toastów (żaden inny ekran w appce go nie
// używa), więc pominięty — znikająca kolejka + log w `bankQueueStore.history` to
// dotychczasowy, już ustalony w sapp2 sposób dawania feedbacku (ten sam co np.
// ProductsModal/AddExpenseModal, które też nie mają toastów).
//
// Auto-zatwierdza każdą zakolejkowaną płatność od ZAUFANEGO (auto) sprzedawcy. Odpalane
// w appce na pierwszym planie, żeby `expensesStore` było załadowane i dopasowywanie do
// paragonów było wiarygodne. Pozycje od jeszcze-niezaufanych sprzedawców zostają w
// kolejce do ręcznego przeglądu. Best-effort + zabezpieczone przed nakładającymi się
// wywołaniami.
let _running = false;

export async function processAutoBankQueue(): Promise<number> {
  if (_running) return 0;
  _running = true;
  try {
    const q = useBankQueue.getState();
    if (!q.enabled) return 0;
    const auto = q.pending.filter((p) => p.auto);
    if (!auto.length) return 0;

    let done = 0;
    for (const p of auto) {
      const r = await commitBankTx(p, { corrected: false });
      if (r.ok) {
        useBankQueue.getState().updateHistoryEntry(p.id, { matched: r.matched, expenseId: r.expenseId });
        useBankQueue.getState().remove(p.id);
        done++;
      }
    }
    return done;
  } finally {
    _running = false;
  }
}
