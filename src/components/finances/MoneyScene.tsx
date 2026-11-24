import { memo, useMemo, useState } from 'react';
import { View, Animated, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Pix, useLoop, wrap, useActive, type Sprite, type Palette } from '@/components/design/pixelAnim';
import { spriteRects } from '@/utils/pixelSprite';

// Saldo: stosiki monet (2026-11-24, user: "spadające banknoty z monetami wyglądają okropnie,
// jakościowo i animacyjnie klapa — da się zrobić zajebiście?"). Zamiast deszczu sprite'ów:
// spokojna, dopracowana scena w prawym dolnym rogu —
//   • 3 stosiki monet pixel-art (boki z cieniowaniem + wierzch z wytłoczeniem), wysokość
//     zależna od salda (skala log, ujemne saldo = jedna samotna moneta),
//   • co ~5 s jedna moneta spada na najwyższy stosik: przyspiesza jak przy grawitacji,
//     przy lądowaniu się spłaszcza i odbija, potem znika "w stosie",
//   • po stosikach przesuwa się błysk światła, obok migoczą 3 iskierki,
//   • pod spodem ciepła złota poświata.
// Tylko transform/opacity (natywnie), ten sam stop co pogoda (components/design/pixelAnim.tsx).

// bok monety (12×3): jasny lewy brzeg → ciemny prawy, dolna krawędź cienia
const SIDE: Sprite = [
  'LLYYYYYYYYOO',
  'LYYYYYYYYYOD',
  'DDDDDDDDDDDD',
];
// wierzch monety (12×4) z wytłoczonym znakiem
const TOP: Sprite = [
  '..WWWWWWWW..',
  '.WLLYYYYYYO.',
  'WLYYOOOOYYYO',
  '.YYYYYYYYYO.',
];
const SPARK: Sprite = ['.W.', 'WWW', '.W.'];
const P: Palette = { W: '#FEF3C7', L: '#FDE68A', Y: '#FBBF24', O: '#D97706', D: '#92400E' };
const SPARK_P: Palette = { W: '#FEF9C3' };

const COIN_W = 12;
const SIDE_H = 3;   // ile pikseli przybywa na monetę
const TOP_H = 4;

/** Ile monet w stosikach z salda: skala log (100 zł ≈ 6, 1 000 ≈ 9, 10 000 ≈ 12), 0–14. */
export function coinsFor(balance: number): number {
  if (!(balance > 0)) return 1;
  return Math.max(2, Math.min(14, Math.round(Math.log10(balance) * 3)));
}
/** Podział monet na 3 stosiki: środkowy najwyższy. */
function stacksOf(n: number): number[] {
  if (n <= 1) return [n];
  const mid = Math.ceil(n * 0.45);
  const left = Math.ceil((n - mid) * 0.55);
  return [left, mid, n - mid - left].filter((x) => x > 0);
}

/** Stosik jako JEDNO Svg: boki od dołu, wierzch na górze. */
const Stack = memo(function Stack({ n, px }: { n: number; px: number }) {
  const rects = useMemo(() => {
    const out: { x: number; y: number; w: number; fill: string }[] = [];
    const H = n * SIDE_H + TOP_H;
    for (let i = 0; i < n; i++) {
      const y0 = H - (i + 1) * SIDE_H;
      for (const r of spriteRects(SIDE)) out.push({ x: r.x, y: y0 + r.y, w: r.w, fill: P[r.ch] });
    }
    const yTop = H - n * SIDE_H - TOP_H + 1;
    for (const r of spriteRects(TOP)) out.push({ x: r.x, y: yTop + r.y, w: r.w, fill: P[r.ch] });
    return out;
  }, [n]);
  const H = n * SIDE_H + TOP_H;
  return (
    <Svg width={COIN_W * px} height={H * px}>
      {rects.map((r, i) => <Rect key={i} x={r.x * px} y={r.y * px} width={r.w * px} height={px} fill={r.fill} />)}
    </Svg>
  );
});

export default memo(function MoneyScene({ balance }: { balance: number }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const run = useActive() && !!size;
  const drop = useLoop(5200, run);    // spadająca moneta (cały cykl)
  const shine = useLoop(3800, run);   // błysk po stosikach
  const blink = useLoop(2400, run);   // iskierki

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) setSize({ w: width, h: height });
  };
  if (!size) return <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none" />;

  const { w, h } = size;
  const px = Math.max(2, Math.round(Math.min(w / 90, h / 50)));
  const stacks = stacksOf(coinsFor(balance));
  const gap = px * 2;
  const coinW = COIN_W * px;
  const right = 14, bottom = 12;
  const totalW = stacks.length * coinW + (stacks.length - 1) * gap;
  const left0 = w - right - totalW;
  const base = h - bottom;                                        // dół stosików
  const tallest = stacks.indexOf(Math.max(...stacks));
  const tallH = (stacks[tallest] * SIDE_H + TOP_H) * px;
  const dropX = left0 + tallest * (coinW + gap);
  const landY = base - tallH - SIDE_H * px;                      // moneta siada na wierzchu stosika
  const startY = -px * 10;
  const fall = landY - startY;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {/* ciepła poświata pod stosikami */}
      <LinearGradient
        colors={['rgba(251,191,36,0)', 'rgba(251,191,36,0.10)']}
        start={{ x: 0.35, y: 0.2 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {stacks.map((n, i) => {
        const sh = (n * SIDE_H + TOP_H) * px;
        const x = left0 + i * (coinW + gap);
        return (
          <View key={i} style={{ position: 'absolute', left: x, top: base - sh, width: coinW, height: sh, overflow: 'hidden' }}>
            <Stack n={n} px={px} />
            {/* błysk: wąski jasny pas przelatuje po stosiku (każdy chwilę później) */}
            <Animated.View style={{
              position: 'absolute', top: 0, bottom: 0, width: px * 2, backgroundColor: 'rgba(255,251,235,0.55)',
              transform: [{ translateX: wrap(shine, (1 - i * 0.06) % 1, 0, 1).interpolate({ inputRange: [0, 0.22, 1], outputRange: [-px * 3, coinW + px, coinW + px] }) }],
            }} />
          </View>
        );
      })}

      {/* spadająca moneta: grawitacja (szybciej pod koniec), spłaszczenie i odbicie, znika w stosie */}
      <Animated.View style={{
        position: 'absolute', left: dropX, top: startY,
        opacity: drop.interpolate({ inputRange: [0, 0.01, 0.3, 0.34, 1], outputRange: [0, 1, 1, 0, 0] }),
        transform: [
          { translateY: drop.interpolate({
            inputRange: [0, 0.05, 0.1, 0.15, 0.2, 0.24, 0.27, 1],
            outputRange: [0, fall * 0.06, fall * 0.25, fall * 0.56, fall, fall - px * 3, fall, fall],
          }) },
          { scaleY: drop.interpolate({ inputRange: [0, 0.2, 0.215, 0.235, 0.27, 1], outputRange: [1, 1, 0.6, 1.1, 1, 1] }) },
        ],
      }}>
        <Stack n={1} px={px} />
      </Animated.View>

      {/* iskierki wokół stosików */}
      {[[-px * 5, 0.55, 0], [totalW + px, 0.3, 0.4], [totalW * 0.5, 0.05, 0.75]].map(([dx, fy, ph], i) => (
        <Animated.View key={`s${i}`} style={{
          position: 'absolute', left: left0 + dx, top: base - tallH - px * 6 + (tallH + px * 6) * fy,
          opacity: wrap(blink, ph, 0, 1).interpolate({ inputRange: [0, 0.15, 0.3, 1], outputRange: [0, 1, 0, 0] }),
        }}>
          <Pix sprite={SPARK} palette={SPARK_P} px={Math.max(1, px - 1)} />
        </Animated.View>
      ))}
    </View>
  );
});
