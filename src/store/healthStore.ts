import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HealthDaySnapshot } from '@/types/health';

// Cache Health Connect — ten sam wzorzec co `habitsStore.ts`/`moodStore.ts`
// (zustand+persist+AsyncStorage). `connected` = user raz pomyślnie przeszedł
// `ensureHealthConnect()` z Ustawień (patrz `healthConnectService.ts`) — UI czyta
// TYLKO store, nie woła Health Connect bezpośrednio (patrz `hooks/useHealthSync.ts`).
//
// 2026-11-13 (Daily: szczegóły snu, tydzień kroków): `history` = snapshoty ostatnich
// dni (klucz YYYY-MM-DD, max 30), `manualWeights` = waga wpisana ręcznie w appce
// (Health Connect tylko do odczytu — nie prosimy o zapis).
export interface ManualWeight { date: string; kg: number; at: string }

interface HealthState {
  connected: boolean;
  today: HealthDaySnapshot | null;
  history: Record<string, HealthDaySnapshot>;
  manualWeights: ManualWeight[];
  lastSyncedAt: string | null; // ISO
  setConnected: (v: boolean) => void;
  setToday: (snap: HealthDaySnapshot) => void;
  setDay: (snap: HealthDaySnapshot) => void;
  addWeight: (kg: number, date: string) => void;
  removeWeight: (at: string) => void;
}

const trim = (h: Record<string, HealthDaySnapshot>) => {
  const keys = Object.keys(h).sort().slice(-30);
  return Object.fromEntries(keys.map((k) => [k, h[k]]));
};

export const useHealthStore = create<HealthState>()(
  persist(
    (set) => ({
      connected: false,
      today: null,
      history: {},
      manualWeights: [],
      lastSyncedAt: null,
      setConnected: (v) => set({ connected: v }),
      setToday: (snap) => set((st) => ({ today: snap, history: trim({ ...st.history, [snap.date]: snap }), lastSyncedAt: new Date().toISOString() })),
      setDay: (snap) => set((st) => ({ history: trim({ ...st.history, [snap.date]: snap }) })),
      addWeight: (kg, date) => set((st) => ({ manualWeights: [...st.manualWeights, { date, kg, at: new Date().toISOString() }].slice(-200) })),
      removeWeight: (at) => set((st) => ({ manualWeights: st.manualWeights.filter((w) => w.at !== at) })),
    }),
    {
      name: 'health-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        connected: state.connected, today: state.today, history: state.history,
        manualWeights: state.manualWeights, lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
);
