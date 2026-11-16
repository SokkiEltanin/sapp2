import { parseWatchBattery, ageLabel, batteryTone, watchName } from '@/utils/deviceBattery';

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
    expect(watchName('SM-R960')).toBe('Galaxy Watch6 Classic');
    expect(watchName('')).toBe('Zegarek');
  });
});
