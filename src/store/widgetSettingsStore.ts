import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Wygląd widgetu "Zadania" (2026-11-13, user: "ma ustawienia przezroczystości?").
// Źródło prawdy dla RENDEROWANIA = natywne SharedPreferences (ustawiane przez
// services/widgetSync.ts's applyWidgetAppearance); ten store trzyma wartości dla
// kontrolek w Ustawieniach i pozwala je odtworzyć (start appki / przywrócenie kopii).
export type WidgetTextScale = 'small' | 'medium' | 'large';

export const WIDGET_BG_COLORS: { key: string; label: string }[] = [
  { key: '#141414', label: 'Grafit' },
  { key: '#000000', label: 'Czarny' },
  { key: '#2A2A2A', label: 'Szary' },
  { key: '#0F1B2D', label: 'Granat' },
];

interface WidgetSettingsState {
  bgOpacity: number; // 0-100
  bgColor: string;
  textScale: WidgetTextScale;
  set: (patch: Partial<Pick<WidgetSettingsState, 'bgOpacity' | 'bgColor' | 'textScale'>>) => void;
}

export const useWidgetSettingsStore = create<WidgetSettingsState>()(
  persist(
    (set) => ({
      bgOpacity: 100,
      bgColor: '#141414',
      textScale: 'medium',
      set: (patch) => set(patch),
    }),
    { name: 'widget-settings-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
