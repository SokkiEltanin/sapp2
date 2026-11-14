import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyThresholds, DEFAULT_THRESHOLDS, type Thresholds } from '@/utils/thresholds';

// Progi (2026-11-14) — patrz utils/thresholds.ts. Synchronizowane w `prefs`
// (cloudSync), w kopii; zmiana przelicza przypomnienia (hooki *ReminderSync).
interface ThresholdsState {
  t: Thresholds;
  set: (patch: Partial<Thresholds>) => void;
}

export const useThresholdsStore = create<ThresholdsState>()(
  persist(
    (set, get) => ({
      t: { ...DEFAULT_THRESHOLDS },
      set: (patch) => set({ t: applyThresholds({ ...get().t, ...patch }) }),
    }),
    {
      name: 'thresholds-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (st) => ({ t: st.t }),
      onRehydrateStorage: () => (st) => { if (st) applyThresholds(st.t); },
    },
  ),
);
