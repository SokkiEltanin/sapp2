import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { NotePattern } from '@/types/notes';
import { patternPath } from '@/utils/notePage';

// Wzór strony notatki (2026-11-22): linie / kratka / kropki pod tekstem i rysunkiem — jedna
// ścieżka SVG. `step` = wysokość wiersza tekstu (linie wypadają pod wierszami), `top` =
// pierwsza linia. Edytor, kafel Dashboardu (×k) i lista notatek używają tego samego.
export default memo(function PagePattern({ pattern, width, height, step, top = 0, color }: {
  pattern?: NotePattern; width: number; height: number; step: number; top?: number; color: string;
}) {
  const d = patternPath(pattern, width, height, step, top);
  if (!d) return null;
  const dots = pattern === 'dots';
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={d} stroke={color} strokeWidth={dots ? Math.max(1.8, step * 0.14) : Math.max(0.6, step / 22)} strokeLinecap={dots ? 'round' : 'butt'} fill="none" />
    </Svg>
  );
});
