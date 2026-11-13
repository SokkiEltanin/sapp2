import { parseWeather, type WeatherData } from '@/utils/weather';

// Open-Meteo — darmowe, bez klucza (2026-11-13). Prognoza + jakość powietrza
// równolegle; brak danych o powietrzu nie blokuje pogody.
const FC = 'https://api.open-meteo.com/v1/forecast';
const AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';

async function getJson(url: string, timeoutMs = 12000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchWeather(lat: number, lon: number, place: string): Promise<WeatherData> {
  const ll = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}`;
  const fcUrl = `${FC}?${ll}&timezone=auto&forecast_days=7&wind_speed_unit=kmh`
    + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,pressure_msl,is_day,uv_index'
    + '&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,cloud_cover'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max';
  const aqUrl = `${AQ}?${ll}&timezone=auto&forecast_days=1&current=european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone`;
  const [fc, aq] = await Promise.all([getJson(fcUrl), getJson(aqUrl).catch(() => null)]);
  return parseWeather(fc, aq, place);
}

export interface CityHit { name: string; region?: string; country?: string; lat: number; lon: number }

export async function searchCity(query: string): Promise<CityHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const j = await getJson(`${GEO}?name=${encodeURIComponent(q)}&count=6&language=pl&format=json`);
  return (j.results ?? []).map((r: any) => ({ name: r.name, region: r.admin1, country: r.country_code, lat: r.latitude, lon: r.longitude }));
}
