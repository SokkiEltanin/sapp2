import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import type { NoteStroke } from '@/types/notes';
import { addPoint, strokePath, strokesHit, brushFactor, smoothFactor, brushOutline } from '@/utils/notes';

// Płótno rysunku (2026-11-14, user: "mam rysik S-PEN"). Wydajność:
//   • gotowe kreski = osobna warstwa SVG (`StrokesLayer`, memo) — rysuje się raz,
//   • w trakcie rysowania odświeża się TYLKO bieżąca kreska, nie więcej niż raz
//     na klatkę (requestAnimationFrame),
//   • punkty upraszczane (utils/notes.ts's addPoint) i trzymane w jednostkach
//     szerokości płótna (ten sam rysunek na telefonie i komputerze).
// Pędzel (2026-11-14, user: "dodaj pędzel dla S-Pen"): grubość z nacisku rysika —
// gesture-handler przekazuje `stylusData.pressure` dla rysika na Androidzie; palcem
// grubość z szybkości. Kreska pędzla = wypełniony kontur (utils/notes.ts's brushOutline).

export const StrokesLayer = memo(function StrokesLayer({ strokes, width, height }: { strokes: NoteStroke[]; width: number; height: number }) {
  if (width <= 0) return null;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {strokes.map((s, i) => (s.w
        ? <Path key={i} d={brushOutline(s.p, s.w, width, s.width * (width / 360))} fill={s.color} />
        : <Path key={i} d={strokePath(s.p, width)} stroke={s.color} strokeWidth={s.width * (width / 360)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </Svg>
  );
});

export interface DrawTool { color: string; width: number; eraser: boolean; brush?: boolean }
/** Odczyt nacisku na żywo (test S-Pen): pressure 0..1 albo null = palec. */
export type PressureInfo = { stylus: boolean; pressure: number | null; factor: number };

export default function DrawingCanvas({ strokes, onChange, tool, onRatio, onPressure }: {
  strokes: NoteStroke[];
  onChange: (strokes: NoteStroke[]) => void;
  tool: DrawTool;
  onRatio?: (ratio: number) => void; // wysokość / szerokość płótna (do miniatur)
  onPressure?: (info: PressureInfo | null) => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const current = useRef<number[] | null>(null);
  const widths = useRef<number[]>([]);
  const lastInfo = useRef(0);
  const [, setTick] = useState(0);
  const raf = useRef<number | null>(null);
  const latest = useRef(strokes);
  latest.current = strokes;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
    if (width > 0) onRatio?.(height / width);
  };

  const redraw = useCallback(() => {
    if (raf.current != null) return;
    raf.current = requestAnimationFrame(() => { raf.current = null; setTick((t) => t + 1); });
  }, []);

  const erase = useCallback((x: number, y: number) => {
    const hit = strokesHit(latest.current, x, y, 0.035);
    if (hit.length) onChange(latest.current.filter((_, i) => !hit.includes(i)));
  }, [onChange]);

  // Mnożnik grubości z nacisku (rysik) albo szybkości (palec) + odczyt do testu (max 10/s).
  const factorOf = useCallback((e: { stylusData?: { pressure: number }; velocityX?: number; velocityY?: number }) => {
    const pr = e.stylusData && e.stylusData.pressure >= 0 ? e.stylusData.pressure : null;
    const f = brushFactor(pr, Math.hypot(e.velocityX ?? 0, e.velocityY ?? 0));
    const t = Date.now();
    if (onPressure && t - lastInfo.current > 100) { lastInfo.current = t; onPressure({ stylus: pr != null, pressure: pr, factor: f }); }
    return f;
  }, [onPressure]);

  const gesture = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .runOnJS(true)
    .onBegin((e) => {
      if (size.w <= 0) return;
      const x = e.x / size.w, y = e.y / size.w;
      if (tool.eraser) { erase(x, y); return; }
      current.current = [];
      widths.current = [];
      addPoint(current.current, x, y, 0);
      if (tool.brush) widths.current.push(factorOf(e));
      redraw();
    })
    .onUpdate((e) => {
      if (size.w <= 0) return;
      const x = e.x / size.w, y = e.y / size.w;
      if (tool.eraser) { erase(x, y); return; }
      if (current.current && addPoint(current.current, x, y)) {
        if (tool.brush) widths.current.push(smoothFactor(widths.current[widths.current.length - 1], factorOf(e)));
        redraw();
      }
    })
    .onFinalize(() => {
      const p = current.current;
      current.current = null;
      if (p && p.length >= 2) onChange([...latest.current, tool.brush
        ? { color: tool.color, width: tool.width, p, w: widths.current.slice(0, p.length / 2) }
        : { color: tool.color, width: tool.width, p }]);
      widths.current = [];
      onPressure?.(null);
      redraw();
    }), [size.w, tool, erase, onChange, redraw, factorOf, onPressure]);

  const cur = current.current;
  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.canvas} onLayout={onLayout} collapsable={false}>
        <StrokesLayer strokes={strokes} width={size.w} height={size.h} />
        {cur && size.w > 0 && (
          <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} pointerEvents="none">
            {tool.brush
              ? <Path d={brushOutline(cur, widths.current, size.w, tool.width * (size.w / 360))} fill={tool.color} />
              : <Path d={strokePath(cur, size.w)} stroke={tool.color} strokeWidth={tool.width * (size.w / 360)} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
          </Svg>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, overflow: 'hidden' },
});
