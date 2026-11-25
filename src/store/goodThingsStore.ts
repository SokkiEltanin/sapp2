import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { goodId, type GoodThing } from '@/utils/goodThings';
import { safeStorage } from '@/services/safeStorage';

// Jedna dobra rzecz z dnia (2026-11-22) — synchronizowana (services/cloudSync.ts sync_good),
// w kopii zapasowej. Pusty tekst = usunięcie wpisu dnia.
interface GoodState {
  items: GoodThing[];
  setForDate: (date: string, text: string) => void;
}

export const useGoodThingsStore = create<GoodState>()(
  persist(
    (set) => ({
      items: [],
      setForDate: (date, text) => set((st) => {
        const t = text.trim();
        const id = goodId(date);
        const prev = st.items.find((g) => g.id === id);
        if (!t) return { items: st.items.filter((g) => g.id !== id) };
        const now = new Date().toISOString();
        if (prev) return prev.text === t ? st : { items: st.items.map((g) => (g.id === id ? { ...g, text: t, updatedAt: now } : g)) };
        return { items: [...st.items, { id, date, text: t, createdAt: now, updatedAt: now }] };
      }),
    }),
    { name: 'good-things-v1', storage: createJSONStorage(() => safeStorage), partialize: (st) => ({ items: st.items }) },
  ),
);
