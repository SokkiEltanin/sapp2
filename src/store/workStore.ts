import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Employer } from '@/types/work';

function genEmployerId(): string {
  return `emp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

interface WorkState {
  employers: Employer[];
  activeEmployerId: string | null;

  addEmployer: (input: Omit<Employer, 'id' | 'createdAt'>) => Employer;
  updateEmployer: (id: string, patch: Partial<Employer>) => void;
  toggleEmployerHidden: (id: string) => void;
  setActiveEmployer: (id: string | null) => void;
}

// Offline-first AsyncStorage, ten sam wzorzec co moodStore.ts/calendarStore.ts — bez
// Firestore sync (Praca to dane prywatne/lokalne, sapp2 nie synchronizuje ich między
// urządzeniami, tak jak reszta finansów).
export const useWorkStore = create<WorkState>()(
  persist(
    (set, get) => ({
      employers: [],
      activeEmployerId: null,

      addEmployer: (input) => {
        const emp: Employer = { ...input, id: genEmployerId(), createdAt: Date.now() };
        const employers = [...get().employers, emp];
        // Pierwszy dodany pracodawca od razu aktywny — inaczej lista istnieje, ale nic
        // nie liczy się nigdzie (ten sam UX co sapp's migracja, tylko bez legacy bagażu).
        set({ employers, activeEmployerId: get().activeEmployerId ?? emp.id });
        return emp;
      },
      updateEmployer: (id, patch) => set((s) => ({
        employers: s.employers.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),
      // "wyłącz stare żeby były, ale widzieć tylko z nowej pracy" (sapp, user) — miękkie
      // ukrycie z ŁĄCZNYCH statystyk, dane zostają, można odkryć z powrotem. Nigdy nie
      // usuwa pracodawcę z danymi — zbyt ryzykowne dla realnych zarobków bez wyraźnego asku.
      toggleEmployerHidden: (id) => set((s) => ({
        employers: s.employers.map((e) => (e.id === id ? { ...e, hidden: !e.hidden } : e)),
      })),
      setActiveEmployer: (id) => set({ activeEmployerId: id }),
    }),
    { name: 'work-storage', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
