import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CategoryRule, RuleField } from '@/types/categoryRules';
import { safeStorage } from '@/services/safeStorage';

// Reguły kategoryzacji (2026-11-14) — patrz types/categoryRules.ts. Synchronizowane
// (cloudSync `sync_rules`), w kopii i przywracaniu (cloudBackup applyEntries).
const genId = () => `rule_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface RulesState {
  rules: CategoryRule[];
  add: (r: { field: RuleField; match: string; kind: 'food' | 'var' | 'own'; tag: string }) => CategoryRule;
  remove: (id: string) => void;
}

export const useCategoryRulesStore = create<RulesState>()(
  persist(
    (set) => ({
      rules: [],
      add: (r) => {
        const now = new Date().toISOString();
        const rule: CategoryRule = { id: genId(), ...r, match: r.match.trim(), createdAt: now, updatedAt: now };
        set((st) => ({ rules: [...st.rules.filter((x) => !(x.field === r.field && x.match.trim().toLowerCase() === rule.match.toLowerCase())), rule] }));
        return rule;
      },
      remove: (id) => set((st) => ({ rules: st.rules.filter((r) => r.id !== id) })),
    }),
    { name: 'category-rules-v1', storage: createJSONStorage(() => safeStorage) },
  ),
);
