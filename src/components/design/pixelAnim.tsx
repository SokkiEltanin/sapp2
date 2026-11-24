import { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, AppState, AccessibilityInfo, Platform } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { NavigationContext } from '@react-navigation/native';
import { spriteRects } from '@/utils/pixelSprite';
import { useAnimStore } from '@/store/animStore';
import { AppWidthContext } from '@/ui/layout';

// Wspólny "silnik" scen pixel-art (2026-11-24): pogoda (components/weather/WeatherScene.tsx)
// i pieniądze w Saldzie (components/finances/MoneyScene.tsx). Sprite = tablica wierszy
// ('.' = pusty, litera = kolor z palety), animacje tylko transform/opacity (CLAUDE.md zasada 6),
// pętle stają bez fokusu ekranu, w tle i wg ustawienia "Animacje kafli" (store/animStore.ts).
export type Sprite = string[];
export type Palette = Record<string, string>;

// Losowość "na oko" (2026-11-24, user: "śnieg/deszcz/wiatr bardziej randomowe — teraz leci jedną
// prostą linią"): wcześniej x i faza rosły razem z numerem cząstki → ukośna linia. Teraz każda
// cząstka ma własne x, fazę, tempo (1 z 2 pętli), długość lotu i kołysanie z ziarnistego RNG
// (te same wartości przy każdym renderze — bez skakania).
export function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const Pix = memo(function Pix({ sprite, palette, px }: { sprite: Sprite; palette: Palette; px: number }) {
  const rects = useMemo(() => spriteRects(sprite), [sprite]);
  const w = sprite[0].length * px, h = sprite.length * px;
  return (
    <Svg width={w} height={h}>
      {rects.map((r, i) => <Rect key={i} x={r.x * px} y={r.y * px} width={r.w * px} height={px} fill={palette[r.ch] ?? '#FFF'} />)}
    </Svg>
  );
});

// Pętla 0→1 (albo 0→1→0 dla `pingPong`) na natywnym sterowniku; startuje tylko, gdy `run`.
// Na webie (PWA) pętla z useNativeDriver kończy się po pierwszym obrocie (2026-11-24) — tam JS.
const NATIVE = Platform.OS !== 'web';
export function useLoop(ms: number, run: boolean, pingPong = false) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!run) { v.stopAnimation(); return; }
    const ease = pingPong ? Easing.inOut(Easing.sin) : Easing.linear;
    const anim = pingPong
      ? Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: ms, easing: ease, useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0, duration: ms, easing: ease, useNativeDriver: NATIVE }),
      ]))
      : Animated.loop(Animated.timing(v, { toValue: 1, duration: ms, easing: ease, useNativeDriver: NATIVE }));
    v.setValue(0);
    anim.start();
    return () => anim.stop();
  }, [run, ms, pingPong, v]);
  return v;
}

/** Przesunięta faza pętli 0..1: wartość `from`→`to` z "zawinięciem" w punkcie fazy. */
export const wrap = (t: Animated.Value, phase: number, from: number, to: number) => {
  const p = Math.min(0.999, Math.max(0, phase));
  if (p === 0) return t.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  const cut = 1 - p;
  return t.interpolate({
    inputRange: [0, cut, cut + 0.0001, 1],
    outputRange: [from + (to - from) * p, to, from, from + (to - from) * p],
  });
};

// Fokus ekranu bez wymogu nawigacji (scena żyje też w oknie pogody, które może być portalem
// poza drzewem nawigacji — wtedy po prostu "aktywny").
function useFocusedSafe(): boolean {
  const nav = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => nav?.isFocused?.() ?? true);
  useEffect(() => {
    if (!nav) return;
    setFocused(nav.isFocused());
    const a = nav.addListener('focus', () => setFocused(true));
    const b = nav.addListener('blur', () => setFocused(false));
    return () => { a(); b(); };
  }, [nav]);
  return focused;
}

export function useActive(): boolean {
  // Komputer (DesktopTabs): zakładki stoją obok siebie jako kolumny, a "fokus" nawigacji ma tylko
  // jedna — wyrenderowana kolumna JEST widoczna (ukryte DesktopTabs w ogóle nie renderuje),
  // więc tam fokus się nie liczy (2026-11-24, user: "pogoda się animuje, a Finanse nie").
  const inDeskColumn = useContext(AppWidthContext) != null;
  const focused = useFocusedSafe() || inDeskColumn;
  const mode = useAnimStore((st) => st.mode);
  const [fg, setFg] = useState(AppState.currentState !== 'background');
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setFg(s === 'active'));
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduce).catch(() => {});
    return () => sub.remove();
  }, []);
  // "ogranicz ruch" systemu tylko w trybie "według systemu" (Ustawienia → Aplikacja → Animacje kafli)
  const still = mode === 'off' || (mode === 'system' && reduce);
  return focused && fg && !still;
}
