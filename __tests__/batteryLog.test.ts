import { parseBatteryLog, analyzeBattery, tempTone } from '@/utils/deviceBattery';

const H = 3600000;
describe('historia baterii', () => {
  it('parsuje i sortuje, odrzuca śmieci', () => {
    const l = parseBatteryLog(JSON.stringify([{ t: 2, l: 50, c: false, tp: 31.2 }, { t: 1, l: 60, c: true }, { t: 'x', l: 5 }, { t: 3, l: 150 }]));
    expect(l).toEqual([{ t: 1, l: 60, c: true }, { t: 2, l: 50, c: false, tp: 31.2 }]);
  });
  it('ostatnie ładowanie, zużycie %/h i ile zostało', () => {
    const now = 10 * H;
    const s = [
      { t: 0, l: 40, c: true }, { t: 1 * H, l: 100, c: true },
      { t: 2 * H, l: 98, c: false, tp: 30 }, { t: 6 * H, l: 78, c: false, tp: 33 }, { t: 10 * H, l: 58, c: false, tp: 44 },
    ];
    const a = analyzeBattery(s, now);
    expect(a.chargedAt).toBe(1 * H);
    expect(a.chargedTo).toBe(100);
    expect(a.drainPerHour).toBe(4.7); // 100→58 w 9 h
    expect(a.hoursLeft).toBe(12.3);
    expect(a.tempNow).toBe(44);
    expect(a.tempMax24h).toBe(44);
    expect(tempTone(44)).toBe('hot');
  });
  it('ładuje teraz → od kiedy', () => {
    const a = analyzeBattery([{ t: 0, l: 30, c: false }, { t: H, l: 35, c: true }, { t: 2 * H, l: 60, c: true }], 2 * H);
    expect(a.chargingSince).toBe(H);
    expect(a.drainPerHour).toBeNull();
  });
});
