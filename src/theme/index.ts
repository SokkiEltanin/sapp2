import { colors, Colors } from './colors';

export const spacing = [0, 4, 8, 12, 16, 20, 24, 32, 40] as const;
export const radius = { sm: 6, md: 10, lg: 16, xl: 22, full: 999 } as const;

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
