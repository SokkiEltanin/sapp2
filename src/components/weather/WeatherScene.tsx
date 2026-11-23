import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet, AppState, AccessibilityInfo, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useIsFocused } from '@react-navigation/native';
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

function useActive(): boolean {
  const focused = useIsFocused();
  const [fg, setFg] = useState(AppState.currentState !== 'background');
  const [still, setStill] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setFg(s === 'active'));
    AccessibilityInfo.isReduceMotionEnabled?.().then(setStill).catch(() => {});
    return () => sub.remove();
  }, []);
  return focused && fg && !still;
}

export default memo(function WeatherScene({ scene, wind }: { scene: WeatherToneKey; wind: number }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const run = useActive() && !!size;
  const fast = useLoop(scene === 'heavy' || scene === 'storm' ? 700 : 950, run);
  const slow = useLoop(5200, run, true);
  const snowT = useLoop(3400, run);
  const blink = useLoop(2600, run);
  const windT = useLoop(1800, run && wind >= 25);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) setSize({ w: width, h: height });
  };
  if (!size) return <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none" />;

  const { w, h } = size;
  const px = Math.max(2, Math.round(Math.min(w / 42, h / 26)));
  const right = 10;
  const top = 8;
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
  const flakes = scene === 'snow' ? 7 : scene === 'freezing' ? 3 : 0;
  // Z opadem chmura przy samej górze, żeby krople miały drogę nad tekstem.
  const cloudY = rainy || snowy ? top - px : top + px * 3;
  const fallTo = Math.max(px * 8, h * 0.72 - (cloudY + cloudH));

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
      {Array.from({ length: drops }, (_, i) => {
        const x = cloudX + px * 2 + ((i * 5) % 13) * px;
        const ph = (i * 0.37) % 1;
        return (
          <Animated.View key={`d${i}`} style={{
            position: 'absolute', left: x, top: cloudY + cloudH - px * 2,
            transform: [{ translateY: wrap(fast, ph, 0, fallTo) }],
            opacity: wrap(fast, ph, 1, 0.15),
          }}>
            <Pix sprite={DROP} palette={DROP_P} px={px} />
          </Animated.View>
        );
      })}
      {Array.from({ length: flakes }, (_, i) => {
        const x = cloudX + px * 1 + ((i * 4) % 14) * px;
        const ph = (i * 0.29) % 1;
        return (
          <Animated.View key={`f${i}`} style={{
            position: 'absolute', left: x, top: cloudY + cloudH - px * 2,
            transform: [
              { translateY: wrap(snowT, ph, 0, fallTo) },
              { translateX: slow.interpolate({ inputRange: [0, 1], outputRange: [i % 2 ? -px : px, i % 2 ? px : -px] }) },
            ],
            opacity: wrap(snowT, ph, 1, 0.2),
          }}>
            <Pix sprite={FLAKE} palette={FLAKE_P} px={Math.max(1, px - 1)} />
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
      {wind >= 25 && [0.2, 0.38, 0.52].map((fy, i) => (
        <Animated.View key={`w${i}`} style={{
          position: 'absolute', left: 0, top: h * fy,
          transform: [{ translateX: wrap(windT, i * 0.33, -px * 12, w) }],
        }}>
          <Pix sprite={WIND} palette={WIND_P} px={Math.max(1, px - 1)} />
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
