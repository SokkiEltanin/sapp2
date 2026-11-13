import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBalanceOffset } from '@/utils/balance';

// Korekta salda (2026-11-13) — wcześniej goły klucz AsyncStorage
// (utils/balance.ts's `account_balance_offset_v1`), teraz store, żeby
// synchronizacja (services/cloudSync.ts) dawała to samo saldo na komputerze.
// `null` = jeszcze nie przeniesione ze starego klucza (migracja po wczytaniu).
interface BalanceState {
  offset: number | null;
  setOffset: (offset: number) => void;
}

export const useBalanceStore = create<BalanceState>()(
  persist(
    (set) => ({ offset: null, setOffset: (offset) => { if (Number.isFinite(offset)) set({ offset }); } }),
    {
      name: 'balance-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (st) => ({ offset: st.offset }),
      onRehydrateStorage: () => (st) => {
        if (st && st.offset == null) getBalanceOffset().then((v) => useBalanceStore.setState({ offset: v })).catch(() => {});
      },
    },
  ),
);
