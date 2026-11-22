import { smoothPath, uvLabel, dayLength, humidityLabel } from '../src/utils/weather';

describe('panel pogody', () => {
  test('krzywa', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([[0, 10]])).toBe('M0 10');
    const d = smoothPath([[0, 10], [10, 0], [20, 10]]);
    expect(d.startsWith('M0 10C')).toBe(true);
    expect((d.match(/C/g) ?? []).length).toBe(2);
    expect(d.endsWith('20 10')).toBe(true);
  });
  test('opisy', () => {
    expect(uvLabel(1)).toBe('niski');
    expect(uvLabel(6.5)).toBe('wysoki');
    expect(dayLength('2026-11-22T07:16', '2026-11-22T15:49')).toBe('8 h 33 min');
    expect(dayLength('2026-11-22T07:00', '2026-11-22T16:00')).toBe('9 h');
    expect(dayLength('x', 'y')).toBe('');
    expect(humidityLabel(81)).toBe('bardzo wilgotno');
    expect(humidityLabel(45)).toBe('komfortowo');
  });
});

import { aqiAdvice, worstPollutant } from '../src/utils/weather';
describe('powietrze', () => {
  test('rada i najgorszy składnik', () => {
    expect(aqiAdvice(30)).toMatch(/wietrzyć/);
    expect(aqiAdvice(95)).toMatch(/Zamknij/);
    expect(worstPollutant({ aqi: 38, pm25: 12, pm10: 21, no2: 18, o3: 40 })).toEqual({ label: 'PM2,5', pct: 80 });
    expect(worstPollutant({ aqi: 50, pm25: 5, pm10: 90, no2: null, o3: null })).toEqual({ label: 'PM10', pct: 200 });
  });
});
