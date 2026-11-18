import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// S-Pen w notatkach (2026-11-18, user: "przycisk na S-Penie może włączać gumkę? w ustawieniach
// notatek; na samo wykrycie S-Pena palcami tylko przesuwam ekran, a notatka nieskończona w dół").
// Tylko lokalnie (rysik jest per urządzenie) — bez chmury.
// - fingerScroll: gdy appka WYKRYŁA S-Pen (stylusSeen), palec przewija stronę, rysuje tylko rysik.
// - buttonEraser: trzymany przycisk S-Pena = gumka na czas kreski (natywnie: plugins/withStylus.js).
interface PenState {
  fingerScroll: boolean;
  buttonEraser: boolean;
  stylusSeen: boolean;
  set: (p: Partial<Pick<PenState, 'fingerScroll' | 'buttonEraser' | 'stylusSeen'>>) => void;
}

export const usePenStore = create<PenState>()(
  persist(
    (set) => ({
      fingerScroll: true,
      buttonEraser: true,
      stylusSeen: false,
      set: (p) => set(p),
    }),
    { name: 'pen-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ fingerScroll: s.fingerScroll, buttonEraser: s.buttonEraser, stylusSeen: s.stylusSeen }) },
  ),
);
