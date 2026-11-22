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
