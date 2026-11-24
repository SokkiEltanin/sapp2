import { memo, useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { weatherToneKey } from '@/utils/weather';
import { pixelIconRects, PIXEL_GRID } from '@/utils/pixelWeatherIcon';

// Mała, NIERUCHOMA ikona pixel-art (2026-11-23, user: "jak się wchodzi, to ten sam styl") —
// w wykresach 24 h i 7 dni zamiast ikon lucide, ten sam rysunek co scena w kaflu
// (components/weather/WeatherScene.tsx). Bez animacji: kilkadziesiąt naraz na liście.
// Rysunki: src/data/pixelWeather.json (wspólne z widgetem pulpitu, 2026-11-24).
export default memo(function PixelWeatherIcon({ code, isDay = true, size = 18 }: { code: number; isDay?: boolean; size?: number }) {
  const k = weatherToneKey(code, isDay);
  const rects = useMemo(() => pixelIconRects(k), [k]);
  const px = Math.max(1, Math.round(size / 11));
  return (
    <Svg width={PIXEL_GRID[0] * px} height={PIXEL_GRID[1] * px}>
      {rects.map((r, i) => <Rect key={i} x={r.x * px} y={r.y * px} width={r.w * px} height={px} fill={r.fill} />)}
    </Svg>
  );
});
