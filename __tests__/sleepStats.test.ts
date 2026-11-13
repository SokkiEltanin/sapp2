import { sleepSummary, sleepWeek, vsAverage } from '@/utils/sleepStats';
import type { HealthDaySnapshot } from '@/types/health';

const snap = (o: Partial<HealthDaySnapshot>): HealthDaySnapshot => ({
  date: '2026-11-13', steps: null, sleepMinutes: null, sleepDeepMin: null, sleepRemMin: null, sleepLightMin: null,
  sleepAwakeMin: null, sleepFrom: null, sleepTo: null, weightKg: null, restingHeartRate: null, hydrationMl: null, ...o,
});

describe('sleepSummary', () => {
  test('fazy, procenty, normy, wydajność', () => {
    const s = sleepSummary(snap({ sleepMinutes: 480, sleepDeepMin: 60, sleepLightMin: 260, sleepRemMin: 120, sleepAwakeMin: 40 }))!;
    expect(s.asleep).toBe(440);
    expect(s.efficiency).toBe(92);
    const deep = s.phases.find((p) => p.kind === 'deep')!;
    expect(deep.pct).toBe(13);
    expect(deep.status).toBe('ok');
    expect(s.phases.find((p) => p.kind === 'awake')!.status).toBe('ok');
  });
  test('brak faz → hasPhases false, bez wydajności', () => {
    const s = sleepSummary(snap({ sleepMinutes: 400 }))!;
    expect(s.hasPhases).toBe(false);
    expect(s.efficiency).toBeNull();
  });
  test('brak snu → null', () => {
    expect(sleepSummary(snap({}))).toBeNull();
  });
});

describe('sleepWeek', () => {
  const now = new Date(2026, 10, 13, 9);
  const h = {
    '2026-11-11': snap({ date: '2026-11-11', sleepMinutes: 420, sleepFrom: '23:30', sleepTo: '06:30' }),
    '2026-11-12': snap({ date: '2026-11-12', sleepMinutes: 480, sleepFrom: '00:30', sleepTo: '08:30' }),
    '2026-11-13': snap({ date: '2026-11-13', sleepMinutes: 450, sleepFrom: '00:00', sleepTo: '07:30' }),
  };
  test('średnie przez północ, dług snu', () => {
    const w = sleepWeek(h, now);
    expect(w.nights).toHaveLength(7);
    expect(w.count).toBe(3);
    expect(w.avgMinutes).toBe(450);
    expect(w.avgBedtime).toBe('00:00');
    expect(w.avgWake).toBe('07:30');
    expect(w.debtMin).toBe(60 + 0 + 30);
  });
  test('vsAverage', () => {
    expect(vsAverage(450, sleepWeek(h, now))).toBe('jak zwykle');
    expect(vsAverage(540, sleepWeek(h, now))).toBe('+1h 30m vs tydzień');
  });
});
