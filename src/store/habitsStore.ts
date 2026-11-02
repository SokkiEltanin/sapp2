import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HabitDay, HabitKey } from '@/types/habits';

// Ten sam wzorzec co `moodStore.ts`/`calendarStore.ts`/`expensesStore.ts`:
// offline-first AsyncStorage, zero Firestore-sync w akcjach store'a.
interface HabitsState {
  days: HabitDay[];
  setHabit: (date: string, key: HabitKey, value: boolean) => void;
}

function emptyDay(date: string): HabitDay {
  return { date, water: false, sweets: false, training: false };
}

export const useHabitsStore = create<HabitsState>()(
  persist(
    (set) => ({
      days: [],
      setHabit: (date, key, value) =>
        set((state) => {
          const idx = state.days.findIndex((d) => d.date === date);
          if (idx === -1) return { days: [...state.days, { ...emptyDay(date), [key]: value }] };
          const days = [...state.days];
          days[idx] = { ...days[idx], [key]: value };
          return { days };
        }),
    }),
    {
      name: 'habits-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ days: state.days }),
    },
  ),
);
