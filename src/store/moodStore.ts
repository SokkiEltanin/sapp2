import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MoodEntry } from '@/types/mood';

// Ten sam wzorzec co `calendarStore.ts`/`expensesStore.ts`: offline-first AsyncStorage,
// Firestore sync jako osobna, ręczna warstwa (serwis), NIE auto-sync przy każdym CRUD.
// sapp's `moodStore` miał wbudowany `pendingSync`+Firestore prosto w akcjach store'a —
// świadomie NIE portowane, sapp2 trzyma tę granicę gdzie indziej (patrz expensesService).
interface MoodState {
  entries: MoodEntry[];
  isLoading: boolean;

  setEntries: (entries: MoodEntry[]) => void;
  addEntry: (entry: MoodEntry) => void;
  addEntries: (entries: MoodEntry[]) => void;
  updateEntry: (id: string, updates: Partial<MoodEntry>) => void;
  deleteEntry: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useMoodStore = create<MoodState>()(
  persist(
    (set) => ({
      entries: [],
      isLoading: false,

      setEntries: (entries) => set({ entries }),
      addEntry: (entry) => set((state) => ({ entries: [...state.entries, entry] })),
      // Ten sam fix co `expensesStore.ts`'s `addExpenses` (2026-11-09, import z sapp
      // "złapał całą apkę") — JEDEN `set()` zamiast N, dla importu wielu wpisów naraz.
      addEntries: (entries) => set((state) => ({ entries: [...state.entries, ...entries] })),
      updateEntry: (id, updates) =>
        set((state) => ({
          entries: state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      deleteEntry: (id) =>
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'mood-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ entries: state.entries }),
    },
  ),
);
