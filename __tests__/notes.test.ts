import { noteTitle, isEmptyNote, sortNotes, searchNotes, addPoint, strokePath, strokesHit } from '@/utils/notes';
import type { Note } from '@/types/notes';

const N = (p: Partial<Note>): Note => ({ id: 'n', kind: 'text', title: '', text: '', items: [], strokes: [], pinned: false, createdAt: '', updatedAt: '2026-11-14T10:00:00Z', ...p });

describe('notatki', () => {
  test('tytuł z treści / listy / rysunku', () => {
    expect(noteTitle(N({ title: ' Zakupy ' }))).toBe('Zakupy');
    expect(noteTitle(N({ text: '\n  kod do bramy 1234\nreszta' }))).toBe('kod do bramy 1234');
    expect(noteTitle(N({ kind: 'list', items: [{ id: 'a', text: '', done: false }, { id: 'b', text: 'mleko', done: false }] }))).toBe('mleko');
    expect(noteTitle(N({ kind: 'drawing' }))).toBe('Rysunek');
  });
  test('pusta notatka', () => {
    expect(isEmptyNote(N({}))).toBe(true);
    expect(isEmptyNote(N({ strokes: [{ color: '#fff', width: 2, p: [0, 0] }] }))).toBe(false);
  });
  test('kolejność i szukanie (bez polskich znaków, w liście)', () => {
    const a = N({ id: 'a', updatedAt: '2026-11-14T12:00:00Z' });
    const b = N({ id: 'b', pinned: true, updatedAt: '2026-11-01T00:00:00Z' });
    expect(sortNotes([a, b]).map((n) => n.id)).toEqual(['b', 'a']);
    const l = N({ id: 'l', kind: 'list', items: [{ id: 'x', text: 'Żółty ser', done: false }] });
    expect(searchNotes([a, l], 'zolty').map((n) => n.id)).toEqual(['l']);
  });
  test('rysunek: upraszczanie, ścieżka, gumka', () => {
    const p: number[] = [];
    expect(addPoint(p, 0.1, 0.1)).toBe(true);
    expect(addPoint(p, 0.1005, 0.1)).toBe(false); // za blisko
    expect(addPoint(p, 0.2, 0.2)).toBe(true);
    expect(addPoint(p, 0.3, 0.25)).toBe(true);
    expect(strokePath(p, 100)).toMatch(/^M10\.0 10\.0 Q20\.0 20\.0 25\.0 22\.5 L30\.0 25\.0$/);
    expect(strokePath([0.5, 0.5], 100)).toContain('M50.0 50.0');
    const strokes = [{ color: '#fff', width: 2, p: [0.1, 0.1, 0.2, 0.2] }, { color: '#fff', width: 2, p: [0.8, 0.8] }];
    expect(strokesHit(strokes, 0.21, 0.2)).toEqual([0]);
  });
});

import { useNotesStore } from '@/store/notesStore';
test('store: przypięta najwyżej jedna, odhaczanie pozycji', () => {
  const st = useNotesStore.getState();
  const a = st.create('text', true);
  const b = st.create('list', true);
  let notes = useNotesStore.getState().notes;
  expect(notes.filter((n) => n.pinned).map((n) => n.id)).toEqual([b.id]);
  useNotesStore.getState().setPinned(a.id, true);
  notes = useNotesStore.getState().notes;
  expect(notes.filter((n) => n.pinned).map((n) => n.id)).toEqual([a.id]);
  useNotesStore.getState().setItems(b.id, [{ id: 'i1', text: 'mleko', done: false }]);
  useNotesStore.getState().toggleItem(b.id, 'i1');
  expect(useNotesStore.getState().notes.find((n) => n.id === b.id)!.items[0].done).toBe(true);
});
