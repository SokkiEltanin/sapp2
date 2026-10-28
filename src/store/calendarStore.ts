import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CalendarEvent, Task } from '@/types/calendar';
import { todayISO } from '@/utils/date';

// Port z sapp (src/store/calendarStore.ts), logika 1:1 — JEDNA świadoma różnica:
// standardowy `createJSONStorage(() => AsyncStorage)` zamiast sapp'owego
// `throttledPersistStorage()`. Ten throttling istnieje tam bo profiling na
// REALNYCH danych (wydatki/paragony, rosnące z wiekiem konta) złapał konkretny,
// zmierzony koszt JSON.stringify+write na każdym `set()`. sapp2 dopiero zaczyna
// (zero eventów/tasków w produkcji) — dodawanie tej optymalizacji TERAZ byłoby
// "burdel pod przyszłość" (CLAUDE.md), nie realny fix; dodamy ją jeśli/kiedy
// profiling na sapp2 pokaże ten sam objaw.
interface CalendarState {
  events: CalendarEvent[];
  gcalEvents: CalendarEvent[]; // Google Calendar events (gcal- prefix)
  tasks: Task[];
  selectedDate: string; // YYYY-MM-DD
  isLoading: boolean;

  setEvents: (events: CalendarEvent[]) => void;
  setGcalEvents: (events: CalendarEvent[]) => void;
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  deleteEvents: (ids: string[]) => void;

  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  setSelectedDate: (date: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      events: [],
      gcalEvents: [],
      tasks: [],
      selectedDate: todayISO(),
      isLoading: false,

      setEvents: (events) => set({ events }),
      setGcalEvents: (gcalEvents) => set({ gcalEvents }),
      addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
      updateEvent: (id, updates) =>
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
          gcalEvents: state.gcalEvents.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      deleteEvent: (id) =>
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
          gcalEvents: state.gcalEvents.filter((e) => e.id !== id),
        })),
      // Jedno `set()` zamiast N wywołań `deleteEvent` w pętli (np. "usuń wszystkie
      // zajęcia planu" — potrafi być kilkadziesiąt eventów naraz) — bez tego każdy
      // usunięty event osobno re-renderowałby wszystko co subskrybuje `gcalEvents`.
      deleteEvents: (ids) => {
        const idSet = new Set(ids);
        set((state) => ({
          events: state.events.filter((e) => !idSet.has(e.id)),
          gcalEvents: state.gcalEvents.filter((e) => !idSet.has(e.id)),
        }));
      },

      setTasks: (tasks) => set({ tasks }),
      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      deleteTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

      setSelectedDate: (selectedDate) => set({ selectedDate }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'calendar-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ events: state.events, tasks: state.tasks }),
    },
  ),
);
