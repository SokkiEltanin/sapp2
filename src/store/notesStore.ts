import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Note, NoteKind, NoteItem } from '@/types/notes';

// Notatki (2026-11-14). Ekran: app/notes.tsx (lista) + app/note.tsx (edytor).
// Dashboard: przypięta notatka (`pinned`, najwyżej jedna). Synchronizacja:
// services/cloudSync.ts (`sync_notes`), kopia zapasowa: services/cloudBackup.ts.
export const genNoteId = (p = 'note') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const now = () => new Date().toISOString();

interface NotesState {
  notes: Note[];
  create: (kind: NoteKind, pinned?: boolean) => Note;
  update: (id: string, patch: Partial<Note>) => void;
  remove: (id: string) => void;
  setPinned: (id: string, pinned: boolean) => void;
  toggleItem: (noteId: string, itemId: string) => void;
  setItems: (noteId: string, items: NoteItem[]) => void;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: [],
      create: (kind, pinned = false) => {
        const t = now();
        const note: Note = { id: genNoteId(), kind, title: '', text: '', items: [], strokes: [], pinned, createdAt: t, updatedAt: t };
        set((st) => ({ notes: [note, ...(pinned ? st.notes.map((n) => (n.pinned ? { ...n, pinned: false, updatedAt: t } : n)) : st.notes)] }));
        return note;
      },
      update: (id, patch) => set((st) => ({ notes: st.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: now() } : n)) })),
      remove: (id) => set((st) => ({ notes: st.notes.filter((n) => n.id !== id) })),
      setPinned: (id, pinned) => set((st) => {
        const t = now();
        return { notes: st.notes.map((n) => (n.id === id ? { ...n, pinned, updatedAt: t } : pinned && n.pinned ? { ...n, pinned: false, updatedAt: t } : n)) };
      }),
      toggleItem: (noteId, itemId) => set((st) => ({
        notes: st.notes.map((n) => (n.id === noteId
          ? { ...n, items: n.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)), updatedAt: now() }
          : n)),
      })),
      setItems: (noteId, items) => set((st) => ({ notes: st.notes.map((n) => (n.id === noteId ? { ...n, items, updatedAt: now() } : n)) })),
    }),
    { name: 'notes-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
