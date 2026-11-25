import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_ORDER, DEFAULT_HIDDEN, normalizeOrder, moveSection, migrateLayoutV1, type DashSection } from '@/utils/dashboardLayout';
import { safeStorage } from '@/services/safeStorage';

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
      hidden: DEFAULT_HIDDEN,
      move: (id, dir) => set((st) => ({ order: moveSection(normalizeOrder(st.order), id, dir) })),
      toggle: (id) => set((st) => ({ hidden: st.hidden.includes(id) ? st.hidden.filter((x) => x !== id) : [...st.hidden, id] })),
      reset: () => set({ order: DEFAULT_ORDER, hidden: DEFAULT_HIDDEN }),
    }),
    {
      name: 'dashboard-layout-v1', storage: createJSONStorage(() => safeStorage), partialize: (st) => ({ order: st.order, hidden: st.hidden }),
      // v1 (2026-11-22): "Czas z telefonem" na miejsce #JedzeniePerMiesiąc (utils/dashboardLayout.ts).
      version: 1,
      migrate: (persisted, from) => (from < 1 ? migrateLayoutV1((persisted ?? {}) as any) : persisted) as any,
    },
  ),
);
