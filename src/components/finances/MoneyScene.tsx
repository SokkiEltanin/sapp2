import { memo, useState } from 'react';
import { View, Animated, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Pix, useLoop, wrap, useActive, rng, type Sprite, type Palette } from '@/components/design/pixelAnim';

// Pieniądze z nieba w kaflu Saldo (2026-11-24, user: "pixelowa animacja do pieniążków na kaflu
// z SUMĄ, żeby ją wyróżnić — banknoty lecące z nieba"). Ten sam silnik co pogoda
// (components/design/pixelAnim.tsx): własne sprite'y, tylko transform/opacity, stop poza
// ekranem / w tle / przy "ogranicz ruch". Spokojnie: kilka sztuk, wolno, po prawej stronie kafla
// (kwota po lewej zostaje czytelna). Banknot "trzepocze" (scaleY), moneta się kręci (scaleX).
const BILL: Sprite = [
  'DDDDDDDDDDD',
  'DLGGGGGGGLD',
  'DGGGLLLGGGD',
  'DGGGLLLGGGD',
  'DLGGGGGGGLD',
  'DDDDDDDDDDD',
];
const COIN: Sprite = [
  '.YYY.',
  'YWYYO',
  'YYWYO',
  'YYYYO',
  '.OOO.',
];
const BILL_P: Palette = { D: '#15803D', G: '#22C55E', L: '#86EFAC' };
const COIN_P: Palette = { Y: '#FBBF24', O: '#D97706', W: '#FEF3C7' };

export default memo(function MoneyScene({ bills = 4, coins = 3 }: { bills?: number; coins?: number }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const run = useActive() && !!size;
  const fall = useLoop(6200, run);
  const fall2 = useLoop(8200, run);
  const flutter = useLoop(1100, run);
  const spin = useLoop(900, run);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) setSize({ w: width, h: height });
  };
  if (!size) return <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none" />;

  const { w, h } = size;
  const px = Math.max(2, Math.round(w / 80));
  const r = rng(424242 + bills * 7 + coins);
  const between = (a: number, b: number) => a + (b - a) * r();
  const items = [
    ...Array.from({ length: bills }, () => ({ coin: false })),
    ...Array.from({ length: coins }, () => ({ coin: true })),
  ].map((it) => {
    const spriteW = (it.coin ? COIN[0].length : BILL[0].length) * px;
    const amp = px * between(1.5, 4) * (r() < 0.5 ? -1 : 1);
    return {
      ...it,
      x: Math.round(between(w * 0.55, w - spriteW - 6)),
      ph: r(), slow: r() < 0.5, fph: r(), amp,
      op: it.coin ? between(0.6, 0.85) : between(0.4, 0.65),
    };
  });
  const top = -BILL.length * px * 2;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {items.map((it, i) => {
        const prog = wrap(it.slow ? fall2 : fall, it.ph, 0, 1);
        const flip = wrap(it.coin ? spin : flutter, it.fph, 0, 1);
        return (
          <Animated.View key={i} style={{
            position: 'absolute', left: it.x, top,
            opacity: prog.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, it.op, it.op, 0] }),
            transform: [
              { translateY: prog.interpolate({ inputRange: [0, 1], outputRange: [0, h - top] }) },
              { translateX: prog.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, it.amp, 0, -it.amp, 0] }) },
              it.coin
                ? { scaleX: flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.15, 1] }) }
                : { scaleY: flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.35, 1] }) },
            ],
          }}>
            <Pix sprite={it.coin ? COIN : BILL} palette={it.coin ? COIN_P : BILL_P} px={px} />
          </Animated.View>
        );
      })}
    </View>
  );
});
