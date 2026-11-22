import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Odświeżanie w tle (2026-11-22, user: "praca w tle spoko, tylko pewnie zżerałoby baterię —
// w ustawieniach: co 15 min, co 1 h, co 3 h, nigdy"). 0 = nigdy (tylko po otwarciu appki).
export type BgInterval = 0 | 15 | 60 | 180;
export const BG_LABEL: Record<BgInterval, string> = { 0: 'nigdy (tylko po otwarciu)', 15: 'co 15 min', 60: 'co 1 h', 180: 'co 3 h' };
export const BG_ORDER: BgInterval[] = [15, 60, 180, 0];

interface BgState {
  interval: BgInterval;
  lastRun: number;      // ostatni przebieg w tle (ms)
  lastOk: boolean | null;
  setInterval: (v: BgInterval) => void;
  markRun: (ok: boolean) => void;
}

export const useBackgroundStore = create<BgState>()(
  persist(
    (set) => ({
      interval: 60,
      lastRun: 0,
      lastOk: null,
      setInterval: (interval) => set({ interval }),
      markRun: (ok) => set({ lastRun: Date.now(), lastOk: ok }),
    }),
    { name: 'background-refresh-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (st) => ({ interval: st.interval, lastRun: st.lastRun, lastOk: st.lastOk }) },
  ),
);
