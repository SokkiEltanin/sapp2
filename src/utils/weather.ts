// Pogoda (2026-11-13, user: "porządna pogoda... deszcz, wilgotność,
// zanieczyszczenie... godzinowa i dzienna", na Dashboardzie zamiast snu — sen
// i tak jest w Daily obok). Źródło: Open-Meteo (forecast + air-quality), bez
// klucza API. Ten plik = TYLKO czyste przekształcenia odpowiedzi API (testowalne
// na zapisanym fixture), sieć/GPS w services/weather.ts + hooks/useWeather.ts.
//
// Czasy z API przychodzą jako LOKALNE ("2026-11-13T07:00", `timezone=auto`) —
// porównujemy je jako stringi z `current.time`, żadnej konwersji stref.

export interface WeatherHour { time: string; temp: number; pop: number; precip: number; code: number }
export interface WeatherDay {
  date: string; code: number; max: number; min: number; precipSum: number; pop: number;
  sunrise: string; sunset: string; uvMax: number;
}
export interface AirQuality { aqi: number; pm25: number; pm10: number; no2: number | null; o3: number | null }
export interface WeatherData {
  place: string;
  fetchedAt: number;
  current: {
    time: string; temp: number; feels: number; humidity: number; precip: number; code: number;
    isDay: boolean; wind: number; gusts: number; pressure: number; uv: number;
  };
  hourly: WeatherHour[]; // od bieżącej godziny, 24 h
  daily: WeatherDay[];   // 7 dni, od dziś
  air: AirQuality | null;
}

type Num = number | null | undefined;
const n = (v: Num, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function parseWeather(fc: any, aq: any | null, place: string, fetchedAt = Date.now()): WeatherData {
  const c = fc.current ?? {};
  const nowHour = String(c.time ?? '').slice(0, 13); // "2026-11-13T07"
  const h = fc.hourly ?? {};
  const times: string[] = h.time ?? [];
  let start = times.findIndex((t) => t.slice(0, 13) >= nowHour);
  if (start < 0) start = 0;
  const hourly: WeatherHour[] = times.slice(start, start + 24).map((t, i) => ({
    time: t,
    temp: n(h.temperature_2m?.[start + i]),
    pop: n(h.precipitation_probability?.[start + i]),
    precip: n(h.precipitation?.[start + i]),
    code: n(h.weather_code?.[start + i]),
  }));
  const d = fc.daily ?? {};
  const daily: WeatherDay[] = (d.time ?? []).map((date: string, i: number) => ({
    date,
    code: n(d.weather_code?.[i]),
    max: n(d.temperature_2m_max?.[i]),
    min: n(d.temperature_2m_min?.[i]),
    precipSum: n(d.precipitation_sum?.[i]),
    pop: n(d.precipitation_probability_max?.[i]),
    sunrise: String(d.sunrise?.[i] ?? ''),
    sunset: String(d.sunset?.[i] ?? ''),
    uvMax: n(d.uv_index_max?.[i]),
  }));
  const a = aq?.current;
  const air: AirQuality | null = a && typeof a.european_aqi === 'number'
    ? { aqi: a.european_aqi, pm25: n(a.pm2_5), pm10: n(a.pm10), no2: a.nitrogen_dioxide ?? null, o3: a.ozone ?? null }
    : null;
  return {
    place,
    fetchedAt,
    current: {
      time: String(c.time ?? ''), temp: n(c.temperature_2m), feels: n(c.apparent_temperature), humidity: n(c.relative_humidity_2m),
      precip: n(c.precipitation), code: n(c.weather_code), isDay: c.is_day !== 0, wind: n(c.wind_speed_10m),
      gusts: n(c.wind_gusts_10m), pressure: n(c.pressure_msl), uv: n(c.uv_index),
    },
    hourly,
    daily,
    air,
  };
}

// Kody WMO → polska etykieta + nazwa ikony lucide.
export function weatherCodeInfo(code: number, isDay = true): { label: string; icon: string } {
  if (code === 0) return { label: isDay ? 'Słonecznie' : 'Bezchmurnie', icon: isDay ? 'Sun' : 'Moon' };
  if (code === 1) return { label: isDay ? 'Przeważnie słonecznie' : 'Przeważnie bezchmurnie', icon: isDay ? 'Sun' : 'Moon' };
  if (code === 2) return { label: 'Częściowe zachmurzenie', icon: isDay ? 'CloudSun' : 'CloudMoon' };
  if (code === 3) return { label: 'Pochmurno', icon: 'Cloud' };
  if (code === 45 || code === 48) return { label: 'Mgła', icon: 'CloudFog' };
  if (code >= 51 && code <= 55) return { label: 'Mżawka', icon: 'CloudDrizzle' };
  if (code === 56 || code === 57) return { label: 'Marznąca mżawka', icon: 'CloudDrizzle' };
  if (code === 61 || code === 63) return { label: code === 61 ? 'Słaby deszcz' : 'Deszcz', icon: 'CloudRain' };
  if (code === 65) return { label: 'Ulewa', icon: 'CloudRain' };
  if (code === 66 || code === 67) return { label: 'Marznący deszcz', icon: 'CloudRain' };
  if (code >= 71 && code <= 77) return { label: code === 75 ? 'Intensywny śnieg' : 'Śnieg', icon: 'CloudSnow' };
  if (code >= 80 && code <= 82) return { label: code === 82 ? 'Gwałtowne przelotne opady' : 'Przelotny deszcz', icon: 'CloudRain' };
  if (code === 85 || code === 86) return { label: 'Przelotny śnieg', icon: 'CloudSnow' };
  if (code >= 95) return { label: 'Burza', icon: 'CloudLightning' };
  return { label: 'Pochmurno', icon: 'Cloud' };
}

// Europejski indeks jakości powietrza (EAQI, 0–100+).
export function aqiInfo(aqi: number): { label: string; color: string } {
  if (aqi <= 20) return { label: 'bardzo dobre', color: '#22C55E' };
  if (aqi <= 40) return { label: 'dobre', color: '#A3E635' };
  if (aqi <= 60) return { label: 'umiarkowane', color: '#FBBF24' };
  if (aqi <= 80) return { label: 'złe', color: '#F97316' };
  if (aqi <= 100) return { label: 'bardzo złe', color: '#EF4444' };
  return { label: 'fatalne', color: '#A855F7' };
}

const hh = (t: string) => t.slice(11, 16);
const wet = (x: WeatherHour) => x.precip >= 0.1 || x.pop >= 60;

// Jedno zdanie o deszczu na najbliższe 12 h — najważniejsza informacja
// "praktyczna" (parasol?), na kafel Dashboardu.
export function rainSummary(hours: WeatherHour[]): string {
  const next = hours.slice(0, 12);
  if (next.length === 0) return '';
  if (wet(next[0])) {
    const dryIdx = next.findIndex((x) => !wet(x));
    return dryIdx < 0 ? 'pada, jeszcze kilka godzin' : `pada do ok. ${hh(next[dryIdx].time)}`;
  }
  const wetIdx = next.findIndex(wet);
  if (wetIdx < 0) return 'bez deszczu przez 12 h';
  return `deszcz ok. ${hh(next[wetIdx].time)}`;
}

// Krótka porada (opcjonalna) — tylko gdy faktycznie coś warto wiedzieć.
export function weatherTip(w: WeatherData): string | null {
  const today = w.daily[0];
  if (w.air && w.air.aqi > 60) return 'Złe powietrze — ogranicz wysiłek na zewnątrz';
  if (w.current.gusts >= 60) return `Silny wiatr, porywy do ${Math.round(w.current.gusts)} km/h`;
  if (today && today.uvMax >= 6) return `Wysokie UV (${Math.round(today.uvMax)}) — krem z filtrem`;
  if (w.current.feels <= -5) return `Odczuwalnie ${Math.round(w.current.feels)}° — ubierz się ciepło`;
  if (w.hourly.slice(0, 12).some((x) => x.temp <= 0) && w.hourly.slice(0, 12).some(wet)) return 'Możliwa ślizgawica';
  return null;
}

export const fmtTemp = (t: number) => `${Math.round(t) === 0 ? 0 : Math.round(t)}°`;
