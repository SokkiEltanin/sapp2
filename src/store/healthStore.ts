import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HealthDaySnapshot } from '@/types/health';

// Cache Health Connect — ten sam wzorzec co `habitsStore.ts`/`moodStore.ts`
// (zustand+persist+AsyncStorage). `connected` = user raz pomyślnie przeszedł
// `ensureHealthConnect()` z Ustawień (patrz `healthConnectService.ts`) — UI (kafle
// Dashboard/Daily) czyta TYLKO `today`, nie woła Health Connect bezpośrednio
// (patrz `hooks/useHealthSync.ts`).
interface HealthState {
  connected: boolean;
  today: HealthDaySnapshot | null;
  lastSyncedAt: string | null; // ISO
  setConnected: (v: boolean) => void;
  setToday: (snap: HealthDaySnapshot) => void;
}

export const useHealthStore = create<HealthState>()(
  persist(
    (set) => ({
      connected: false,
      today: null,
      lastSyncedAt: null,
      setConnected: (v) => set({ connected: v }),
      setToday: (snap) => set({ today: snap, lastSyncedAt: new Date().toISOString() }),
    }),
    {
      name: 'health-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ connected: state.connected, today: state.today, lastSyncedAt: state.lastSyncedAt }),
    },
  ),
);
