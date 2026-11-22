import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, NativeModules, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import { usePenStore } from '@/store/penStore';
import Svg, { Path } from 'react-native-svg';
import type { NoteStroke } from '@/types/notes';
import { addPoint, strokePath, strokesHit, brushFactor, smoothFactor, brushOutline } from '@/utils/notes';
import { inkOn } from '@/utils/notePage';

// Płótno rysunku (2026-11-14, user: "mam rysik S-PEN"). Wydajność:
//   • gotowe kreski = osobna warstwa SVG (`StrokesLayer`, memo) — rysuje się raz,
//   • w trakcie rysowania odświeża się TYLKO bieżąca kreska, nie więcej niż raz
//     na klatkę (requestAnimationFrame),
//   • punkty upraszczane (utils/notes.ts's addPoint) i trzymane w jednostkach
//     szerokości płótna (ten sam rysunek na telefonie i komputerze).
// Pędzel (2026-11-14, user: "dodaj pędzel dla S-Pen"): grubość z nacisku rysika —
// gesture-handler przekazuje `stylusData.pressure` dla rysika na Androidzie; palcem
// grubość z szybkości. Kreska pędzla = wypełniony kontur (utils/notes.ts's brushOutline).

// Wydajność (2026-11-18, user: "przy szybkim pisaniu i gumce laguje, zwłaszcza przy wielu
// liniach"): każda kreska to osobny memo-komponent ze stałym kluczem (id z WeakMap po
// obiekcie kreski) — nowa kreska / starta kreska przerysowuje TYLKO siebie, nie wszystkie.
let strokeSeq = 0;
const strokeIds = new WeakMap<NoteStroke, number>();
const strokeId = (s: NoteStroke) => { let id = strokeIds.get(s); if (id == null) { id = ++strokeSeq; strokeIds.set(s, id); } return id; };

// Rodzaje narzędzi (2026-11-22, user: "więcej pędzli / ołówków"): ołówek = cieńszy,
// półprzezroczysty grafit; zakreślacz = szeroki, przezroczysty, płaskie końce (jedna ścieżka,
// więc nachodzące odcinki tej samej kreski nie ciemnieją). `light` = jasna strona → biały tusz
// rysuje się jako czarny (utils/notePage.ts's inkOn).
function strokeEl(s: NoteStroke, width: number, light: boolean) {
  const color = inkOn(s.color, light) ?? s.color;
  const base = s.width * (width / 360);
  if (s.w) return <Path d={brushOutline(s.p, s.w, width, base)} fill={color} />;
  if (s.t === 'marker') return <Path d={strokePath(s.p, width)} stroke={color} strokeOpacity={0.38} strokeWidth={base * 2.6} strokeLinecap="square" strokeLinejoin="round" fill="none" />;
  if (s.t === 'pencil') return <Path d={strokePath(s.p, width)} stroke={color} strokeOpacity={0.72} strokeWidth={Math.max(1, base * 0.6)} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
  return <Path d={strokePath(s.p, width)} stroke={color} strokeWidth={base} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

const StrokePath = memo(function StrokePath({ s, width, light }: { s: NoteStroke; width: number; light: boolean }) {
  return strokeEl(s, width, light);
});

export const StrokesLayer = memo(function StrokesLayer({ strokes, width, height, light = false }: { strokes: NoteStroke[]; width: number; height: number; light?: boolean }) {
  if (width <= 0) return null;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {strokes.map((s) => <StrokePath key={strokeId(s)} s={s} width={width} light={light} />)}
    </Svg>
  );
});

export type PenKind = 'pen' | 'brush' | 'pencil' | 'marker';
export interface DrawTool { color: string; width: number; eraser: boolean; kind: PenKind }
/** Odczyt nacisku na żywo (test S-Pen): pressure 0..1 albo null = palec. */
export type PressureInfo = { stylus: boolean; pressure: number | null; factor: number };

// S-Pen (2026-11-18): `fingerScroll` — palec nie rysuje (gest odpada → przewija strona pod
// spodem), rysuje tylko rysik; `buttonEraser` — trzymany przycisk S-Pena = gumka na tę kreskę
// (stan przycisku z natywnego StylusModule, plugins/withStylus.js; stary APK = brak).
/** Kreska z narzędzia: pędzel niesie grubości punktów, ołówek/zakreślacz — rodzaj `t`. */
function toStroke(tl: DrawTool, p: number[], widths: number[]): NoteStroke {
  const base = { color: tl.color, width: tl.width, p };
  if (tl.kind === 'brush') return { ...base, w: widths.slice(0, p.length / 2) };
  if (tl.kind === 'pencil' || tl.kind === 'marker') return { ...base, t: tl.kind };
  return base;
}
const ERASE_R = 0.035; // promień gumki w jednostkach szerokości płótna (strokesHit + wskaźnik)
const stylusButtonDown = (): boolean => {
  try { return !!NativeModules.Stylus?.isButtonDown?.(); } catch { return false; }
};

export default function DrawingCanvas({ strokes, onChange, tool, light = false, onRatio, onPressure, fingerScroll = false, buttonEraser = false, onScrollStart, onScrollBy }: {
  strokes: NoteStroke[];
  onChange: (strokes: NoteStroke[]) => void;
  tool: DrawTool;
  light?: boolean; // jasna strona (kolor tuszu, patrz strokeEl)
  onRatio?: (ratio: number) => void; // wysokość / szerokość płótna (do miniatur)
  onPressure?: (info: PressureInfo | null) => void;
  fingerScroll?: boolean;
  buttonEraser?: boolean;
  onScrollStart?: () => void;              // przewijanie palcami: zapamiętaj pozycję strony
  onScrollBy?: (dyFromStart: number) => void; // …i przesuń o tyle od początku gestu
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const current = useRef<number[] | null>(null);
  const widths = useRef<number[]>([]);
  const lastInfo = useRef(0);
  const [, setTick] = useState(0);
  const raf = useRef<number | null>(null);
  const latest = useRef(strokes);
  const erasedLocal = useRef(false);            // trwa ścieranie z lokalnym widokiem (patrz erase)
  if (!erasedLocal.current) latest.current = strokes;
  // Gest tworzony RAZ (2026-11-15): wcześniej zależał od `onChange`/`tool`, które
  // zmieniają się przy każdym odświeżeniu ekranu notatki — gest podpinał się na nowo
  // w trakcie rysowania i potrafił uciąć kreskę. Aktualne wartości czytamy z refów.
  const live = useRef({ size: { w: 0, h: 0 }, tool, onChange, onPressure, fingerScroll, buttonEraser, onScrollStart, onScrollBy });
  live.current = { size: live.current.size, tool, onChange, onPressure, fingerScroll, buttonEraser, onScrollStart, onScrollBy };
  const stroke = useRef({ reject: false, erase: false }); // bieżąca kreska: odrzucona (palec) / gumka z przycisku
  // Przewijanie strony w trybie rysunku (2026-11-18, user: "rysowanie nie działa, zawsze jest
  // przesuwanie, tylko kropki się stawiają"): oddanie gestu ScrollView przegrywało wyścig —
  // teraz ScrollView w trybie rysunku jest wyłączony, a przewijaniem steruje ten gest:
  // dwa palce (zawsze) albo jeden palec, gdy rysuje tylko S-Pen (`fingerScroll`).
  // Kreska startuje od razu (jak przed zmianą); drugi palec ją anuluje i przechodzi w scroll.
  const scroll = useRef<{ on: boolean; y0: number; last: number }>({ on: false, y0: 0, last: 0 });
  const avgY = (ts: { absoluteY: number }[]) => (ts.length ? ts.reduce((a, t) => a + t.absoluteY, 0) / ts.length : 0);

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

  // Wskaźnik gumki (2026-11-18, user: "gumka musi się pokazywać malutka, żeby było widać, że
  // jest włączona"): kółko o promieniu trafienia gumki pod palcem/rysikiem w trakcie ścierania.
  const eraserAt = useRef<{ x: number; y: number } | null>(null);
  // Gumka ściera lokalnie (widok z `latest`), zapis do notatki RAZ po podniesieniu —
  // wcześniej każde trafienie zapisywało całą notatkę i przerysowywało ekran.
  const erase = (x: number, y: number) => {
    eraserAt.current = { x, y };
    const hit = strokesHit(latest.current, x, y, ERASE_R);
    if (hit.length) {
      latest.current = latest.current.filter((_, i) => !hit.includes(i));
      erasedLocal.current = true;
    }
    redraw();
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

  const startScroll = (y: number) => {
    // trwająca kreska przepada — to był początek przewijania
    stroke.current.reject = true;
    current.current = null;
    widths.current = [];
    scroll.current = { on: true, y0: y, last: y };
    live.current.onScrollStart?.();
    redraw();
  };

  // zmiana liczby palców w trakcie przewijania: zachowaj dotychczasowe przesunięcie
  const rebase = (y: number) => {
    const sc = scroll.current;
    sc.y0 = y - (sc.last - sc.y0);
    sc.last = y;
  };

  const gesture = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .runOnJS(true)
    .onTouchesDown((e) => {
      const stylus = e.pointerType === PointerType.STYLUS;
      if (stylus && !usePenStore.getState().stylusSeen) usePenStore.getState().set({ stylusSeen: true });
      if (scroll.current.on) { rebase(avgY(e.allTouches)); return; }
      if (e.numberOfTouches >= 2 || (live.current.fingerScroll && !stylus)) startScroll(avgY(e.allTouches));
    })
    .onTouchesMove((e) => {
      if (!scroll.current.on) return;
      const y = avgY(e.allTouches);
      scroll.current.last = y;
      live.current.onScrollBy?.(y - scroll.current.y0);
    })
    .onTouchesUp((e) => {
      // jeden z palców podniesiony — średnia skacze, przesuń punkt odniesienia
      if (scroll.current.on && e.allTouches.length > e.changedTouches.length) {
        const rest = e.allTouches.filter((t) => !e.changedTouches.some((c) => c.id === t.id));
        if (rest.length) rebase(avgY(rest));
      }
    })
    .onBegin((e) => {
      const { size: sz, tool: tl } = live.current;
      const stylus = e.pointerType === PointerType.STYLUS;
      stroke.current = {
        reject: scroll.current.on || (live.current.fingerScroll && !stylus),
        erase: stylus && live.current.buttonEraser && stylusButtonDown(),
      };
      if (sz.w <= 0 || stroke.current.reject) return;
      const x = e.x / sz.w, y = e.y / sz.w;
      if (tl.eraser || stroke.current.erase) { fns.current.erase(x, y); return; }
      current.current = [];
      widths.current = [];
      addPoint(current.current, x, y, 0);
      if (tl.kind === 'brush') widths.current.push(fns.current.factorOf(e));
      redraw();
    })
    .onUpdate((e) => {
      const { size: sz, tool: tl } = live.current;
      if (sz.w <= 0 || stroke.current.reject) return;
      const x = e.x / sz.w, y = e.y / sz.w;
      if (tl.eraser || stroke.current.erase) { fns.current.erase(x, y); return; }
      if (current.current && addPoint(current.current, x, y)) {
        if (tl.kind === 'brush') widths.current.push(smoothFactor(widths.current[widths.current.length - 1], fns.current.factorOf(e)));
        redraw();
      }
    })
    .onFinalize(() => {
      const tl = live.current.tool;
      const p = stroke.current.reject || stroke.current.erase ? null : current.current;
      stroke.current = { reject: false, erase: false };
      scroll.current = { on: false, y0: 0, last: 0 };
      eraserAt.current = null;
      if (erasedLocal.current) { erasedLocal.current = false; live.current.onChange(latest.current); }
      current.current = null;
      if (p && p.length >= 2) fns.current.commit([...latest.current, toStroke(tl, p, widths.current)]);
      widths.current = [];
      live.current.onPressure?.(null);
      redraw();
    }), [redraw]);

  const cur = current.current;
  const er = eraserAt.current;
  const erR = ERASE_R * size.w;
  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.canvas} onLayout={onLayout} collapsable={false}>
        <StrokesLayer strokes={erasedLocal.current ? latest.current : strokes} width={size.w} height={size.h} light={light} />
        {cur && size.w > 0 && (
          <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} pointerEvents="none">
            {strokeEl(toStroke(tool, cur, widths.current), size.w, light)}
          </Svg>
        )}
        {er && size.w > 0 && (
          <View pointerEvents="none" style={[styles.eraser, light && styles.eraserLight, { left: er.x * size.w - erR, top: er.y * size.w - erR, width: erR * 2, height: erR * 2, borderRadius: erR }]} />
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, overflow: 'hidden' },
  eraser: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)', backgroundColor: 'rgba(255,255,255,0.12)' },
  eraserLight: { borderColor: 'rgba(0,0,0,0.6)', backgroundColor: 'rgba(0,0,0,0.06)' },
});
