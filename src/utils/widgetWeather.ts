import { weatherCodeInfo, rainSummary, fmtTemp, type WeatherData } from './weather';

// Snapshot pod natywny widget "Pogoda" (2026-11-13, plugins/withWeatherWidget.js).
// Czyste (zero RN). TEN SAM format zapisuje Kotlin przy samodzielnym odświeżeniu
// (WeatherWidgetProvider.fromForecast) — zmiana pola = zmiana w obu miejscach.
export interface WeatherWidgetHour { t: string; icon: string; temp: string; pop: string }
export interface WeatherWidgetSnapshot {
  place: string; lat: number; lon: number; fetchedAt: number;
  temp: string; label: string; icon: string; hi: string; lo: string;
  line: string; rain: boolean; hours: WeatherWidgetHour[];
}

// Nazwa ikony lucide ("CloudSun") → drawable widgetu ("wx_cloud_sun").
export const widgetIconName = (lucide: string) => `wx_${lucide.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()}`;

export function buildWeatherWidgetSnapshot(w: WeatherData, lat: number, lon: number, slots = 5): WeatherWidgetSnapshot {
  const isDayAt = (t: string) => {
    const d = w.daily.find((x) => x.date === t.slice(0, 10));
    return d ? t >= d.sunrise && t < d.sunset : true;
  };
  const info = weatherCodeInfo(w.current.code, w.current.isDay);
  const today = w.daily[0];
  const line = rainSummary(w.hourly);
  // Co 3 h od teraz (+3, +6, …) — jak w Kotlinie.
  const hours: WeatherWidgetHour[] = [];
  for (let k = 1; hours.length < slots; k++) {
    const h = w.hourly[3 * k];
    if (!h) break;
    hours.push({
      t: h.time.slice(11, 16),
      icon: widgetIconName(weatherCodeInfo(h.code, isDayAt(h.time)).icon),
      temp: fmtTemp(h.temp),
      pop: h.pop >= 20 ? `${h.pop}%` : '',
    });
  }
  return {
    place: w.place, lat, lon, fetchedAt: w.fetchedAt,
    temp: fmtTemp(w.current.temp), label: info.label, icon: widgetIconName(info.icon),
    hi: today ? fmtTemp(today.max) : '', lo: today ? fmtTemp(today.min) : '',
    line, rain: !!line && !line.startsWith('bez'), hours,
  };
}
