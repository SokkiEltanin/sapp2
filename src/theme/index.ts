import { colors, Colors } from './colors';

export const spacing = [0, 4, 8, 12, 16, 20, 24, 32, 40] as const;
// `tile`/`inner`/`sheet`/`btn`/`chip` (Faza 3.1, design/app-design.html §Tokeny `R`) —
// dokładne, nazwane-po-roli promienie dla nowego systemu komponentów (Tile/Row/
// BottomSheet/przyciski sheeta/chipy). Istniejące `sm/md/lg/xl/full` ZOSTAJĄ (reszta
// appki, migracja screen-po-screenie) — `tile`===`xl`+1 nie jest literówką, to po
// prostu inna, dokładna wartość ze spec (18, nie 22).
export const radius = {
  sm: 6, md: 10, lg: 16, xl: 22, full: 999,
  tile: 18, inner: 10, sheet: 28, btn: 16, chip: 12,
} as const;
// `S` ze spec (screenX:12, gap:8, tilePad:12) = `spacing[3]`/`spacing[2]`/`spacing[3]`
// dokładnie — istniejący indeksowany `spacing` już to pokrywa 1:1, zero nowych tokenów.

// Zasada #5 — "styl tylko przez jeden, ustalony mechanizm" (dziedzictwo z sapp,
// CLAUDE.md regl #1: per-komponentowe `makeStyles(c)` w renderze tworzyło tysiące
// obiektów stylów na render = realny ANR, nie teoria). Nawet w appce dark-only ten
// cache dalej coś daje — klucz cache'a ZAWSZE trafia (jedna paleta), ale builder i tak
// woła się RAZ, nie przy każdym renderze wiersza listy.
export function themedStyles<T>(build: (c: Colors) => T): () => T {
  let cached: T | null = null;
  return () => {
    if (!cached) cached = build(colors);
    return cached;
  };
}

export function useColors(): Colors {
  return colors;
}
