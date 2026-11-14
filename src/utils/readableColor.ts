// Czytelność kolorów na ciemnym tle widgetów (2026-11-14, user: "kolory niektóre są
// nieczytelne mimo że to 80% czerni na tle"). Ciemne kolory (np. ulewa #2563EB,
// szary #3A3A3A) są rozjaśniane mieszaniem z bielą do minimalnej luminancji.
// Ta sama formuła w Kotlinie (plugins/withWeatherWidget.js, withTasksWidget.js: readable()).
export const MIN_WIDGET_LUM = 0.3;

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

export function readableOnDark(hex: string, minLum = MIN_WIDGET_LUM): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || luminance(hex) >= minLum) return hex;
  const n = parseInt(m[1], 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const mixed = rgb.map((c) => Math.round(c + (255 - c) * t));
    const out = `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    if (luminance(out) >= minLum) return out;
  }
  return '#FFFFFF';
}
