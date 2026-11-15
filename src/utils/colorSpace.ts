// Przeliczenia kolorów dla kreatora (2026-11-15, user: "kreator biblioteki... żeby
// tam spektrum było"): HSL ↔ #RRGGBB. h 0..360, s/l 0..100.
export interface Hsl { h: number; s: number; l: number }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const hex2 = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0').toUpperCase();

export function hslToHex({ h, s, l }: Hsl): string {
  const S = clamp(s, 0, 100) / 100, L = clamp(l, 0, 100) / 100;
  const k = (n: number) => (n + ((h % 360) + 360) % 360 / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return `#${hex2(f(0) * 255)}${hex2(f(8) * 255)}${hex2(f(4) * 255)}`;
}

export function hexToHsl(hex: string): Hsl | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Punkt na spektrum (x: odcień 0..1, y: jasność od białego u góry do czarnego na dole).
export const spectrumAt = (x: number, y: number, s: number): Hsl => ({ h: clamp(x, 0, 1) * 360, s, l: Math.round((1 - clamp(y, 0, 1)) * 100) });
export const spectrumPos = (c: Hsl) => ({ x: (c.h % 360) / 360, y: 1 - c.l / 100 });
