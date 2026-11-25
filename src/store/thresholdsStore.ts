import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { applyThresholds, DEFAULT_THRESHOLDS, type Thresholds } from '@/utils/thresholds';
import { safeStorage } from '@/services/safeStorage';

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
      storage: createJSONStorage(() => safeStorage),
      partialize: (st) => ({ t: st.t }),
      onRehydrateStorage: () => (st) => { if (st) applyThresholds(st.t); },
    },
  ),
);
