import fs from 'fs';
import { parseWeather } from '@/utils/weather';
import { buildWeatherWidgetSnapshot, widgetIconName } from '@/utils/widgetWeather';

const fc = JSON.parse(fs.readFileSync(__dirname + '/fixtures/openmeteo-forecast.json', 'utf8'));
const w = parseWeather(fc, null, 'Kraków', 1000);

describe('widget pogody', () => {
  test('nazwy ikon = drawable z pluginu', () => {
    expect(widgetIconName('CloudSun')).toBe('wx_cloud_sun');
    expect(widgetIconName('Sun')).toBe('wx_sun');
    expect(widgetIconName('CloudLightning')).toBe('wx_cloud_lightning');
  });
  test('wszystkie ikony z weatherCodeInfo mają drawable w pluginie', () => {
    const plugin = fs.readFileSync(__dirname + '/../plugins/withWeatherWidget.js', 'utf8');
    for (const n of ['Sun', 'Moon', 'CloudSun', 'CloudMoon', 'Cloud', 'CloudFog', 'CloudDrizzle', 'CloudRain', 'CloudSnow', 'CloudLightning']) {
      expect(plugin).toContain(`${widgetIconName(n)}:`);
    }
  });
  test('snapshot: teraz, deszcz, 5 godzin co 3 h', () => {
    const s = buildWeatherWidgetSnapshot(w, 50.06, 19.94);
    expect(s.place).toBe('Kraków');
    expect(s.temp).toBe('5°');
    expect(s.icon).toBe('wx_cloud_rain');
    expect(s.line).toBe('pada do ok. 15:00');
    expect(s.rain).toBe(true);
    expect(s.hours).toHaveLength(5);
    expect(s.hours[0].t).toBe(w.hourly[3].time.slice(11, 16));
    expect(s.lat).toBe(50.06);
  });
});
