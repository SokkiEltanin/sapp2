import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Które tagi kalendarza trafiają do "Planu dnia" w Daily (2026-11-13). `null` =
// jeszcze nie wybrano → pokazujemy wszystkie wydarzenia + podpowiedź wyboru.
interface DayPlanState {
  tags: string[] | null;
  setTags: (tags: string[] | null) => void;
}

export const useDayPlanStore = create<DayPlanState>()(
  persist(
    (set) => ({ tags: null, setTags: (tags) => set({ tags }) }),
    { name: 'day-plan-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
