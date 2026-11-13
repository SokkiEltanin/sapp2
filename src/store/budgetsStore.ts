import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Budget, BudgetScope } from '@/types/budgets';

// Budżety miesięczne (2026-11-13). Logika: utils/budgets.ts; UI: kafel w
// Finansach + components/budgets/BudgetSheet.tsx; ostrzeżenia:
// services/budgetAlerts.ts. `notified` = który próg (80/100%) już zgłoszono w
// danym miesiącu — per urządzenie, NIE synchronizowane (każde ostrzega samo).
const genId = () => `bud_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface BudgetsState {
  budgets: Budget[];
  notified: Record<string, { month: string; level: 'warn' | 'over' }>;
  setBudget: (scope: BudgetScope, limit: number) => void; // dodaj albo zmień limit zakresu
  remove: (id: string) => void;
  markNotified: (id: string, month: string, level: 'warn' | 'over') => void;
}

export const useBudgetsStore = create<BudgetsState>()(
  persist(
    (set) => ({
      budgets: [],
      notified: {},
      setBudget: (scope, limit) => set((st) => {
        const now = new Date().toISOString();
        const cur = st.budgets.find((b) => b.scope === scope);
        if (cur) return { budgets: st.budgets.map((b) => (b.id === cur.id ? { ...b, limit, updatedAt: now } : b)) };
        return { budgets: [...st.budgets, { id: genId(), scope, limit, createdAt: now, updatedAt: now }] };
      }),
      remove: (id) => set((st) => ({ budgets: st.budgets.filter((b) => b.id !== id) })),
      markNotified: (id, month, level) => set((st) => ({ notified: { ...st.notified, [id]: { month, level } } })),
    }),
    { name: 'budgets-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
