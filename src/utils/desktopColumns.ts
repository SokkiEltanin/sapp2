// Układ na komputer (2026-11-14, user: "mobilna wygląda dziwnie na takim ekranie...
// kafelki takie same tylko wszystkie ekrany obok siebie"). Szerokie okno = zakładki
// jako kolumny obok siebie (te same ekrany co w telefonie, każdy w swojej kolumnie).
// Czysta matematyka, bez React — testy: __tests__/desktopColumns.test.ts.
export const DESKTOP_MIN_W = 1000;   // węziej — zwykła jedna kolumna jak w telefonie
export const DESKTOP_RAIL_W = 72;    // pasek po lewej (ustawienia, zakładki, szukaj)
export const DESKTOP_GAP = 12;
export const DESKTOP_COL_MAX = 560;
export const DESKTOP_COL_MIN = 400;
// Kolejność kolumn: najważniejsze najpierw (Daily — gdy zmieści się czwarta).
export const DESKTOP_ORDER = ['index', 'finances', 'tasks', 'daily'] as const;
export type DesktopTab = (typeof DESKTOP_ORDER)[number];

export interface DesktopLayout { cols: number; colW: number }

export function desktopLayout(width: number): DesktopLayout | null {
  if (width < DESKTOP_MIN_W) return null;
  const free = width - DESKTOP_RAIL_W - DESKTOP_GAP * 2;
  let cols = Math.min(DESKTOP_ORDER.length, Math.max(2, Math.floor((free + DESKTOP_GAP) / (DESKTOP_COL_MIN + DESKTOP_GAP))));
  const colW = Math.min(DESKTOP_COL_MAX, Math.floor((free - DESKTOP_GAP * (cols - 1)) / cols));
  return { cols, colW };
}

/**
 * Które zakładki widać: pierwsze `cols-1` zawsze, ostatnia kolumna = aktywna
 * zakładka, jeśli nie mieści się wśród stałych (wybór z paska po lewej).
 */
export function visibleTabs(cols: number, focused: string): DesktopTab[] {
  const fixed = DESKTOP_ORDER.slice(0, Math.max(0, cols - 1));
  const rest = DESKTOP_ORDER.slice(fixed.length);
  const last = rest.find((t) => t === focused) ?? rest[0];
  return last ? [...fixed, last] : [...fixed];
}

/** Ścieżka → nazwa zakładki ("/" → index, "/finances" → finances). */
export function tabFromPath(pathname: string): DesktopTab | null {
  const seg = pathname.replace(/^\/+/, '').split(/[/?#]/)[0];
  if (seg === '') return 'index';
  return (DESKTOP_ORDER as readonly string[]).includes(seg) ? (seg as DesktopTab) : null;
}
