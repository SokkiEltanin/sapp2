import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Expense } from '@/types/finances';

// Finanse — Faza 2.1 (2026-10-31), ten sam wzorzec co `calendarStore.ts`:
// offline-first, AsyncStorage-persystowany, Firestore sync jako OSOBNA, ręczna
// warstwa (serwis dodany w kolejnym kroku), NIE auto-sync przy każdym CRUD — user
// potwierdził (2026-10-31) że to ma być dokładnie tak jak Kalendarz.
interface ExpensesState {
  expenses: Expense[];
  isLoading: boolean;

  setExpenses: (expenses: Expense[]) => void;
  addExpense: (expense: Expense) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useExpensesStore = create<ExpensesState>()(
  persist(
    (set) => ({
      expenses: [],
      isLoading: false,

      setExpenses: (expenses) => set({ expenses }),
      addExpense: (expense) => set((state) => ({ expenses: [...state.expenses, expense] })),
      updateExpense: (id, updates) =>
        set((state) => ({
          expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      deleteExpense: (id) =>
        set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) })),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'expenses-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ expenses: state.expenses }),
    },
  ),
);
