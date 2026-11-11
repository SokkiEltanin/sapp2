import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Subscription } from '@/types/subscriptions';

function genId(): string {
  return `sub_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

interface SubscriptionsState {
  subscriptions: Subscription[];

  addSubscription: (input: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => Subscription;
  // Import z sapp (2026-11-11) — gotowe obiekty z WŁASNYM id (`sapp_<id>`, dedup
  // przy ponownym imporcie), jeden `set()` = jeden zapis persist.
  addSubscriptions: (subs: Subscription[]) => void;
  updateSubscription: (id: string, patch: Partial<Subscription>) => void;
  deleteSubscription: (id: string) => void;
  // Rachunki WYKRYTE z historii (utils/recurringBills.ts's `detectRecurringBills`),
  // które user odrzucił "to nie jest stała opłata" (2026-11-11, user: "pisze 28 dni
  // do internet nie wiem skąd") — tagi BILL_TYPES; bez tego błędnie wykryty
  // rachunek wisiałby w "Najbliższej opłacie" na zawsze.
  dismissedBills: string[];
  dismissBill: (tag: string) => void;
  restoreBill: (tag: string) => void;
}

// Offline-first AsyncStorage, ten sam wzorzec co workStore.ts/vehiclesStore.ts —
// bez Firestore sync (sapp2 ma osobny, prostszy "Stałe opłaty" niż sapp — patrz
// src/types/subscriptions.ts).
export const useSubscriptionsStore = create<SubscriptionsState>()(
  persist(
    (set, get) => ({
      subscriptions: [],

      addSubscription: (input) => {
        const now = Date.now();
        const sub: Subscription = { ...input, id: genId(), createdAt: now, updatedAt: now };
        set({ subscriptions: [...get().subscriptions, sub] });
        return sub;
      },
      addSubscriptions: (subs) => set((s) => ({ subscriptions: [...s.subscriptions, ...subs] })),
      updateSubscription: (id, patch) => set((s) => ({
        subscriptions: s.subscriptions.map((sub) => (sub.id === id ? { ...sub, ...patch, updatedAt: Date.now() } : sub)),
      })),
      deleteSubscription: (id) => set((s) => ({ subscriptions: s.subscriptions.filter((sub) => sub.id !== id) })),
      dismissedBills: [],
      dismissBill: (tag) => set((s) => ({ dismissedBills: s.dismissedBills.includes(tag) ? s.dismissedBills : [...s.dismissedBills, tag] })),
      restoreBill: (tag) => set((s) => ({ dismissedBills: s.dismissedBills.filter((t) => t !== tag) })),
    }),
    { name: 'subscriptions-storage', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
