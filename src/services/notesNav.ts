import { router } from 'expo-router';
import { useNotesStore } from '@/store/notesStore';
import type { NoteKind } from '@/types/notes';

// Nowa notatka + przejście do edytora (lista notatek, kafel Dashboardu).
export function openNewNote(kind: NoteKind, pinned = false): void {
  const n = useNotesStore.getState().create(kind, pinned);
  router.push({ pathname: '/note', params: { id: n.id } } as any);
}
export function openNote(id: string): void {
  router.push({ pathname: '/note', params: { id } } as any);
}
