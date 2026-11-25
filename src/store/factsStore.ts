import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FactCat } from '@/utils/factsData';
import { rollFact, mergeFacts, sanitizeFacts, type FactsData } from '@/utils/facts';
import { safeStorage } from '@/services/safeStorage';

// Stan Ciekawostek (2026-11-16) — logika w utils/facts.ts. Synchronizowany dokumentem
// `facts` (cloudSync), piszą OBA urządzenia; `merge` sumuje przeczytane/"znam", więc
// nic się nie powtórzy, nawet gdy telefon i komputer coś zmienią w tym samym czasie.
interface FactsState extends FactsData {
  ensureDay: (day: string) => void;          // przy wejściu w Daily
  knowIt: (day: string) => void;             // "Znam to" → od razu następna
  toggleCat: (cat: FactCat, day: string) => void;
  restart: (day: string) => void;            // po przeczytaniu wszystkich: od nowa (bez "znam")
  merge: (remote: unknown, day: string) => void;
}

const data = (s: FactsData): FactsData => ({ cur: s.cur, seen: s.seen, known: s.known, off: s.off, round: s.round, t: s.t });

export const useFactsStore = create<FactsState>()(
  persist(
    (set, get) => ({
      cur: null, seen: [], known: [], off: [], round: 0, t: 0,
      ensureDay: (day) => {
        const d = data(get());
        const n = rollFact(d, day, Date.now());
        if (n !== d) set(n);
      },
      knowIt: (day) => {
        const d = data(get());
        if (!d.cur) return;
        set(rollFact({ ...d, known: [...d.known, d.cur.id], t: Date.now() }, day, Date.now()));
      },
      toggleCat: (cat, day) => {
        const d = data(get());
        const off = d.off.includes(cat) ? d.off.filter((c) => c !== cat) : [...d.off, cat];
        set(rollFact({ ...d, off, t: Date.now() }, day, Date.now()));
      },
      restart: (day) => {
        const d = data(get());
        set(rollFact({ ...d, cur: null, seen: [], round: d.round + 1, t: Date.now() }, day, Date.now()));
      },
      merge: (remote, day) => set(mergeFacts(data(get()), sanitizeFacts(remote), day, Date.now())),
    }),
    { name: 'facts-v1', storage: createJSONStorage(() => safeStorage), partialize: (s) => data(s) },
  ),
);
