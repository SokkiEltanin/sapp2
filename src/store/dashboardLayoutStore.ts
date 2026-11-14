import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_ORDER, normalizeOrder, moveSection, type DashSection } from '@/utils/dashboardLayout';

// Układ Dashboardu (2026-11-14) — per urządzenie (telefon i komputer mogą mieć inny),
// w kopii zapasowej. UI: Ustawienia → Ogólne → Układ Dashboardu.
interface LayoutState {
  order: DashSection[];
  hidden: DashSection[];
  move: (id: DashSection, dir: -1 | 1) => void;
  toggle: (id: DashSection) => void;
  reset: () => void;
}

export const useDashboardLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      order: DEFAULT_ORDER,
      hidden: [],
      move: (id, dir) => set((st) => ({ order: moveSection(normalizeOrder(st.order), id, dir) })),
      toggle: (id) => set((st) => ({ hidden: st.hidden.includes(id) ? st.hidden.filter((x) => x !== id) : [...st.hidden, id] })),
      reset: () => set({ order: DEFAULT_ORDER, hidden: [] }),
    }),
    { name: 'dashboard-layout-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (st) => ({ order: st.order, hidden: st.hidden }) },
  ),
);
