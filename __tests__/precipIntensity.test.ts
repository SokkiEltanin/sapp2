import { precipIntensity, precipRate } from '../src/utils/weather';

describe('natężenie opadu do animacji', () => {
  it('rośnie z mm/h (skala log), 0..1', () => {
    const a = precipIntensity('rain', 0.2), b = precipIntensity('rain', 1), c = precipIntensity('rain', 4), d = precipIntensity('rain', 30);
    expect(a).toBeLessThan(b); expect(b).toBeLessThan(c); expect(c).toBeLessThan(d);
    expect(b).toBeCloseTo(0.45, 2);
    expect(d).toBe(1);
  });
  it('bez danych — typowe dla rodzaju; ulewa nigdy słabsza niż 0,6', () => {
    expect(precipIntensity('drizzle', 0)).toBe(0.2);
    expect(precipIntensity('heavy', 0.1)).toBe(0.6);
    expect(precipIntensity('sun', 0)).toBe(0);
  });
  it('mm/h = większe z bieżącej i prognozy na tę godzinę', () => {
    expect(precipRate({ current: { precip: 0 } as never, hourly: [{ precip: 2.5 } as never] })).toBe(2.5);
    expect(precipRate({ current: { precip: 3 } as never, hourly: [] })).toBe(3);
  });
});
