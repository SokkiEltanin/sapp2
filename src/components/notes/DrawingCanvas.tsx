import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import type { NoteStroke } from '@/types/notes';
import { addPoint, strokePath, strokesHit } from '@/utils/notes';

// Płótno rysunku (2026-11-14, user: "mam rysik S-PEN"). Wydajność:
//   • gotowe kreski = osobna warstwa SVG (`StrokesLayer`, memo) — rysuje się raz,
//   • w trakcie rysowania odświeża się TYLKO bieżąca kreska, nie więcej niż raz
//     na klatkę (requestAnimationFrame),
//   • punkty upraszczane (utils/notes.ts's addPoint) i trzymane w jednostkach
//     szerokości płótna (ten sam rysunek na telefonie i komputerze).
// Nacisk pióra (grubość od siły) — nie: wymagałby natywnego modułu.

export const StrokesLayer = memo(function StrokesLayer({ strokes, width, height }: { strokes: NoteStroke[]; width: number; height: number }) {
  if (width <= 0) return null;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {strokes.map((s, i) => (
        <Path key={i} d={strokePath(s.p, width)} stroke={s.color} strokeWidth={s.width * (width / 360)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </Svg>
  );
});

export interface DrawTool { color: string; width: number; eraser: boolean }

export default function DrawingCanvas({ strokes, onChange, tool, onRatio }: {
  strokes: NoteStroke[];
  onChange: (strokes: NoteStroke[]) => void;
  tool: DrawTool;
  onRatio?: (ratio: number) => void; // wysokość / szerokość płótna (do miniatur)
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const current = useRef<number[] | null>(null);
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

  const gesture = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .runOnJS(true)
    .onBegin((e) => {
      if (size.w <= 0) return;
      const x = e.x / size.w, y = e.y / size.w;
      if (tool.eraser) { erase(x, y); return; }
      current.current = [];
      addPoint(current.current, x, y, 0);
      redraw();
    })
    .onUpdate((e) => {
      if (size.w <= 0) return;
      const x = e.x / size.w, y = e.y / size.w;
      if (tool.eraser) { erase(x, y); return; }
      if (current.current && addPoint(current.current, x, y)) redraw();
    })
    .onFinalize(() => {
      const p = current.current;
      current.current = null;
      if (p && p.length >= 2) onChange([...latest.current, { color: tool.color, width: tool.width, p }]);
      redraw();
    }), [size.w, tool, erase, onChange, redraw]);

  const cur = current.current;
  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.canvas} onLayout={onLayout} collapsable={false}>
        <StrokesLayer strokes={strokes} width={size.w} height={size.h} />
        {cur && size.w > 0 && (
          <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path d={strokePath(cur, size.w)} stroke={tool.color} strokeWidth={tool.width * (size.w / 360)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, overflow: 'hidden' },
});
