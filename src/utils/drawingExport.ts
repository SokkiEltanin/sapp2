// Eksport rysunku z notatki jako obraz (2026-11-24, user: "eksport spoko"). Czysta logika:
// kreski (współrzędne w jednostkach szerokości strony) → SVG przycięte do rysunku, z tłem
// strony. Komputer: SVG → PNG przez <canvas> (app/note.tsx), telefon: ten sam rysunek przez
// Svg.toDataURL (components/notes/DrawingCanvas.tsx StrokesExport) + udostępnianie.
import type { NoteStroke } from '@/types/notes';
import { strokePath, brushOutline } from '@/utils/notes';
import { inkOn } from '@/utils/notePage';

export const EXPORT_W = 1080;

/** Pionowy zakres rysunku (w jednostkach szerokości); pusty rysunek = null. */
export function drawingYRange(strokes: NoteStroke[]): { min: number; max: number } | null {
  let min = Infinity, max = -Infinity;
  for (const s of strokes) for (let i = 1; i < s.p.length; i += 2) { if (s.p[i] < min) min = s.p[i]; if (s.p[i] > max) max = s.p[i]; }
  return Number.isFinite(min) ? { min, max } : null;
}

/** Wycinek strony do eksportu: pełna szerokość, wysokość od najwyższej do najniższej kreski + margines. */
export function exportFrame(strokes: NoteStroke[], W = EXPORT_W, pad = 0.06): { y0: number; h: number } | null {
  const r = drawingYRange(strokes);
  if (!r) return null;
  const y0 = Math.max(0, (r.min - pad) * W);
  const y1 = (r.max + pad) * W;
  return { y0: Math.round(y0), h: Math.max(Math.round(W * 0.3), Math.round(y1 - y0)) };
}

const esc = (c: string) => c.replace(/[^#a-zA-Z0-9(),.\s%-]/g, '');

/** Ten sam wygląd kresek co na ekranie (DrawingCanvas strokeEl) jako tekst SVG. */
export function strokesSvg(strokes: NoteStroke[], opts: { bg: string; light: boolean; W?: number }): { svg: string; w: number; h: number } | null {
  const W = opts.W ?? EXPORT_W;
  const f = exportFrame(strokes, W);
  if (!f) return null;
  const parts = strokes.map((s) => {
    const color = esc(inkOn(s.color, opts.light) ?? s.color);
    const base = s.width * (W / 360);
    if (s.w) return `<path d="${brushOutline(s.p, s.w, W, base)}" fill="${color}"/>`;
    if (s.t === 'marker') return `<path d="${strokePath(s.p, W)}" stroke="${color}" stroke-opacity="0.38" stroke-width="${base * 2.6}" stroke-linecap="square" stroke-linejoin="round" fill="none"/>`;
    if (s.t === 'pencil') return `<path d="${strokePath(s.p, W)}" stroke="${color}" stroke-opacity="0.72" stroke-width="${Math.max(1, base * 0.6)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    return `<path d="${strokePath(s.p, W)}" stroke="${color}" stroke-width="${base}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${f.h}" viewBox="0 ${f.y0} ${W} ${f.h}">`
    + `<rect x="0" y="${f.y0}" width="${W}" height="${f.h}" fill="${esc(opts.bg)}"/>${parts.join('')}</svg>`;
  return { svg, w: W, h: f.h };
}
