import type { Note, NoteStroke, NoteFolder } from '@/types/notes';

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

// ── Katalogi ─────────────────────────────────────────────────────────────────
// Filtr listy: 'all' = wszystkie, 'none' = bez katalogu, inaczej id katalogu.
// Notatka wskazująca na usunięty katalog (np. z innego urządzenia) = bez katalogu.
export type FolderFilter = 'all' | 'none' | string;
export function inFolder(notes: Note[], folders: NoteFolder[], f: FolderFilter): Note[] {
  if (f === 'all') return notes;
  const known = new Set(folders.map((x) => x.id));
  if (f === 'none') return notes.filter((n) => !n.folderId || !known.has(n.folderId));
  return notes.filter((n) => n.folderId === f);
}
export function folderCounts(notes: Note[], folders: NoteFolder[]): Record<string, number> {
  const out: Record<string, number> = { all: notes.length, none: 0 };
  for (const f of folders) out[f.id] = 0;
  for (const n of notes) {
    if (n.folderId && n.folderId in out && n.folderId !== 'all' && n.folderId !== 'none') out[n.folderId]++;
    else out.none++;
  }
  return out;
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

// ── Pędzel (2026-11-14, S-Pen: grubość z nacisku) ───────────────────────────
/** Mnożnik grubości: rysik → z nacisku (0..1), palec → z szybkości (wolniej = grubiej). */
export function brushFactor(pressure: number | null | undefined, speed: number): number {
  if (pressure != null && pressure >= 0) return Math.round(Math.min(1.6, 0.2 + pressure * 1.4) * 100) / 100;
  return Math.round(Math.min(1.3, Math.max(0.35, 1.3 - speed / 2200)) * 100) / 100;
}

/** Wygładzenie (EMA), żeby grubość nie skakała między punktami. */
export const smoothFactor = (prev: number | undefined, next: number, k = 0.35) =>
  (prev == null ? next : Math.round((prev + (next - prev) * k) * 100) / 100);

/**
 * Kontur kreski o zmiennej grubości (wypełniona ścieżka SVG): lewa krawędź, okrągła
 * końcówka, prawa krawędź wstecz, okrągły początek. `p` w jednostkach płótna,
 * `w` = mnożniki na punkt, `base` = grubość bazowa w px przy skali 1.
 */
export function brushOutline(p: number[], w: number[], scale: number, base: number): string {
  const n = p.length / 2;
  if (n === 0) return '';
  const r = (i: number) => Math.max(0.4, (base * (w[i] ?? w[w.length - 1] ?? 1)) / 2);
  const P = (i: number) => [p[2 * i] * scale, p[2 * i + 1] * scale];
  const f = (v: number) => v.toFixed(1);
  if (n === 1) {
    const [x, y] = P(0), rr = r(0);
    return `M${f(x - rr)} ${f(y)} a${f(rr)} ${f(rr)} 0 1 0 ${f(2 * rr)} 0 a${f(rr)} ${f(rr)} 0 1 0 ${f(-2 * rr)} 0Z`;
  }
  const L: number[][] = [], R: number[][] = [];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = P(Math.max(0, i - 1)), [bx, by] = P(Math.min(n - 1, i + 1));
    let tx = bx - ax, ty = by - ay;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    const [x, y] = P(i), rr = r(i);
    L.push([x - ty * rr, y + tx * rr]);
    R.push([x + ty * rr, y - tx * rr]);
  }
  const smooth = (pts: number[][], start: boolean) => {
    let d = start ? `M${f(pts[0][0])} ${f(pts[0][1])}` : ` L${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      d += ` Q${f(pts[i][0])} ${f(pts[i][1])} ${f((pts[i][0] + pts[i + 1][0]) / 2)} ${f((pts[i][1] + pts[i + 1][1]) / 2)}`;
    }
    const last = pts[pts.length - 1];
    return `${d} L${f(last[0])} ${f(last[1])}`;
  };
  const re = r(n - 1), rs = r(0);
  const Rr = R.slice().reverse();
  return `${smooth(L, true)} A${f(re)} ${f(re)} 0 0 1 ${f(Rr[0][0])} ${f(Rr[0][1])}${smooth(Rr, false).replace(/^ L[^Q]*?(?= Q| L|$)/, '')} A${f(rs)} ${f(rs)} 0 0 1 ${f(L[0][0])} ${f(L[0][1])}Z`;
}
