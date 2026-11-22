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
