import { useEffect } from 'react';
import { useHealthStore } from '@/store/healthStore';
import { useCollectionStore } from '@/store/collectionStore';

// Dopisuje kroki/sen z Health Connect (30 dni w healthStore) do długiego dziennika
// kolekcji (store/collectionStore.ts) — rekordy i karty miesięcy widzą całą historię.
export function useCollectionUpkeep() {
  useEffect(() => {
    const absorb = () => {
      if (!useCollectionStore.persist.hasHydrated() || !useHealthStore.persist.hasHydrated()) return;
      useCollectionStore.getState().absorbHealth(useHealthStore.getState().history);
    };
    absorb();
    const u1 = useHealthStore.subscribe((s, p) => { if (s.history !== p.history) absorb(); });
    const u2 = useCollectionStore.persist.onFinishHydration(absorb);
    const u3 = useHealthStore.persist.onFinishHydration(absorb);
    return () => { u1(); u2(); u3(); };
  }, []);
}
