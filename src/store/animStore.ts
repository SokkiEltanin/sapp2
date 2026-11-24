import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Animacje kafli (pogoda, pieniądze — components/design/pixelAnim.tsx). 2026-11-24, user: "na
// komputerze animacje zamrożone" — Windows z wyłączonymi "Efektami animacji" zgłasza przeglądarce
// "ogranicz ruch", a sceny słuchały systemu. Teraz domyślnie WŁĄCZONE; "według systemu" przywraca
// stare zachowanie, "wyłączone" = spokojne, nieruchome kafle. Lokalnie (per urządzenie).
export type AnimMode = 'on' | 'system' | 'off';
export const ANIM_ORDER: AnimMode[] = ['on', 'system', 'off'];
export const ANIM_LABEL: Record<AnimMode, string> = { on: 'Włączone', system: 'Według systemu', off: 'Wyłączone' };

interface AnimState { mode: AnimMode; setMode: (m: AnimMode) => void }

export const useAnimStore = create<AnimState>()(
  persist(
    (set) => ({ mode: 'on', setMode: (mode) => set({ mode }) }),
    { name: 'anim-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ mode: s.mode }) },
  ),
);
