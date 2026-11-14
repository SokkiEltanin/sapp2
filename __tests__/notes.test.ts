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

describe('katalogi notatek', () => {
  const { inFolder, folderCounts } = require('@/utils/notes');
  const N = (id: string, folderId?: string | null) => ({ id, folderId, kind: 'text', title: id, text: '', items: [], strokes: [], pinned: false, createdAt: '', updatedAt: '' });
  const folders = [{ id: 'f1', name: 'Praca', color: '#fff', createdAt: '', updatedAt: '' }];
  const notes = [N('a', 'f1'), N('b'), N('c', 'usuniety')];
  it('filtr i liczniki; nieznany katalog = bez katalogu', () => {
    expect(inFolder(notes, folders, 'f1').map((n: any) => n.id)).toEqual(['a']);
    expect(inFolder(notes, folders, 'none').map((n: any) => n.id)).toEqual(['b', 'c']);
    expect(inFolder(notes, folders, 'all')).toHaveLength(3);
    expect(folderCounts(notes, folders)).toEqual({ all: 3, none: 2, f1: 1 });
  });
  it('usunięcie katalogu przenosi notatki do "bez katalogu"', () => {
    const { useNotesStore } = require('@/store/notesStore');
    const st = useNotesStore.getState();
    const f = st.addFolder('  Dom ', '#fff');
    expect(f.name).toBe('Dom');
    const n = st.create('text', false, f.id);
    useNotesStore.getState().removeFolder(f.id);
    const after = useNotesStore.getState();
    expect(after.folders.find((x: any) => x.id === f.id)).toBeUndefined();
    expect(after.notes.find((x: any) => x.id === n.id).folderId).toBeNull();
  });
});

describe('pędzel S-Pen', () => {
  const { brushFactor, smoothFactor, brushOutline } = require('@/utils/notes');
  it('grubość z nacisku rysika albo szybkości palca', () => {
    expect(brushFactor(0, 0)).toBe(0.2);
    expect(brushFactor(1, 0)).toBe(1.6);
    expect(brushFactor(0.5, 9999)).toBe(0.9);
    expect(brushFactor(null, 0)).toBe(1.3);
    expect(brushFactor(undefined, 5000)).toBe(0.35);
    expect(smoothFactor(undefined, 1)).toBe(1);
    expect(smoothFactor(0.2, 1)).toBe(0.48);
  });
  it('kontur: zamknięta ścieżka, kropka dla jednego punktu', () => {
    const d = brushOutline([0.1, 0.1, 0.2, 0.15, 0.3, 0.1], [0.5, 1, 1.5], 360, 6);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).toContain(' A');
    expect(brushOutline([0.5, 0.5], [1], 100, 4)).toMatch(/^M.* a.*Z$/);
    expect(brushOutline([], [], 100, 4)).toBe('');
  });
});
