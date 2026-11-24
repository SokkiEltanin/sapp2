import { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet, AppState, AccessibilityInfo, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { NavigationContext } from '@react-navigation/native';
import type { WeatherToneKey } from '@/utils/weather';
import { spriteRects } from '@/utils/pixelSprite';

// Scena pixel-art w kaflu pogody (2026-11-23, user: "kafel pogody bardziej wizualny, ale dalej
// minimalistyczny — żeby było wiadomo, że pada, wieje czy świeci słońce; pixel art, animacja,
// glassmorphism, bez lagów"). Własne sprite'y (bez pobranych grafik), każdy = JEDNO małe Svg
// z poziomymi odcinkami scalonymi w prostokąty (całe piksele = ostre krawędzie). Animacje: tylko transform/opacity
// wrapperów (Animated, native driver, CLAUDE.md zasada 6), 4 wspólne pętle; wszystko staje,
// gdy ekran nie ma fokusu, appka jest w tle albo system ma "ogranicz ruch".

type Sprite = string[];
type Palette = Record<string, string>;

const SUN_CORE: Sprite = [
  '..WWW..',
  '.WYYYY.',
  'WYYYYYO',
  'WYYYYYO',
  'YYYYYYO',
  '.YYYYO.',
  '..OOO..',
];
const SUN_RAYS: Sprite = [
  '......Y......',
  '......Y......',
  '.Y.........Y.',
  '..Y.......Y..',
  '.............',
  '.............',
  'YY.........YY',
  '.............',
  '.............',
  '..Y.......Y..',
  '.Y.........Y.',
  '......Y......',
  '......Y......',
];
const MOON: Sprite = [
  '...MMM..',
  '.MMMM...',
  'MMMM....',
  'MMMS....',
  'MMMS....',
  'MMMMS...',
  '.MMMMMMM',
  '...MMMM.',
];
const STAR: Sprite = ['.W.', 'WWW', '.W.'];
const CLOUD_BIG: Sprite = [
  '......LLLL......',
  '....LLLLLLLL....',
  '..LLLLLLLLLLLL..',
  '.LLLLLLLLLLLLLLL',
  'LLLLLLLLLLLLLLLL',
  'GLLLLLLLLLLLLLLG',
  '.GGGGGGGGGGGGGG.',
];
const CLOUD_SMALL: Sprite = [
  '...LLLL....',
  '.LLLLLLLL..',
  'LLLLLLLLLLL',
  'GLLLLLLLLLG',
  '.GGGGGGGGG.',
];
const DROP: Sprite = ['B', 'B', 'b'];
const FLAKE: Sprite = ['.W.', 'WWW', '.W.'];
const BOLT: Sprite = ['..YY', '.YY.', 'YYYY', '..YY', '.YY.', '.Y..'];
const FOG: Sprite = ['LLLLLL..LLLLLLLLL...LLLL'];
const WIND: Sprite = ['WWWWWWW..WW'];
const WIND_SHORT: Sprite = ['WWWW.W'];

// Losowość "na oko" (2026-11-24, user: "śnieg/deszcz/wiatr bardziej randomowe — teraz leci jedną
// prostą linią"): wcześniej x i faza rosły razem z numerem cząstki → ukośna linia. Teraz każda
// cząstka ma własne x, fazę, tempo (1 z 2 pętli), długość lotu i kołysanie z ziarnistego RNG
// (te same wartości przy każdym renderze — bez skakania).
function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUN_P: Palette = { Y: '#FBBF24', O: '#F59E0B', W: '#FDE68A' };
const MOON_P: Palette = { M: '#E0E7FF', S: '#A5B4FC' };
const STAR_P: Palette = { W: '#E0E7FF' };
const CLOUD_LIGHT: Palette = { L: '#E5E7EB', G: '#9CA3AF' };
const CLOUD_GRAY: Palette = { L: '#9CA3AF', G: '#6B7280' };
const CLOUD_DARK: Palette = { L: '#6B7280', G: '#4B5563' };
const DROP_P: Palette = { B: '#60A5FA', b: '#93C5FD' };
const FLAKE_P: Palette = { W: '#F8FAFC' };
const BOLT_P: Palette = { Y: '#FDE047' };
const FOG_P: Palette = { L: '#94A3B8' };
const WIND_P: Palette = { W: 'rgba(255,255,255,0.55)' };


const Pix = memo(function Pix({ sprite, palette, px }: { sprite: Sprite; palette: Palette; px: number }) {
  const rects = useMemo(() => spriteRects(sprite), [sprite]);
  const w = sprite[0].length * px, h = sprite.length * px;
  return (
    <Svg width={w} height={h}>
      {rects.map((r, i) => <Rect key={i} x={r.x * px} y={r.y * px} width={r.w * px} height={px} fill={palette[r.ch] ?? '#FFF'} />)}
    </Svg>
  );
});

// Pętla 0→1 (albo 0→1→0 dla `pingPong`) na natywnym sterowniku; startuje tylko, gdy `run`.
function useLoop(ms: number, run: boolean, pingPong = false) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!run) { v.stopAnimation(); return; }
    const ease = pingPong ? Easing.inOut(Easing.sin) : Easing.linear;
    const anim = pingPong
      ? Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: ms, easing: ease, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: ms, easing: ease, useNativeDriver: true }),
      ]))
      : Animated.loop(Animated.timing(v, { toValue: 1, duration: ms, easing: ease, useNativeDriver: true }));
    v.setValue(0);
    anim.start();
    return () => anim.stop();
  }, [run, ms, pingPong, v]);
  return v;
}

/** Przesunięta faza pętli 0..1: wartość `from`→`to` z "zawinięciem" w punkcie fazy. */
const wrap = (t: Animated.Value, phase: number, from: number, to: number) => {
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

function useActive(): boolean {
  const focused = useFocusedSafe();
  const [fg, setFg] = useState(AppState.currentState !== 'background');
  const [still, setStill] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setFg(s === 'active'));
    AccessibilityInfo.isReduceMotionEnabled?.().then(setStill).catch(() => {});
    return () => sub.remove();
  }, []);
  return focused && fg && !still;
}

/** `px` = rozmiar piksela (domyślnie z wymiarów), `inset` = odstęp od prawej/górnej krawędzi.
 *  Używane w kaflu Dashboardu i w karcie "teraz" okna pogody (ten sam styl, 2026-11-23). */
export default memo(function WeatherScene({ scene, wind, px: pxFixed, inset = 10 }: { scene: WeatherToneKey; wind: number; px?: number; inset?: number }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const run = useActive() && !!size;
  const fast = useLoop(scene === 'heavy' || scene === 'storm' ? 700 : 950, run);
  const slow = useLoop(5200, run, true);
  const snowT = useLoop(3400, run);
  const blink = useLoop(2600, run);
  const windT = useLoop(1800, run && wind >= 25);
  // drugie tempo dla części cząstek — nie lecą wszystkie w jednym rytmie
  const fast2 = useLoop(scene === 'heavy' || scene === 'storm' ? 900 : 1250, run && (scene === 'drizzle' || scene === 'rain' || scene === 'heavy' || scene === 'storm' || scene === 'freezing'));
  const snowT2 = useLoop(4600, run && (scene === 'snow' || scene === 'freezing'));
  const windT2 = useLoop(2600, run && wind >= 25);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) setSize({ w: width, h: height });
  };
  if (!size) return <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none" />;

  const { w, h } = size;
  const px = pxFixed ?? Math.max(2, Math.round(Math.min(w / 42, h / 26)));
  const right = inset;
  const top = Math.max(2, inset - 2);
  const cloudW = CLOUD_BIG[0].length * px;
  const cloudH = CLOUD_BIG.length * px;
  const cloudX = w - right - cloudW;

  const sun = scene === 'sun' || scene === 'partly';
  const moon = scene === 'night' || scene === 'partlyNight';
  const cloudy = !(scene === 'sun' || scene === 'night');
  const rainy = scene === 'drizzle' || scene === 'rain' || scene === 'heavy' || scene === 'storm' || scene === 'freezing';
  const snowy = scene === 'snow' || scene === 'freezing';
  const cloudP = scene === 'storm' || scene === 'heavy' ? CLOUD_DARK : scene === 'partly' || scene === 'partlyNight' ? CLOUD_LIGHT : CLOUD_GRAY;
  const drops = scene === 'drizzle' ? 4 : scene === 'heavy' || scene === 'storm' ? 10 : scene === 'freezing' ? 4 : rainy ? 7 : 0;
  const flakes = scene === 'snow' ? 8 : scene === 'freezing' ? 3 : 0;
  // Z opadem chmura przy samej górze, żeby krople miały drogę nad tekstem.
  const cloudY = rainy || snowy ? top - px : top + px * 3;
  const fallTo = Math.max(px * 8, h * 0.72 - (cloudY + cloudH));

  const r = rng(scene.length * 7919 + drops * 31 + flakes);
  const between = (a: number, b: number) => a + (b - a) * r();
  const rainSlant = wind >= 25 ? px * 3 : px * 0.6;
  const rain = Array.from({ length: drops }, () => ({
    x: Math.round(between(cloudX + px, cloudX + cloudW - px * 2)),
    y0: Math.round(between(0, px * 3)),
    ph: r(), slow: r() < 0.45, len: between(0.7, 1), slant: rainSlant * between(0.6, 1.2),
  }));
  const snow = Array.from({ length: flakes }, () => {
    const amp = px * between(0.8, 2.4) * (r() < 0.5 ? -1 : 1);
    const turns = r() < 0.5 ? 1 : 2;
    const swayIn = turns === 1 ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
    const swayOut = swayIn.map((_, k) => [0, amp, 0, -amp][k % 4]);
    return {
      x: Math.round(between(cloudX - px, cloudX + cloudW - px)),
      y0: Math.round(between(0, px * 4)),
      ph: r(), slow: r() < 0.5, len: between(0.65, 1), big: r() < 0.35, swayIn, swayOut,
    };
  });
  // wiatr tylko w górnej części kafla (nad temperaturą)
  const gusts = wind >= 25 ? Array.from({ length: 3 }, () => ({
    y: Math.round(between(h * 0.05, h * 0.34)), ph: r(), slow: r() < 0.5, short: r() < 0.5, op: between(0.5, 1),
  })) : [];

  const drift = (amp: number) => ({ transform: [{ translateX: slow.interpolate({ inputRange: [0, 1], outputRange: [-amp, amp] }) }] });

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {/* słońce: promienie pulsują, tarcza lekko "oddycha" */}
      {sun && (
        <View style={{ position: 'absolute', right: scene === 'partly' ? right + cloudW * 0.45 : right, top }}>
          <Animated.View style={{ opacity: slow.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }}>
            <Pix sprite={SUN_RAYS} palette={SUN_P} px={px} />
          </Animated.View>
          <View style={{ position: 'absolute', left: px * 3, top: px * 3 }}>
            <Pix sprite={SUN_CORE} palette={SUN_P} px={px} />
          </View>
        </View>
      )}

      {/* księżyc + migające gwiazdy */}
      {moon && (
        <>
          <View style={{ position: 'absolute', right: scene === 'partlyNight' ? right + cloudW * 0.5 : right + px * 2, top: top + px }}>
            <Pix sprite={MOON} palette={MOON_P} px={px} />
          </View>
          {[[0.18, 0.1, 0], [0.42, 0.22, 0.33], [0.3, 0.42, 0.66], [0.55, 0.06, 0.5]].map(([fx, fy, ph], i) => (
            <Animated.View key={i} style={{ position: 'absolute', left: w * fx, top: h * fy, opacity: wrap(blink, ph, 0, 1).interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1, 0.2] }) }}>
              <Pix sprite={STAR} palette={STAR_P} px={Math.max(1, px - 1)} />
            </Animated.View>
          ))}
        </>
      )}

      {/* mgła: dwa pasy płyną w przeciwne strony */}
      {scene === 'fog' && [0.3, 0.46].map((fy, i) => (
        <Animated.View key={i} style={[{ position: 'absolute', right: right - px * 2, top: h * fy, opacity: 0.7 }, drift(i ? -px * 3 : px * 3)]}>
          <Pix sprite={FOG} palette={FOG_P} px={px} />
        </Animated.View>
      ))}

      {/* deszcz pod chmurą (rysowany przed chmurą, żeby krople wychodziły spod niej) */}
      {rain.map((d, i) => {
        const prog = wrap(d.slow ? fast2 : fast, d.ph, 0, 1);
        return (
          <Animated.View key={`d${i}`} style={{
            position: 'absolute', left: d.x, top: cloudY + cloudH - px * 2 + d.y0,
            transform: [
              { translateY: prog.interpolate({ inputRange: [0, 1], outputRange: [0, fallTo * d.len] }) },
              { translateX: prog.interpolate({ inputRange: [0, 1], outputRange: [0, d.slant] }) },
            ],
            opacity: prog.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.8, 0.1] }),
          }}>
            <Pix sprite={DROP} palette={DROP_P} px={px} />
          </Animated.View>
        );
      })}
      {snow.map((f, i) => {
        const prog = wrap(f.slow ? snowT2 : snowT, f.ph, 0, 1);
        return (
          <Animated.View key={`f${i}`} style={{
            position: 'absolute', left: f.x, top: cloudY + cloudH - px * 2 + f.y0,
            transform: [
              { translateY: prog.interpolate({ inputRange: [0, 1], outputRange: [0, fallTo * f.len] }) },
              // własne kołysanie każdego płatka (amplituda, kierunek, ile zakosów)
              { translateX: prog.interpolate({ inputRange: f.swayIn, outputRange: f.swayOut }) },
            ],
            opacity: prog.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0.85, 0.1] }),
          }}>
            <Pix sprite={FLAKE} palette={FLAKE_P} px={f.big ? px : Math.max(1, px - 1)} />
          </Animated.View>
        );
      })}

      {/* błysk */}
      {scene === 'storm' && (
        <Animated.View style={{
          position: 'absolute', left: cloudX + cloudW * 0.45, top: cloudY + cloudH - px,
          opacity: blink.interpolate({ inputRange: [0, 0.7, 0.72, 0.78, 0.8, 1], outputRange: [0, 0, 1, 1, 0, 0] }),
        }}>
          <Pix sprite={BOLT} palette={BOLT_P} px={px} />
        </Animated.View>
      )}

      {/* chmury: duża + mała, płyną powoli */}
      {cloudy && scene !== 'fog' && (
        <>
          {scene !== 'partly' && scene !== 'partlyNight' && (
            <Animated.View style={[{ position: 'absolute', left: cloudX - px * 7, top: Math.max(2, cloudY - px * 3), opacity: 0.75 }, drift(-px * 2)]}>
              <Pix sprite={CLOUD_SMALL} palette={cloudP} px={px} />
            </Animated.View>
          )}
          <Animated.View style={[{ position: 'absolute', left: cloudX, top: scene === 'partly' || scene === 'partlyNight' ? cloudY + px * 4 : cloudY }, drift(px * 2)]}>
            <Pix sprite={CLOUD_BIG} palette={cloudP} px={px} />
          </Animated.View>
        </>
      )}

      {/* wiatr (≥ 25 km/h): smugi przelatują przez scenę */}
      {gusts.map((g, i) => (
        <Animated.View key={`w${i}`} style={{
          position: 'absolute', left: 0, top: g.y, opacity: g.op,
          transform: [{ translateX: wrap(g.slow ? windT2 : windT, g.ph, -px * 14, w) }],
        }}>
          <Pix sprite={g.short ? WIND_SHORT : WIND} palette={WIND_P} px={Math.max(1, px - 1)} />
        </Animated.View>
      ))}
    </View>
  );
});

/** Tło "nieba" kafla — półprzezroczysty odcień pod szkło (bez blur, który na Androidzie laguje). */
export const SKY: Record<WeatherToneKey, string> = {
  sun: '#F59E0B', night: '#6366F1', partly: '#F59E0B', partlyNight: '#6366F1', cloud: '#9CA3AF',
  fog: '#94A3B8', drizzle: '#38BDF8', rain: '#3B82F6', heavy: '#2563EB', freezing: '#22D3EE', snow: '#CBD5E1', storm: '#8B5CF6',
};
