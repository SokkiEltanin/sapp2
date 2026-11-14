import type { Note } from '@/types/notes';
import { noteTitle } from './notes';

// Snapshot pod natywny widget "Notatka" (2026-11-14, plugins/withNoteWidget.js):
// przypięta notatka — tekst (zwykły, bez formatowania) albo lista (do 8 pozycji,
// nieodhaczone pierwsze). Czyste (__tests__/widgetNote.test.ts).
export const NOTE_WIDGET_ROWS = 8;
export interface NoteWidgetSnapshot {
  id: string | null;
  title: string;
  kind: 'text' | 'list' | 'drawing' | 'none';
  text: string;
  rows: { text: string; done: boolean }[];
  more: number;
}

export function buildNoteWidgetSnapshot(note: Note | null | undefined): NoteWidgetSnapshot {
  if (!note) return { id: null, title: 'NOTATKA', kind: 'none', text: 'Przypnij notatkę pinezką w appce — pojawi się tutaj.', rows: [], more: 0 };
  const title = noteTitle(note).toUpperCase();
  if (note.kind === 'list') {
    const items = note.items.filter((i) => i.text.trim());
    const sorted = [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];
    const rows = sorted.slice(0, NOTE_WIDGET_ROWS).map((i) => ({ text: i.text.trim(), done: i.done }));
    const left = items.filter((i) => !i.done).length;
    return { id: note.id, title: `${title} · ${left}/${items.length}`, kind: 'list', text: items.length ? '' : 'Pusta lista', rows, more: Math.max(0, sorted.length - rows.length) };
  }
  if (note.kind === 'drawing') return { id: note.id, title, kind: 'drawing', text: 'Rysunek — stuknij, żeby otworzyć', rows: [], more: 0 };
  const text = note.text.replace(/\n{3,}/g, '\n\n').trim().slice(0, 600);
  return { id: note.id, title, kind: 'text', text: text || 'Pusta notatka', rows: [], more: 0 };
}
