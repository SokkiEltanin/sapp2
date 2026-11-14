import type { Note, NoteStroke } from '@/types/notes';

// Czyste pomocniki notatek (2026-11-14) — testy __tests__/notes.test.ts.

export function noteTitle(n: Pick<Note, 'title' | 'text' | 'items' | 'kind'>): string {
  if (n.title.trim()) return n.title.trim();
  if (n.kind === 'list') return n.items.find((i) => i.text.trim())?.text.trim() ?? 'Lista';
  if (n.kind === 'drawing') return 'Rysunek';
  const first = n.text.split('\n').find((l) => l.trim());
  return first ? first.trim().slice(0, 60) : 'Notatka';
}

export function isEmptyNote(n: Pick<Note, 'title' | 'text' | 'items' | 'strokes'>): boolean {
  return !n.title.trim() && !n.text.trim() && !n.items.some((i) => i.text.trim()) && n.strokes.length === 0;
}

// Kolejność: przypięta, potem ostatnio zmieniane.
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
}

const fold = (s: string) => s.toLowerCase()
  .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l').replace(/ń/g, 'n')
  .replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ż/g, 'z').replace(/ź/g, 'z');
export function searchNotes(notes: Note[], q: string): Note[] {
  const words = fold(q.trim()).split(/\s+/).filter(Boolean);
  if (!words.length) return notes;
  return notes.filter((n) => {
    const hay = fold(`${n.title} ${n.text} ${n.items.map((i) => i.text).join(' ')}`);
    return words.every((w) => hay.includes(w));
  });
}

// ── Rysunek ──────────────────────────────────────────────────────────────────
// Upraszczanie kreski w trakcie rysowania: punkt dodawany, gdy odsunął się o
// ≥ minDist (jednostki płótna) od poprzedniego — mniej danych, płynniejsze SVG.
export function addPoint(p: number[], x: number, y: number, minDist = 0.004): boolean {
  const n = p.length;
  if (n >= 2) {
    const dx = x - p[n - 2], dy = y - p[n - 1];
    if (dx * dx + dy * dy < minDist * minDist) return false;
  }
  p.push(Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000);
  return true;
}

// Ścieżka SVG z punktów (wygładzona: kwadratowe łuki przez środki odcinków).
export function strokePath(p: number[], scale: number): string {
  if (p.length < 2) return '';
  const X = (i: number) => (p[i] * scale).toFixed(1);
  const Y = (i: number) => (p[i + 1] * scale).toFixed(1);
  if (p.length === 2) return `M${X(0)} ${Y(0)} l0.1 0.1`; // kropka
  let d = `M${X(0)} ${Y(0)}`;
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (((p[i] + p[i + 2]) / 2) * scale).toFixed(1);
    const my = (((p[i + 1] + p[i + 3]) / 2) * scale).toFixed(1);
    d += ` Q${X(i)} ${Y(i)} ${mx} ${my}`;
  }
  d += ` L${X(p.length - 2)} ${Y(p.length - 2)}`;
  return d;
}

// Gumka: kreski, które przechodzą bliżej niż r od punktu (x, y).
export function strokesHit(strokes: NoteStroke[], x: number, y: number, r = 0.03): number[] {
  const out: number[] = [];
  strokes.forEach((s, idx) => {
    for (let i = 0; i < s.p.length; i += 2) {
      const dx = s.p[i] - x, dy = s.p[i + 1] - y;
      if (dx * dx + dy * dy <= r * r) { out.push(idx); return; }
    }
  });
  return out;
}
