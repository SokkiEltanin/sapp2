import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, NativeModules, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import { usePenStore } from '@/store/penStore';
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

// S-Pen (2026-11-18): `fingerScroll` — palec nie rysuje (gest odpada → przewija strona pod
// spodem), rysuje tylko rysik; `buttonEraser` — trzymany przycisk S-Pena = gumka na tę kreskę
// (stan przycisku z natywnego StylusModule, plugins/withStylus.js; stary APK = brak).
const stylusButtonDown = (): boolean => {
  try { return !!NativeModules.Stylus?.isButtonDown?.(); } catch { return false; }
};

export default function DrawingCanvas({ strokes, onChange, tool, onRatio, onPressure, fingerScroll = false, buttonEraser = false }: {
  strokes: NoteStroke[];
  onChange: (strokes: NoteStroke[]) => void;
  tool: DrawTool;
  onRatio?: (ratio: number) => void; // wysokość / szerokość płótna (do miniatur)
  onPressure?: (info: PressureInfo | null) => void;
  fingerScroll?: boolean;
  buttonEraser?: boolean;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const current = useRef<number[] | null>(null);
  const widths = useRef<number[]>([]);
  const lastInfo = useRef(0);
  const [, setTick] = useState(0);
  const raf = useRef<number | null>(null);
  const latest = useRef(strokes);
  latest.current = strokes;
  // Gest tworzony RAZ (2026-11-15): wcześniej zależał od `onChange`/`tool`, które
  // zmieniają się przy każdym odświeżeniu ekranu notatki — gest podpinał się na nowo
  // w trakcie rysowania i potrafił uciąć kreskę. Aktualne wartości czytamy z refów.
  const live = useRef({ size: { w: 0, h: 0 }, tool, onChange, onPressure, fingerScroll, buttonEraser });
  live.current = { size: live.current.size, tool, onChange, onPressure, fingerScroll, buttonEraser };
  const stroke = useRef({ reject: false, erase: false }); // bieżąca kreska: odrzucona (palec) / gumka z przycisku

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
    live.current.size = { w: width, h: height };
    if (width > 0) onRatio?.(height / width);
  };

  const redraw = useCallback(() => {
    if (raf.current != null) return;
    raf.current = requestAnimationFrame(() => { raf.current = null; setTick((t) => t + 1); });
  }, []);

  const commit = (next: NoteStroke[]) => {
    // Od razu do refa — kolejna szybka kreska (zanim ekran się odświeży) dopisze się do tej.
    latest.current = next;
    live.current.onChange(next);
  };

  const erase = (x: number, y: number) => {
    const hit = strokesHit(latest.current, x, y, 0.035);
    if (hit.length) commit(latest.current.filter((_, i) => !hit.includes(i)));
  };

  // Mnożnik grubości z nacisku (rysik) albo szybkości (palec) + odczyt do testu (max 10/s).
  const factorOf = (e: { stylusData?: { pressure: number }; velocityX?: number; velocityY?: number }) => {
    const pr = e.stylusData && e.stylusData.pressure >= 0 ? e.stylusData.pressure : null;
    const f = brushFactor(pr, Math.hypot(e.velocityX ?? 0, e.velocityY ?? 0));
    const t = Date.now();
    const onP = live.current.onPressure;
    if (onP && t - lastInfo.current > 100) { lastInfo.current = t; onP({ stylus: pr != null, pressure: pr, factor: f }); }
    return f;
  };
  const fns = useRef({ erase, factorOf, commit });
  fns.current = { erase, factorOf, commit };

  const gesture = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .runOnJS(true)
    .manualActivation(true)
    .onTouchesDown((e, mgr) => {
      const stylus = e.pointerType === PointerType.STYLUS;
      if (stylus && !usePenStore.getState().stylusSeen) usePenStore.getState().set({ stylusSeen: true });
      if (live.current.fingerScroll && !stylus) { stroke.current.reject = true; mgr.fail(); return; }
      mgr.activate();
    })
    .onBegin((e) => {
      const { size: sz, tool: tl } = live.current;
      const stylus = e.pointerType === PointerType.STYLUS;
      stroke.current = {
        reject: live.current.fingerScroll && !stylus,
        erase: stylus && live.current.buttonEraser && stylusButtonDown(),
      };
      if (sz.w <= 0 || stroke.current.reject) return;
      const x = e.x / sz.w, y = e.y / sz.w;
      if (tl.eraser || stroke.current.erase) { fns.current.erase(x, y); return; }
      current.current = [];
      widths.current = [];
      addPoint(current.current, x, y, 0);
      if (tl.brush) widths.current.push(fns.current.factorOf(e));
      redraw();
    })
    .onUpdate((e) => {
      const { size: sz, tool: tl } = live.current;
      if (sz.w <= 0 || stroke.current.reject) return;
      const x = e.x / sz.w, y = e.y / sz.w;
      if (tl.eraser || stroke.current.erase) { fns.current.erase(x, y); return; }
      if (current.current && addPoint(current.current, x, y)) {
        if (tl.brush) widths.current.push(smoothFactor(widths.current[widths.current.length - 1], fns.current.factorOf(e)));
        redraw();
      }
    })
    .onFinalize(() => {
      const tl = live.current.tool;
      const p = stroke.current.reject || stroke.current.erase ? null : current.current;
      stroke.current = { reject: false, erase: false };
      current.current = null;
      if (p && p.length >= 2) fns.current.commit([...latest.current, tl.brush
        ? { color: tl.color, width: tl.width, p, w: widths.current.slice(0, p.length / 2) }
        : { color: tl.color, width: tl.width, p }]);
      widths.current = [];
      live.current.onPressure?.(null);
      redraw();
    }), [redraw]);

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
