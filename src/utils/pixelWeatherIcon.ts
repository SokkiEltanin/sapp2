// Ikona pogody pixel art → prostokąty z kolorami (siatka 13×11). Dane: src/data/pixelWeather.json
// (to samo źródło czyta plugins/withWeatherWidget.js dla widgetu pulpitu, 2026-11-24).
import data from '@/data/pixelWeather.json';
import { spriteRects } from '@/utils/pixelSprite';
import type { WeatherToneKey } from '@/utils/weather';

type IconDef = { cloud: 'light' | 'gray' | 'dark'; snowWhite?: boolean; layers: [string, number, number][] };
export const PIXEL_GRID = data.grid as [number, number];

export function pixelIconRects(k: WeatherToneKey): { x: number; y: number; w: number; fill: string }[] {
  const icons = data.icons as unknown as Record<string, IconDef>;
  const def = icons[k] ?? icons.cloud;
  const pal: Record<string, string> = { ...data.pal, ...(data.cloudPal as Record<string, Record<string, string>>)[def.cloud], ...(def.snowWhite ? { W: '#F8FAFC' } : {}) };
  const sprites = data.sprites as Record<string, string[]>;
  return def.layers.flatMap(([name, dx, dy]) => spriteRects(sprites[name]).map((r) => ({ x: r.x + dx, y: r.y + dy, w: r.w, fill: pal[r.ch] ?? '#FFFFFF' })));
}
