import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Który event kalendarza user wybrał do odliczania na kafelku "Odliczanie" w
// Finanse (patrz src/utils/countdown.ts) — tylko jeden ID, bo kafel pokazuje
// jedno odliczanie naraz. Persist żeby wybór przeżył restart appki.
interface CountdownState {
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
}

export const useCountdownStore = create<CountdownState>()(
  persist(
    (set) => ({
      selectedEventId: null,
      setSelectedEventId: (id) => set({ selectedEventId: id }),
    }),
    { name: 'countdown-storage', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
