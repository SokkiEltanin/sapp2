import { buildDays, computeInsights, coverage, fmtVal } from '@/utils/insights';

const days = Array.from({ length: 20 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);

describe('wzorce zachowań', () => {
  it('praca → więcej słodyczy (silny), zdanie po polsku', () => {
    const byDay = new Map<string, any>();
    const work = new Map<string, number>();
    days.forEach((d, i) => {
      const workday = i % 2 === 0;
      if (workday) work.set(d, 8 * 60);
      byDay.set(d, { total: 50, sweets: workday ? 14 + (i % 3) : 3 + (i % 2), fastfood: 0, shop: 0 });
    });
    const f = buildDays({ days, spend: { from: days[0], byDay }, workMin: { from: days[0], byDay: work } });
    const ins = computeInsights(f);
    const w = ins.find((x) => x.id === 'work-sweets')!;
    expect(w).toBeDefined();
    expect(w.strength).toBe('silny');
    expect(w.tone).toBe('bad');
    expect(w.hi.n).toBe(10);
    expect(w.text).toMatch(/^W dni pracy na słodycze i przekąski idzie średnio 15 zł, w dni wolne 4 zł — 3,8× więcej\.$/);
    expect(ins.find((x) => x.id === 'work-shop')).toBeUndefined(); // brak różnicy
  });
  it('sen dzień później (lag) i za mało danych = brak wzorca', () => {
    const screen: Record<string, any> = {};
    const health: Record<string, [number | null, number | null]> = {};
    days.forEach((d, i) => {
      const heavy = i % 2 === 1;
      screen[d] = { total: 200, fun: heavy ? 150 : 20, unlocks: 50, night: 0 };
      // sen NASTĘPNEJ nocy (zapisany pod kolejną datą) krótszy po dniu z dużą rozrywką
      if (days[i + 1]) health[days[i + 1]] = [6000, heavy ? 330 + i : 470 - i];
    });
    const ins = computeInsights(buildDays({ days, screen, health }));
    const s = ins.find((x) => x.id === 'fun-sleep')!;
    expect(s.hi.mean).toBeLessThan(s.lo.mean);
    expect(s.tone).toBe('bad');
    expect(computeInsights(buildDays({ days: days.slice(0, 5), screen, health }))).toEqual([]);
  });
  it('pokrycie i formatowanie', () => {
    const f = buildDays({ days, mood: new Map([[days[0], { mood: 3, energy: 4 }]]) });
    expect(coverage(f).humor).toBe(1);
    expect(fmtVal(95, 'min')).toBe('1 h 35 min');
    expect(fmtVal(3.46, 'pkt')).toBe('3,5/5');
  });
});

describe('wzorce: statystyka', () => {
  const { welchP, bhPass, computeInsights, buildDays } = require('@/utils/insights');
  it('p Welcha: wyraźna różnica → małe p, szum → duże p', () => {
    expect(welchP([10, 11, 12, 10, 11, 12], [3, 4, 3, 5, 4, 3])).toBeLessThan(0.001);
    expect(welchP([5, 7, 4, 6, 8, 5], [6, 5, 7, 4, 6, 7])).toBeGreaterThan(0.3);
  });
  it('korekta BH przepuszcza tylko to, co wytrzymuje wiele porównań', () => {
    expect(bhPass([0.001, 0.04, 0.5, 0.8], 0.1)).toEqual([true, true, false, false]);
    expect(bhPass([0.09, 0.5, 0.6, 0.7], 0.1)).toEqual([false, false, false, false]);
  });
  it('przypadkowe dane (mała próbka, szum) nie dają wzorców', () => {
    const ds = Array.from({ length: 20 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const byDay = new Map(); const work = new Map();
    ds.forEach((d) => { if (rnd() > 0.5) work.set(d, 480); byDay.set(d, { total: 50, sweets: Math.round(rnd() * 20), fastfood: 0, shop: 0 }); });
    expect(computeInsights(buildDays({ days: ds, spend: { from: ds[0], byDay }, workMin: { from: ds[0], byDay: work } }))).toEqual([]);
  });
});

describe('wzorce: rozbicie dni pracy', () => {
  const ds = Array.from({ length: 28 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  it('długa vs krótka zmiana — tylko między dniami pracy', () => {
    const work = new Map<string, number>(); const byDay = new Map<string, any>();
    ds.forEach((d, i) => {
      const kind = i % 3; // 0 = długa 11 h, 1 = krótka 8 h, 2 = wolne
      if (kind === 0) work.set(d, 11 * 60);
      if (kind === 1) work.set(d, 8 * 60);
      byDay.set(d, { total: 40, sweets: kind === 0 ? 18 + (i % 4) : kind === 1 ? 4 + (i % 3) : 5 + (i % 2), fastfood: 0, shop: 0 });
    });
    const f = buildDays({ days: ds, spend: { from: ds[0], byDay }, workMin: { from: ds[0], byDay: work } });
    expect(f[2].v.shiftLen).toBeUndefined(); // wolne nie wchodzą
    const x = computeInsights(f).find((i) => i.id === 'shiftLen-sweets')!;
    expect(x).toBeDefined();
    expect(x.group).toBe('praca');
    expect(x.hi.n + x.lo.n).toBe(19); // 10 długich + 9 krótkich
    expect(x.text).toMatch(/^Na długiej zmianie \(10 h\+\) na słodycze i przekąski idzie średnio \d+ zł, na krótszej \(do 8,5 h\) \d+ zł/);
  });
  it('dzień po pracy: własne etykiety i sen następnej nocy', () => {
    const work = new Map<string, number>(); const health: Record<string, [number | null, number | null]> = {};
    ds.forEach((d, i) => {
      const w = i % 2 === 0;
      if (w) work.set(d, 9 * 60);
      if (ds[i + 1]) health[ds[i + 1]] = [6000, w ? 340 + (i % 5) : 460 - (i % 5)];
    });
    const x = computeInsights(buildDays({ days: ds, health, workMin: { from: ds[0], byDay: work } })).find((i) => i.id === 'work-sleep-next')!;
    expect(x.text).toMatch(/^Po dniu pracy śpisz średnio .*, po dniu wolnym /);
    expect(x.hi.label).toBe('Po dniu pracy');
    expect(x.tone).toBe('bad');
  });
  it('godziny zmiany z tytułu (rano / popołudnie / do późna)', () => {
    const { shiftSpan } = require('@/utils/workEvents');
    expect(shiftSpan({ title: '[JD] 14:00 - 22:30' })).toEqual({ start: 840, end: 1350 });
    expect(shiftSpan({ title: 'Praca', startTime: '22:00', endTime: '06:00' })).toEqual({ start: 1320, end: 1800 });
    expect(shiftSpan({ title: 'Praca (11h)' })).toBeNull();
    const f = buildDays({ days: ds.slice(0, 1), workMin: { from: ds[0], byDay: new Map([[ds[0], 510]]) }, workShift: new Map([[ds[0], { start: 840, end: 1350 }]]) });
    expect(f[0].v).toMatchObject({ shiftStart: 840, shiftEnd: 1350, shiftLen: 8.5 });
  });
});
