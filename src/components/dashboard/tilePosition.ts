import { radius } from '@/theme';

// Wspólna reguła dla WSZYSTKICH kafelków Dashboardu (stat, pattern, zadania, pupil) —
// zaokrąglenie tylko na skrajnych krawędziach rzędu, środek rzędu zawsze kwadratowy.
// Jedno miejsce, żeby komponenty kafelków nie duplikowały tej samej logiki (CLAUDE.md #3).
export type StatTilePosition = 'first' | 'middle' | 'last' | 'single';

// Wszystkie rzędy Dashboardu mają TĘ SAMĄ wysokość (user: "wysokość ta sama co zawsze")
// — niezależnie od tego jak rząd dzieli szerokość między kafle (4 równe / 2 szersze /
// 3:1 jak zadania+pupil). Stąd stała wysokość zamiast aspectRatio per-kafelek, który nie
// dałby tej samej wysokości przy różnych proporcjach szerokości w jednym rzędzie.
export const TILE_ROW_HEIGHT = 120;

export function getTilePosition(index: number, length: number): StatTilePosition {
  if (length <= 1) return 'single';
  if (index === 0) return 'first';
  if (index === length - 1) return 'last';
  return 'middle';
}

export function cornersForPosition(position: StatTilePosition) {
  switch (position) {
    case 'first':
      return { borderTopLeftRadius: radius.xl, borderBottomLeftRadius: radius.xl };
    case 'last':
      return { borderTopRightRadius: radius.xl, borderBottomRightRadius: radius.xl };
    case 'single':
      return { borderRadius: radius.xl };
    case 'middle':
    default:
      return {};
  }
}
