import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Note, NoteKind, NoteItem, NoteFolder } from '@/types/notes';

// Notatki (2026-11-14). Ekran: app/notes.tsx (lista) + app/note.tsx (edytor).
// Dashboard: przypięta notatka (`pinned`, najwyżej jedna). Synchronizacja:
// services/cloudSync.ts (`sync_notes`), kopia zapasowa: services/cloudBackup.ts.
export const genNoteId = (p = 'note') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const now = () => new Date().toISOString();

interface NotesState {
  notes: Note[];
  folders: NoteFolder[];
  create: (kind: NoteKind, pinned?: boolean, folderId?: string | null) => Note;
  addFolder: (name: string, color: string) => NoteFolder;
  updateFolder: (id: string, patch: Partial<Pick<NoteFolder, 'name' | 'color'>>) => void;
  /** Usuwa katalog; jego notatki zostają, trafiają do "Bez katalogu". */
  removeFolder: (id: string) => void;
  moveNote: (id: string, folderId: string | null) => void;
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
      folders: [],
      create: (kind, pinned = false, folderId = null) => {
        const t = now();
        const note: Note = { id: genNoteId(), kind, title: '', text: '', items: [], strokes: [], pinned, folderId, createdAt: t, updatedAt: t };
        set((st) => ({ notes: [note, ...(pinned ? st.notes.map((n) => (n.pinned ? { ...n, pinned: false, updatedAt: t } : n)) : st.notes)] }));
        return note;
      },
      addFolder: (name, color) => {
        const t = now();
        const f: NoteFolder = { id: genNoteId('fold'), name: name.trim() || 'Katalog', color, createdAt: t, updatedAt: t };
        set((st) => ({ folders: [...st.folders, f] }));
        return f;
      },
      updateFolder: (id, patch) => set((st) => ({
        folders: st.folders.map((f) => (f.id === id ? { ...f, ...patch, ...(patch.name != null ? { name: patch.name.trim() || f.name } : {}), updatedAt: now() } : f)),
      })),
      removeFolder: (id) => set((st) => {
        const t = now();
        return {
          folders: st.folders.filter((f) => f.id !== id),
          notes: st.notes.map((n) => (n.folderId === id ? { ...n, folderId: null, updatedAt: t } : n)),
        };
      }),
      moveNote: (id, folderId) => set((st) => ({ notes: st.notes.map((n) => (n.id === id ? { ...n, folderId, updatedAt: now() } : n)) })),
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
