import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MoodEntry } from '@/types/mood';
import { safeStorage } from '@/services/safeStorage';
import { cleanMoodEntries } from '@/utils/moodClean';

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

      // Każdy zapis przez cleanMoodEntries (utils/moodClean.ts) — zły wpis nie wejdzie do listy.
      setEntries: (entries) => set({ entries: cleanMoodEntries(entries) }),
      addEntry: (entry) => set((state) => ({ entries: [...state.entries, ...cleanMoodEntries([entry])] })),
      // Ten sam fix co `expensesStore.ts`'s `addExpenses` (2026-11-09, import z sapp
      // "złapał całą apkę") — JEDEN `set()` zamiast N, dla importu wielu wpisów naraz.
      addEntries: (entries) => set((state) => ({ entries: [...state.entries, ...cleanMoodEntries(entries)] })),
      updateEntry: (id, updates) =>
        set((state) => ({
          entries: cleanMoodEntries(state.entries.map((e) => (e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e))),
        })),
      deleteEntry: (id) =>
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'mood-store-v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ entries: state.entries }),
      // Wpisy zapisane wcześniej (sync, stare wersje) też porządkujemy przy wczytaniu.
      merge: (persisted, current) => ({ ...current, ...(persisted as object), entries: cleanMoodEntries((persisted as { entries?: MoodEntry[] })?.entries ?? []) }),
    },
  ),
);
