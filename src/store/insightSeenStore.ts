import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Kiedy appka pierwszy raz pokazała dany wzorzec (id → RRRR-MM-DD) — plakietka „nowy” na
// Dashboardzie (utils/insightRotation.ts). Lokalnie, per urządzenie.
interface SeenState {
  firstSeen: Record<string, string>;
  seeded: boolean;
  set: (firstSeen: Record<string, string>) => void;
}

export const useInsightSeenStore = create<SeenState>()(
  persist(
    (set) => ({ firstSeen: {}, seeded: false, set: (firstSeen) => set({ firstSeen, seeded: true }) }),
    { name: 'insight-seen-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ firstSeen: s.firstSeen, seeded: s.seeded }) },
  ),
);
