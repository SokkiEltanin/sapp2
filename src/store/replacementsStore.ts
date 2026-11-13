import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReplaceItem } from '@/types/replacements';
import { markReplaced, undoLastReplace } from '@/utils/replacements';

// Wymiany domowe (2026-11-13) — filtry, końcówki szczoteczek itd. Logika w
// utils/replacements.ts; ekran app/replacements.tsx; przypomnienia
// services/replaceReminders.ts; kafel Dashboardu "Najbliższa wymiana".
const genId = () => `rep_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

interface ReplacementsState {
  items: ReplaceItem[];
  add: (input: Omit<ReplaceItem, 'id' | 'createdAt' | 'updatedAt' | 'history'>) => ReplaceItem;
  update: (id: string, patch: Partial<ReplaceItem>) => void;
  remove: (id: string) => void;
  replaced: (id: string, date: string) => void;
  undo: (id: string) => void;
  dismissBuy: (id: string, expenseId: string) => void;
}

export const useReplacementsStore = create<ReplacementsState>()(
  persist(
    (set) => ({
      items: [],
      add: (input) => {
        const now = new Date().toISOString();
        const item: ReplaceItem = { ...input, id: genId(), history: [], createdAt: now, updatedAt: now };
        set((st) => ({ items: [...st.items, item] }));
        return item;
      },
      update: (id, patch) => set((st) => ({
        items: st.items.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)),
      })),
      remove: (id) => set((st) => ({ items: st.items.filter((x) => x.id !== id) })),
      replaced: (id, date) => set((st) => ({ items: st.items.map((x) => (x.id === id ? markReplaced(x, date) : x)) })),
      undo: (id) => set((st) => ({ items: st.items.map((x) => (x.id === id ? undoLastReplace(x) : x)) })),
      dismissBuy: (id, expenseId) => set((st) => ({
        items: st.items.map((x) => (x.id === id ? { ...x, dismissedBuys: [...(x.dismissedBuys ?? []), expenseId].slice(-100) } : x)),
      })),
    }),
    { name: 'replacements-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (st) => ({ items: st.items }) },
  ),
);
