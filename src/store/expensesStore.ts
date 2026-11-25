import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Expense } from '@/types/finances';
import { useCategoryRulesStore } from './categoryRulesStore';
import { applyCategoryRules } from '@/utils/categoryRules';
import { safeStorage } from '@/services/safeStorage';

// Finanse — Faza 2.1 (2026-10-31), ten sam wzorzec co `calendarStore.ts`:
// offline-first, AsyncStorage-persystowany, Firestore sync jako OSOBNA, ręczna
// warstwa (serwis dodany w kolejnym kroku), NIE auto-sync przy każdym CRUD — user
// potwierdził (2026-10-31) że to ma być dokładnie tak jak Kalendarz.
interface ExpensesState {
  expenses: Expense[];
  isLoading: boolean;

  setExpenses: (expenses: Expense[]) => void;
  addExpense: (expense: Expense) => void;
  addExpenses: (expenses: Expense[]) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

function withRules(e: Expense): Expense {
  const rules = useCategoryRulesStore.getState().rules;
  return (rules.length && applyCategoryRules(e, rules)) || e;
}

export const useExpensesStore = create<ExpensesState>()(
  persist(
    (set) => ({
      expenses: [],
      isLoading: false,

      setExpenses: (expenses) => set({ expenses }),
      // Reguły kategoryzacji użytkownika (2026-11-14) uzupełniają puste kategorie przy
      // KAŻDYM dodaniu (bank, paragon, ręcznie, import) — utils/categoryRules.ts.
      addExpense: (expense) => set((state) => ({ expenses: [...state.expenses, withRules(expense)] })),
      // 2026-11-09, bug fix — import z sapp (dataImportFromSapp.ts) wołał `addExpense`
      // W PĘTLI, po jednym na wydatek: każde wywołanie kopiowało CAŁĄ rosnącą tablicę
      // (`[...state.expenses, expense]`) I wyzwalało osobny zapis `persist` do
      // AsyncStorage (pełna serializacja JSON za każdym razem) — dla importu
      // liczącego setki/tysiące wydatków to O(n²) kopiowania + n pełnych zapisów na
      // dysk W JEDNEJ SYNCHRONICZNEJ PĘTLI, bez oddania sterowania JS threadowi —
      // user: "dane sie nie zaczynały złapało cała apke". `addExpenses` dodaje
      // WSZYSTKIE naraz, JEDNYM `set()` → JEDNYM zapisem persist.
      addExpenses: (expenses) => set((state) => ({ expenses: [...state.expenses, ...expenses.map(withRules)] })),
      updateExpense: (id, updates) =>
        set((state) => ({
          // updatedAt — synchronizacja (wygrywa nowsza zmiana) musi wiedzieć, kiedy.
          expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e)),
        })),
      deleteExpense: (id) =>
        set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) })),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'expenses-store-v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ expenses: state.expenses }),
    },
  ),
);
