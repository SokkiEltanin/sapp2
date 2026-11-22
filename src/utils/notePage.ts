// Ustawienia strony notatki (2026-11-22, user: "kolor strony customowy, z presetów np. linie do
// pisania ręcznego, kratki do rysowania"). Czysta logika — edytor (app/note.tsx), kafel
// Dashboardu (NotePage) i lista (NotePreview) liczą to samo.
import type { NotePageStyle, NotePattern } from '@/types/notes';

export const PAGE_PRESETS: { bg: string; label: string }[] = [
  { bg: '#000000', label: 'Czarna' },
  { bg: '#141414', label: 'Grafit' },
  { bg: '#0F172A', label: 'Granat' },
  { bg: '#0F1F17', label: 'Zieleń' },
  { bg: '#F5F1E8', label: 'Papier' },
  { bg: '#FFFFFF', label: 'Biała' },
];

export const PATTERNS: { id: NotePattern; label: string }[] = [
  { id: 'none', label: 'Gładka' },
  { id: 'lines', label: 'Linie' },
  { id: 'grid', label: 'Kratka' },
  { id: 'dots', label: 'Kropki' },
];

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminancja względna 0..1 (WCAG). Zły zapis koloru = 0 (ciemny). */
export function luminance(hex: string): number {
  const c = rgb(hex);
  if (!c) return 0;
  const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const isLightPage = (bg?: string) => !!bg && luminance(bg) > 0.45;

/** Kolory dla strony. Brak `bg` = strona w kolorze motywu (text/muted/pattern undefined →
 *  komponent bierze kolory motywu). */
export function pageInk(page?: NotePageStyle): { light: boolean; text?: string; muted?: string; pattern?: string } {
  if (!page?.bg) return { light: false };
  return isLightPage(page.bg)
    ? { light: true, text: '#1F1F1F', muted: '#8A8A8A', pattern: 'rgba(30,64,175,0.18)' }
    : { light: false, text: '#D6D6D6', muted: '#6E6E6E', pattern: 'rgba(255,255,255,0.11)' };
}

/** Tusz na stronie: prawie-biały na jasnej stronie → prawie-czarny (i odwrotnie), żeby
 *  rysunek/tekst z ciemnej strony nie zniknął po zmianie tła. Inne kolory bez zmian. */
export function inkOn(color: string | undefined, light: boolean): string | undefined {
  if (!color) return color;
  const l = luminance(color);
  if (light && l > 0.8) return '#1A1A1A';
  if (!light && rgb(color) && l < 0.012) return '#F2F2F2';
  return color;
}

/** Ścieżka SVG wzoru (jedna `Path` — szybciej niż setki elementów).
 *  `step` = odstęp linii w px (= wysokość wiersza tekstu), `top` = przesunięcie pierwszej linii. */
export function patternPath(pattern: NotePattern | undefined, w: number, h: number, step: number, top = 0): string {
  if (!pattern || pattern === 'none' || w <= 0 || h <= 0 || step < 2) return '';
  const out: string[] = [];
  const r = (v: number) => Math.round(v * 10) / 10;
  if (pattern === 'lines') {
    for (let y = top; y <= h; y += step) out.push(`M0 ${r(y)}H${r(w)}`);
  } else if (pattern === 'grid') {
    for (let y = top % step; y <= h; y += step) out.push(`M0 ${r(y)}H${r(w)}`);
    for (let x = (w % step) / 2; x <= w; x += step) out.push(`M${r(x)} 0V${r(h)}`);
  } else {
    // kropki: zerowej długości odcinki z okrągłym końcem (strokeLinecap="round")
    for (let y = top % step; y <= h; y += step) for (let x = (w % step) / 2; x <= w; x += step) out.push(`M${r(x)} ${r(y)}h0.01`);
  }
  return out.join('');
}
