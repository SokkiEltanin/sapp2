import { memo } from 'react';
import { View, Animated } from 'react-native';
import { Pix, useLoop, wrap, useActive, type Sprite, type Palette } from '@/components/design/pixelAnim';
import { artFor, ART_SIZE } from '@/utils/factArt';
import type { Fact } from '@/utils/factsData';

// Ikona pixel-art KONKRETNEJ ciekawostki (2026-11-25, user: "tematyczne — mózg, sen z księżycem
// czy łóżkiem — i żeby były wygenerowane"): rysunek 16×16 z src/data/factArt.json (generator
// scripts/gen-fact-art.py), wybór w utils/factArt.ts. Ten sam silnik co pogoda/saldo
// (components/design/pixelAnim.tsx): spokojne unoszenie (±1 piksel) i jedna mrugająca iskierka.
const SPARK: Sprite = ['.W.', 'WWW', '.W.'];
const SPARK_P: Palette = { W: '#F5F5F4' };

export default memo(function FactIcon({ fact, px = 3 }: { fact: Pick<Fact, 'id' | 'cat' | 'topic' | 'teaser'>; px?: number }) {
  const run = useActive();
  const bob = useLoop(2600, run, true);
  const blink = useLoop(3400, run);
  const art = artFor(fact);
  const size = ART_SIZE * px;
  const sp = Math.max(1, px - 1);
  return (
    <View style={{ width: size + sp, height: size + px }} pointerEvents="none">
      <Animated.View style={{ marginTop: px, transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -px] }) }] }}>
        <Pix sprite={art.rows} palette={art.pal} px={px} />
      </Animated.View>
      <Animated.View style={{
        position: 'absolute', right: 0, top: 0,
        opacity: wrap(blink, 0, 0, 1).interpolate({ inputRange: [0, 0.12, 0.26, 1], outputRange: [0, 1, 0, 0] }),
      }}>
        <Pix sprite={SPARK} palette={SPARK_P} px={sp} />
      </Animated.View>
    </View>
  );
});
