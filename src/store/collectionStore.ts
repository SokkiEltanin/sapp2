import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { HealthLog } from '@/utils/monthCards';
import type { RecordKey, Rec } from '@/utils/records';
import type { HealthDaySnapshot } from '@/types/health';
import { safeStorage } from '@/services/safeStorage';

// Kolekcja (2026-11-17): karty miesięcy + rekordy. Tu tylko to, czego nie da się
// odtworzyć z innych danych:
// - `healthLog` — własny długi dziennik kroków/snu (Health Connect w appce trzyma 30 dni,
//   a rekordy i karty potrzebują całej historii),
// - `manual` — rekordy wpisane ręcznie ("43k kroków"), `confirmed` — potwierdzone,
// - `cardsSeen` — ostatnia karta, którą user już widział (popup 1. dnia miesiąca).
// Synchronizowane dokumentem `collection` (cloudSync, `merge` sumuje dziennik).
interface CollectionData {
  healthLog: HealthLog;
  manual: Partial<Record<RecordKey, Rec>>;
  confirmed: Partial<Record<RecordKey, string>>;
  cardsSeen: string | null;
  t: number;
}
interface CollectionState extends CollectionData {
  absorbHealth: (history: Record<string, HealthDaySnapshot>) => void;
  setManual: (key: RecordKey, rec: Rec | null) => void;
  confirm: (key: RecordKey, sig: string | null) => void;
  markSeen: (key: string) => void;
  merge: (remote: Record<string, any>) => void;
}

const data = (s: CollectionData): CollectionData => ({ healthLog: s.healthLog, manual: s.manual, confirmed: s.confirmed, cardsSeen: s.cardsSeen, t: s.t });

export const useCollectionStore = create<CollectionState>()(
  persist(
    (set, get) => ({
      healthLog: {}, manual: {}, confirmed: {}, cardsSeen: null, t: 0,
      absorbHealth: (history) => {
        const log = get().healthLog;
        let changed = false;
        const next = { ...log };
        for (const [d, h] of Object.entries(history)) {
          const row: [number | null, number | null] = [h.steps ?? null, h.sleepMinutes ?? null];
          const cur = log[d];
          if (row[0] == null && row[1] == null) continue;
          if (!cur || cur[0] !== row[0] || cur[1] !== row[1]) { next[d] = row; changed = true; }
        }
        if (changed) set({ healthLog: next, t: Date.now() });
      },
      setManual: (key, rec) => {
        const manual = { ...get().manual };
        if (rec) manual[key] = rec; else delete manual[key];
        set({ manual, t: Date.now() });
      },
      confirm: (key, sig) => {
        const confirmed = { ...get().confirmed };
        if (sig) confirmed[key] = sig; else delete confirmed[key];
        set({ confirmed, t: Date.now() });
      },
      markSeen: (key) => { if ((get().cardsSeen ?? '') < key) set({ cardsSeen: key, t: Date.now() }); },
      merge: (r) => {
        const cur = get();
        const remoteT = typeof r?._t === 'number' ? r._t : typeof r?.t === 'number' ? r.t : 0;
        const newer = remoteT > cur.t;
        const log: HealthLog = { ...(r?.healthLog ?? {}), ...cur.healthLog };
        // Dzień z obu stron: większa liczba kroków / dłuższy sen (telefon mógł dosyncować).
        for (const [d, v] of Object.entries((r?.healthLog ?? {}) as HealthLog)) {
          const c = cur.healthLog[d];
          if (c && Array.isArray(v)) log[d] = [Math.max(c[0] ?? 0, v[0] ?? 0) || null, Math.max(c[1] ?? 0, v[1] ?? 0) || null];
        }
        const seen = [cur.cardsSeen, r?.cardsSeen].filter((x): x is string => typeof x === 'string').sort().pop() ?? null;
        set({
          healthLog: log,
          manual: newer && r?.manual && typeof r.manual === 'object' ? r.manual : cur.manual,
          confirmed: newer && r?.confirmed && typeof r.confirmed === 'object' ? r.confirmed : cur.confirmed,
          cardsSeen: seen,
          t: Math.max(cur.t, remoteT),
        });
      },
    }),
    { name: 'collection-v1', storage: createJSONStorage(() => safeStorage), partialize: (s) => data(s) },
  ),
);
