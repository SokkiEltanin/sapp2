import { parseWatchBattery, ageLabel, batteryTone } from '@/utils/deviceBattery';

describe('bateria urządzeń', () => {
  test('parsowanie pliku z zegarka', () => {
    expect(parseWatchBattery('{"level":62,"charging":false,"model":"SM-R960","t":1000}')).toEqual({ level: 62, charging: false, model: 'SM-R960', t: 1000 });
    expect(parseWatchBattery('zły')).toBeNull();
    expect(parseWatchBattery('{"level":-1}')).toBeNull();
    expect(parseWatchBattery(null)).toBeNull();
  });
  test('wiek odczytu', () => {
    expect(ageLabel(0, 30_000)).toBe('teraz');
    expect(ageLabel(0, 12 * 60000)).toBe('12 min temu');
    expect(ageLabel(0, 3 * 3600000)).toBe('3 h temu');
  });
  test('kolor i nazwa', () => {
    expect(batteryTone(15, false, 20)).toBe('low');
    expect(batteryTone(30, false, 20)).toBe('mid');
    expect(batteryTone(15, true, 20)).toBe('charge');
  });
});

describe('historia baterii: dopisywanie zamiast zastępowania', () => {
  const { mergeBatLogs } = require('@/utils/deviceBattery');
  const H = 3600000, NOW = Date.UTC(2026, 10, 22, 12);
  it('scala bez dubli, trzyma 30 dni, stare przerzedza do 30 min, zostawia zmiany ładowania', () => {
    const old = [0, 5, 10, 20, 40].map((m) => ({ t: NOW - 3 * 24 * H + m * 60000, l: 80, c: false }));
    const chg = { t: NOW - 3 * 24 * H + 45 * 60000, l: 81, c: true };
    const fresh = [{ t: NOW - H, l: 50, c: false }, { t: NOW - H + 60000, l: 50, c: false }];
    const tooOld = { t: NOW - 40 * 24 * H, l: 10, c: false };
    const out = mergeBatLogs([tooOld, ...old, fresh[0]], [fresh[0], fresh[1], chg], NOW);
    expect(out.find((x: any) => x.t === tooOld.t)).toBeUndefined();
    expect(out.filter((x: any) => x.t === fresh[0].t)).toHaveLength(1);
    expect(out.slice(-2)).toEqual(fresh);
    expect(out.some((x: any) => x.c)).toBe(true);
    expect(out.filter((x: any) => x.t < NOW - 2 * 24 * H).length).toBeLessThan(old.length + 1);
  });
});
