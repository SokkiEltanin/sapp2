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
  /** Rysunek przycięty do treści (2026-11-17): współrzędne 0..w / 0..h w jednostkach
   *  szerokości płótna, `s` = grubość w tych jednostkach, `k` = mnożniki pędzla. */
  drawing?: NoteWidgetDrawing;
}
export interface NoteWidgetDrawing { w: number; h: number; strokes: { c: string; s: number; p: number[]; k?: number[] }[] }

// Limit punktów w widgecie (plik + czas rysowania bitmapy) — gęste kreski przerzedzane.
export const NOTE_WIDGET_MAX_POINTS = 6000;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
// Color.parseColor na Androidzie zna tylko #RRGGBB / #AARRGGBB — #rgb i #rrggbbaa z appki
// trzeba przełożyć (inaczej kreska wyszłaby biała).
export function androidColor(c: string): string {
  const h = /^#([0-9a-f]+)$/i.exec(c.trim())?.[1];
  if (!h) return '#F2F2F2';
  if (h.length === 3 || h.length === 4) {
    const x = h.split('').map((ch) => ch + ch).join('');
    return h.length === 3 ? `#${x}` : `#${x.slice(6)}${x.slice(0, 6)}`;
  }
  if (h.length === 6) return `#${h}`;
  if (h.length === 8) return `#${h.slice(6)}${h.slice(0, 6)}`;
  return '#F2F2F2';
}

export function buildNoteWidgetDrawing(strokes: Note['strokes']): NoteWidgetDrawing | undefined {
  const list = strokes.filter((st) => st.p.length >= 2);
  if (!list.length) return undefined;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, pad = 0;
  for (const st of list) {
    const half = (st.width / 360) * Math.max(1, ...(st.w ?? [1])) / 2;
    pad = Math.max(pad, half);
    for (let i = 0; i < st.p.length; i += 2) {
      x0 = Math.min(x0, st.p[i]); x1 = Math.max(x1, st.p[i]);
      y0 = Math.min(y0, st.p[i + 1]); y1 = Math.max(y1, st.p[i + 1]);
    }
  }
  pad += 0.02;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const total = list.reduce((a, st) => a + st.p.length / 2, 0);
  const step = Math.max(1, Math.ceil(total / NOTE_WIDGET_MAX_POINTS));
  return {
    w: r4(x1 - x0), h: r4(y1 - y0),
    strokes: list.map((st) => {
      const n = st.p.length / 2;
      const idx: number[] = [];
      for (let i = 0; i < n; i += step) idx.push(i);
      if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
      const out: { c: string; s: number; p: number[]; k?: number[] } = {
        c: androidColor(st.color), s: r4(st.width / 360),
        p: idx.flatMap((i) => [r4(st.p[2 * i] - x0), r4(st.p[2 * i + 1] - y0)]),
      };
      if (st.w) out.k = idx.map((i) => st.w![i] ?? st.w![st.w!.length - 1] ?? 1);
      return out;
    }),
  };
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
  // Rysunek (2026-11-17, user: "na widgecie nie widać rysunku, tylko tekst — ma się
  // pokazywać już narysowany"): kreski idą w snapshocie, provider maluje je do bitmapy.
  const drawing = buildNoteWidgetDrawing(note.strokes ?? []);
  const text = note.text.replace(/\n{3,}/g, '\n\n').trim().slice(0, 600);
  if (note.kind === 'drawing') return { id: note.id, title, kind: 'drawing', text: drawing ? text : text || 'Pusty rysunek', rows: [], more: 0, drawing };
  return { id: note.id, title, kind: 'text', text: text || (drawing ? '' : 'Pusta notatka'), rows: [], more: 0, drawing };
}
