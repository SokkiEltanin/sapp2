import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Wygląd widgetów na pulpit (2026-11-13; 2026-11-14 user: "rozdzielić ustawienia
// widgetów" — osobno Zadania i Pogoda). Źródło prawdy dla RENDEROWANIA = natywne
// SharedPreferences (services/widgetSync.ts's applyWidgetAppearance); ten store trzyma
// wartości dla kontrolek w Ustawieniach i pozwala je odtworzyć (start / przywrócenie kopii).
export type WidgetTextScale = 'small' | 'medium' | 'large';
export type WidgetId = 'tasks' | 'weather' | 'note';
export interface WidgetLook { bgOpacity: number; bgColor: string; textScale: WidgetTextScale }

export const WIDGET_BG_COLORS: { key: string; label: string }[] = [
  { key: '#141414', label: 'Grafit' },
  { key: '#000000', label: 'Czarny' },
  { key: '#2A2A2A', label: 'Szary' },
  { key: '#0F1B2D', label: 'Granat' },
];

export const DEFAULT_LOOK: WidgetLook = { bgOpacity: 100, bgColor: '#141414', textScale: 'medium' };

interface WidgetSettingsState {
  tasks: WidgetLook;
  weather: WidgetLook;
  note: WidgetLook;
  setLook: (id: WidgetId, patch: Partial<WidgetLook>) => void;
}

export const useWidgetSettingsStore = create<WidgetSettingsState>()(
  persist(
    (set) => ({
      tasks: DEFAULT_LOOK,
      weather: DEFAULT_LOOK,
      note: DEFAULT_LOOK,
      setLook: (id, patch) => set((st) => ({ [id]: { ...st[id], ...patch } }) as Partial<WidgetSettingsState>),
    }),
    {
      name: 'widget-settings-v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (st) => ({ tasks: st.tasks, weather: st.weather, note: st.note }),
      // v0 = jeden wspólny wygląd → ten sam dla obu widgetów.
      migrate: (old: any, version) => {
        if (version < 1 && old && typeof old === 'object') {
          const look: WidgetLook = {
            bgOpacity: typeof old.bgOpacity === 'number' ? old.bgOpacity : DEFAULT_LOOK.bgOpacity,
            bgColor: typeof old.bgColor === 'string' ? old.bgColor : DEFAULT_LOOK.bgColor,
            textScale: old.textScale ?? DEFAULT_LOOK.textScale,
          };
          return { tasks: look, weather: look, note: look };
        }
        return old;
      },
    },
  ),
);
