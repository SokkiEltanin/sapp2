import { useEffect } from 'react';
import { useExpensesStore } from '@/store/expensesStore';
import { fixImportedTags } from '@/utils/importedTagFix';
import { useHydrated } from './useReplaceReminderSync';

// Sprzątanie tagów ze starej appki (utils/importedTagFix.ts) — po hydracji i po każdej
// zmianie wydatków (np. dane z chmury na nowym komputerze). Idempotentne: drugi
// przebieg nic nie zmienia, więc nie ma pętli. Zmienione wydatki dostają nowe
// `updatedAt` → sync wypycha poprawkę na pozostałe urządzenia.
export function useImportedTagFix() {
  const hydrated = useHydrated(useExpensesStore as any);
  useEffect(() => {
    if (!hydrated) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      const { expenses, setExpenses } = useExpensesStore.getState();
      const r = fixImportedTags(expenses);
      if (r.changed) setExpenses(r.expenses);
    };
    run();
    const unsub = useExpensesStore.subscribe((st, prev) => {
      if (st.expenses === prev.expenses) return;
      if (t) clearTimeout(t);
      t = setTimeout(run, 1500);
    });
    return () => { unsub(); if (t) clearTimeout(t); };
  }, [hydrated]);
}
