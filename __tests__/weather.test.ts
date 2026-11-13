import { parseWeather, weatherCodeInfo, aqiInfo, rainSummary, cloudSummary, weatherTip, type WeatherHour } from '@/utils/weather';
import fc from './fixtures/openmeteo-forecast.json';
import aq from './fixtures/openmeteo-air.json';

// Fixture = prawdziwa odpowiedź Open-Meteo (Rzeszów, 13.11.2026 07:30, deszcz).
describe('parseWeather', () => {
  const w = parseWeather(fc, aq, 'Rzeszów', 1);
  test('bieżące warunki', () => {
    expect(w.place).toBe('Rzeszów');
    expect(w.current.temp).toBe(5);
    expect(w.current.feels).toBeCloseTo(-0.1);
    expect(w.current.humidity).toBe(89);
    expect(w.current.code).toBe(61);
  });
  test('godzinowa zaczyna się od bieżącej godziny, 24 h', () => {
    expect(w.hourly[0].time).toBe('2026-11-13T07:00');
    expect(w.hourly).toHaveLength(24);
  });
  test('dzienna 7 dni + powietrze', () => {
    expect(w.daily).toHaveLength(7);
    expect(w.daily[0].date).toBe('2026-11-13');
    expect(w.air?.aqi).toBe(29);
    expect(w.air?.pm25).toBeCloseTo(9.5);
  });
  test('brak danych o powietrzu → air null, bez wyjątku', () => {
    expect(parseWeather(fc, null, 'X').air).toBeNull();
  });
});

describe('etykiety', () => {
  test('kody WMO', () => {
    expect(weatherCodeInfo(0, true)).toEqual({ label: 'Słonecznie', icon: 'Sun' });
    expect(weatherCodeInfo(0, false).icon).toBe('Moon');
    expect(weatherCodeInfo(61).label).toBe('Słaby deszcz');
    expect(weatherCodeInfo(95).icon).toBe('CloudLightning');
  });
  test('EAQI', () => {
    expect(aqiInfo(15).label).toBe('bardzo dobre');
    expect(aqiInfo(29).label).toBe('dobre');
    expect(aqiInfo(75).label).toBe('złe');
  });
});

describe('rainSummary', () => {
  const h = (hour: number, precip: number, pop = 0): WeatherHour => ({ time: `2026-11-13T${String(hour).padStart(2, '0')}:00`, temp: 5, pop, precip, code: 3 });
  test('pada teraz → do kiedy', () => {
    expect(rainSummary([h(7, 1), h(8, 0.5), h(9, 0), h(10, 0)])).toBe('pada do ok. 09:00');
  });
  test('sucho teraz, deszcz później', () => {
    expect(rainSummary([h(7, 0), h(8, 0), h(9, 0, 80)])).toBe('deszcz ok. 09:00');
  });
  test('sucho cały czas', () => {
    expect(rainSummary([h(7, 0), h(8, 0)])).toBe('bez deszczu przez 12 h');
  });
});

describe('cloudSummary', () => {
  const c = (hour: number, cloud?: number): WeatherHour => ({ time: `2026-11-13T${String(hour).padStart(2, '0')}:00`, temp: 5, pop: 0, precip: 0, code: 3, cloud });
  test('brak danych → pusto', () => expect(cloudSummary([c(7), c(8)])).toBe(''));
  test('bezchmurnie', () => expect(cloudSummary([c(7, 10), c(8, 20)])).toBe('bezchmurnie'));
  test('cały dzień', () => expect(cloudSummary([c(7, 90), c(8, 80)])).toBe('pochmurno cały dzień'));
  test('najdłuższy ciąg', () => expect(cloudSummary([c(7, 10), c(8, 80), c(9, 75), c(10, 90), c(11, 20), c(12, 80), c(13, 10)])).toBe('pochmurno 08:00–11:00'));
  test('pojedyncze godziny → zmienne', () => expect(cloudSummary([c(7, 10), c(8, 80), c(9, 20)])).toBe('zmienne zachmurzenie'));
});

describe('weatherTip', () => {
  test('złe powietrze ma pierwszeństwo', () => {
    const w = parseWeather(fc, { current: { european_aqi: 75, pm2_5: 50, pm10: 60 } }, 'X');
    expect(weatherTip(w)).toMatch(/powietrze/);
  });
});
