import { memo } from 'react';
import { View, Animated } from 'react-native';
import { Pix, useLoop, wrap, useActive, type Sprite, type Palette } from '@/components/design/pixelAnim';
import type { FactCat } from '@/utils/factsData';

// Ikona dziedziny ciekawostki w pixel-art (2026-11-25, user: "ulepsz ekran ciekawostek jak
// robiliśmy z pogodą"). Ten sam silnik co pogoda/saldo (components/design/pixelAnim.tsx):
// rysunek 12×12, spokojne unoszenie (±1 piksel) i jedna mrugająca iskierka. Kolory stonowane,
// jeden akcent na dziedzinę, reszta szarości — ikona ma być znakiem, nie ozdobą, która woła.

const ICONS: Record<FactCat, { sprite: Sprite; pal: Palette }> = {
  zdrowie: {
    sprite: [
      '............',
      '..HHH..HHH..',
      '.HLLHHHHHHH.',
      '.HLHHHHHHHD.',
      '.HHHHHHHHHD.',
      '.HHHHHHHHHD.',
      '..HHHHHHHD..',
      '...HHHHHD...',
      '....HHHD....',
      '.....HD.....',
      '............',
      '............',
    ],
    pal: { H: '#E58A8A', L: '#F7D4D4', D: '#A85454' },
  },
  medycyna: {
    sprite: [
      '............',
      '............',
      '............',
      '..WWWWAAAA..',
      '.WLLWWAAAAA.',
      '.WLWWWAAAAA.',
      '.WWWWWAAAAD.',
      '.GWWWWAAADD.',
      '..GGGGDDDD..',
      '............',
      '............',
      '............',
    ],
    pal: { W: '#E7E5E4', L: '#FFFFFF', G: '#A8A29E', A: '#7FB3E0', D: '#4F7CA6' },
  },
  materialy: {
    sprite: [
      '............',
      '...LLLLLL...',
      '..LWLLLLAA..',
      '.LWLLLLAAAA.',
      'AAAAAAAAAAAA',
      '.AALLLAAADD.',
      '..AALLAADD..',
      '...AALADD...',
      '....AADD....',
      '.....AD.....',
      '............',
      '............',
    ],
    pal: { W: '#FFFFFF', L: '#CDEBF0', A: '#83C3CF', D: '#4E8C98' },
  },
  kosmos: {
    sprite: [
      '............',
      '....PPPP....',
      '...PLLPPP...',
      '..PLPPPPPD..',
      'R.PPPPPPPD.R',
      '.RRRRRRRRRR.',
      '..PPPPPPDD..',
      '...PPPPDD...',
      '....PDDD....',
      '............',
      '............',
      '............',
    ],
    pal: { P: '#B9A6E8', L: '#E4DCF8', D: '#7C67B8', R: '#D6D3D1' },
  },
  swiat: {
    sprite: [
      '............',
      '....GGGG....',
      '..GGLGGGGG..',
      '.GLLGGGGGGD.',
      '.GLGGGGGGGD.',
      '.GGGGGGGGDD.',
      '..GGGGGGDD..',
      '.....TT.....',
      '.....TT.....',
      '...BBBBBB...',
      '............',
      '............',
    ],
    pal: { G: '#7DBF8E', L: '#C4E5CC', D: '#4D8A5E', T: '#9C7B5C', B: '#78716C' },
  },
  lifehacki: {
    sprite: [
      '............',
      '....YYYY....',
      '...YWWYYY...',
      '..YWYYYYYO..',
      '..YWYYYYYO..',
      '..YYYYYYYO..',
      '...YYYYYO...',
      '....GGGG....',
      '....SSSS....',
      '....GGGG....',
      '.....SS.....',
      '............',
    ],
    pal: { Y: '#EBCB76', W: '#FBF1D3', O: '#B8913A', G: '#A8A29E', S: '#6B6560' },
  },
  tech: {
    sprite: [
      '............',
      '...P.P.P.P..',
      '..BBBBBBBB..',
      'PPBLBBBBBBPP',
      '..BBCCCCBB..',
      'PPBBCAACBBPP',
      '..BBCAACBB..',
      'PPBBCCCCBBPP',
      '..BBBBBBBB..',
      '...P.P.P.P..',
      '............',
      '............',
    ],
    pal: { P: '#A8A29E', B: '#57534E', L: '#8A847E', C: '#78716C', A: '#8FD3B6' },
  },
};

const SPARK: Sprite = ['.W.', 'WWW', '.W.'];
const SPARK_P: Palette = { W: '#F5F5F4' };

export default memo(function FactIcon({ cat, px = 3 }: { cat: FactCat; px?: number }) {
  const run = useActive();
  const bob = useLoop(2600, run, true);
  const blink = useLoop(3400, run);
  const ic = ICONS[cat] ?? ICONS.swiat;
  const size = 12 * px;
  const sp = Math.max(1, px - 1);
  return (
    <View style={{ width: size + sp * 2, height: size }} pointerEvents="none">
      <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -px] }) }] }}>
        <Pix sprite={ic.sprite} palette={ic.pal} px={px} />
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
