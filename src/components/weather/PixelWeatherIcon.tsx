import { memo, useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { weatherToneKey, type WeatherToneKey } from '@/utils/weather';
import { spriteRects } from '@/utils/pixelSprite';

// Mała, NIERUCHOMA ikona pixel-art (2026-11-23, user: "jak się wchodzi, to ten sam styl") —
// w wykresach 24 h i 7 dni zamiast ikon lucide, ten sam rysunek co scena w kaflu
// (components/weather/WeatherScene.tsx). Bez animacji: kilkadziesiąt naraz na liście.
// Siatka 13×11 pikseli; warstwy = sprite + paleta + przesunięcie.
type Layer = { sprite: string[]; dx: number; dy: number };

const SUN = [
  '.....Y.....',
  '..Y.....Y..',
  '....YYY....',
  '...YWYYY...',
  'Y.YYYYYYO.Y',
  '...YYYYO...',
  '....YOO....',
  '..Y.....Y..',
  '.....Y.....',
];
const SUN_SMALL = ['..Y..', '.YYY.', 'YYYYO', '.YYO.', '..O..'];
const MOON = [
  '..MMMM...',
  '.MMMM....',
  'MMMM.....',
  'MMMS.....',
  'MMMS.....',
  'MMMMS....',
  '.MMMMMMM.',
  '..MMMMM..',
];
const MOON_SMALL = ['.MM..', 'MM...', 'MM...', 'MMM..', '.MMMM'];
const CLOUD = [
  '....LLL....',
  '..LLLLLL...',
  '.LLLLLLLLL.',
  'LLLLLLLLLLL',
  'GLLLLLLLLLG',
  '.GGGGGGGGG.',
];
const RAIN = ['.B...B...B.', 'B...B...B..'];
const DRIZZLE = ['..B.....B..'];
const SNOW = ['.W...W...W.', '...W...W...'];
const SLEET = ['.B...W...B.', '...W...B...'];
const BOLT = ['...YY', '..YY.', '.YYYY', '...Y.'];
const FOG = ['LLLLLLLLL..', '..LLLLLLLLL', 'LLLLL.LLLLL', '...LLLLLLL.'];

const PAL: Record<string, string> = {
  Y: '#FBBF24', O: '#F59E0B', W: '#FDE68A', M: '#E0E7FF', S: '#A5B4FC', B: '#60A5FA',
};
const CLOUD_PAL: Record<'light' | 'gray' | 'dark', { L: string; G: string }> = {
  light: { L: '#E5E7EB', G: '#9CA3AF' }, gray: { L: '#9CA3AF', G: '#6B7280' }, dark: { L: '#6B7280', G: '#4B5563' },
};

function layers(k: WeatherToneKey): { layers: Layer[]; cloud: 'light' | 'gray' | 'dark'; snowWhite?: boolean } {
  const c = (dy = 1): Layer => ({ sprite: CLOUD, dx: 1, dy });
  switch (k) {
    case 'sun': return { layers: [{ sprite: SUN, dx: 1, dy: 1 }], cloud: 'light' };
    case 'night': return { layers: [{ sprite: MOON, dx: 2, dy: 1 }], cloud: 'light' };
    case 'partly': return { layers: [{ sprite: SUN_SMALL, dx: 7, dy: 0 }, c(4)], cloud: 'light' };
    case 'partlyNight': return { layers: [{ sprite: MOON_SMALL, dx: 7, dy: 0 }, c(4)], cloud: 'light' };
    case 'fog': return { layers: [{ sprite: FOG, dx: 1, dy: 3 }], cloud: 'gray' };
    case 'drizzle': return { layers: [c(1), { sprite: DRIZZLE, dx: 1, dy: 8 }], cloud: 'gray' };
    case 'rain': return { layers: [c(1), { sprite: RAIN, dx: 1, dy: 8 }], cloud: 'gray' };
    case 'heavy': return { layers: [c(0), { sprite: RAIN, dx: 1, dy: 7 }, { sprite: RAIN, dx: 2, dy: 9 }], cloud: 'dark' };
    case 'freezing': return { layers: [c(1), { sprite: SLEET, dx: 1, dy: 8 }], cloud: 'gray', snowWhite: true };
    case 'snow': return { layers: [c(1), { sprite: SNOW, dx: 1, dy: 8 }], cloud: 'gray', snowWhite: true };
    case 'storm': return { layers: [c(0), { sprite: BOLT, dx: 5, dy: 6 }, { sprite: DRIZZLE, dx: 0, dy: 9 }], cloud: 'dark' };
    default: return { layers: [c(3)], cloud: 'gray' };
  }
}

export default memo(function PixelWeatherIcon({ code, isDay = true, size = 18 }: { code: number; isDay?: boolean; size?: number }) {
  const k = weatherToneKey(code, isDay);
  const rects = useMemo(() => {
    const L = layers(k);
    const pal: Record<string, string> = { ...PAL, ...CLOUD_PAL[L.cloud], ...(L.snowWhite ? { W: '#F8FAFC' } : {}) };
    return L.layers.flatMap((ly) => spriteRects(ly.sprite).map((r) => ({ ...r, x: r.x + ly.dx, y: r.y + ly.dy, fill: pal[r.ch] ?? '#FFF' })));
  }, [k]);
  const px = Math.max(1, Math.round(size / 11));
  return (
    <Svg width={13 * px} height={11 * px}>
      {rects.map((r, i) => <Rect key={i} x={r.x * px} y={r.y * px} width={r.w * px} height={px} fill={r.fill} />)}
    </Svg>
  );
});
