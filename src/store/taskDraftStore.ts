import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Subtask } from '@/types/calendar';
import { safeStorage } from '@/services/safeStorage';

// Kopia robocza formularza zadania (2026-11-16, user: "jak piszę zadanie i nie kliknę
// dodaj, to mi usuwa wszystko... może dodać kopię roboczą"). Każda zmiana w
// AddTaskCard zapisuje się tu od razu (klucz 'new' albo id edytowanego zadania);
// zamknięcie okna bez "Dodaj"/"Zapisz" jej nie kasuje — przy następnym otwarciu wraca.
// Kasują ją: zapis zadania i "Anuluj"/"Wyczyść". Tylko to urządzenie (bez sync).
export interface TaskDraft {
  title: string;
  tag: string;
  deadlineChoice: string;
  custom: string | null;      // ISO dokładnego terminu
  customHasTime: boolean;
  steps: Subtask[];
  savedAt: string;
}

export const isDraftEmpty = (d: Pick<TaskDraft, 'title' | 'tag' | 'steps'> | null | undefined) =>
  !d || (!d.title.trim() && !d.tag.trim() && d.steps.length === 0);

interface DraftState {
  drafts: Record<string, TaskDraft>;
  save: (key: string, d: Omit<TaskDraft, 'savedAt'>) => void;
  clear: (key: string) => void;
}

export const useTaskDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      drafts: {},
      save: (key, d) => set((st) => {
        const next = { ...st.drafts };
        if (isDraftEmpty(d)) delete next[key];
        else next[key] = { ...d, savedAt: new Date().toISOString() };
        return { drafts: next };
      }),
      clear: (key) => set((st) => {
        if (!(key in st.drafts)) return st;
        const next = { ...st.drafts };
        delete next[key];
        return { drafts: next };
      }),
    }),
    { name: 'task-draft-v1', storage: createJSONStorage(() => safeStorage) },
  ),
);
