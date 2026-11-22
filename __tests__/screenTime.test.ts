import { avgHours, fromRaw, fmtDur, fmtShort, catOf, byCategory, vsUsual, mergeScreenDays, daysToFetch, dayStarts, ymd, peakHour, nightMinutes, avgBefore, type ScreenDay } from '@/utils/screenTime';

const H = (arr: Record<number, number>) => Array.from({ length: 24 }, (_, i) => arr[i] ?? 0);
const D = (date: string, total: number, hours: number[] = H({}), x: Partial<ScreenDay> = {}): ScreenDay =>
  ({ date, total, unlocks: 10, screenOns: 12, first: '07:00', apps: [], hours, longest: null, t: Date.parse(`${date}T12:00:00`) + 13 * 3600000, ...x });

describe('czas z telefonem', () => {
  it('surowy dzień → minuty, sortowanie appek, pierwsze odblokowanie', () => {
    const s = new Date(2026, 10, 22).getTime();
    const d = fromRaw({
      s, total: 3 * 3600000 + 12 * 60000, unlocks: 54, screenOns: 70, first: new Date(2026, 10, 22, 7, 12).getTime(),
      apps: [{ p: 'a', l: 'A', ms: 60000, n: 3, c: -1 }, { p: 'b', l: '', ms: 40 * 60000, n: 9, c: 4 }, { p: 'z', l: 'Z', ms: 10000, n: 0, c: -1 }],
      hours: [0, 0, 0, 0, 0, 0, 0, 30 * 60000], longest: { p: 'b', l: 'B', ms: 25 * 60000 },
    }, 123);
    expect(d.date).toBe('2026-11-22');
    expect(d.total).toBe(192);
    expect(d.first).toBe('07:12');
    expect(d.apps.map((a) => [a.p, a.l, a.m, a.n])).toEqual([['b', 'b', 40, 9], ['a', 'A', 1, 3]]);
    expect(d.hours[7]).toBe(30);
    expect(d.longest).toEqual({ p: 'b', l: 'B', m: 25 });
  });
  it('formatowanie', () => {
    expect(fmtDur(45)).toBe('45 min');
    expect(fmtDur(120)).toBe('2 h');
    expect(fmtDur(192)).toBe('3 h 12 min');
    expect(fmtShort(192)).toEqual({ big: '3:12', unit: 'h' });
    expect(fmtShort(7)).toEqual({ big: '7', unit: 'min' });
  });
  it('kategorie: znane pakiety przed kategorią z Androida', () => {
    expect(catOf({ p: 'com.whatsapp', c: 4 })).toBe('chat');
    expect(catOf({ p: 'com.zhiliaoapp.musically', c: -1 })).toBe('social');
    expect(catOf({ p: 'com.some.game', c: 0 })).toBe('games');
    expect(catOf({ p: 'com.unknown', c: -1 })).toBe('other');
    expect(byCategory([{ p: 'com.whatsapp', l: '', m: 30, n: 1, c: -1 }, { p: 'org.telegram.messenger', l: '', m: 20, n: 1, c: -1 }, { p: 'com.android.chrome', l: '', m: 40, n: 1, c: -1 }]))
      .toEqual([{ cat: 'chat', m: 50 }, { cat: 'web', m: 40 }]);
  });
  it('porównanie z przeciętnym dniem do tej samej godziny', () => {
    const now = new Date(2026, 10, 22, 12, 30);
    const prev = H({ 8: 30, 10: 30, 12: 20, 20: 100 }); // do 12:30 → 70
    const days = { '2026-11-20': D('2026-11-20', 180, prev), '2026-11-21': D('2026-11-21', 180, prev), '2026-11-22': D('2026-11-22', 105) };
    expect(vsUsual(days, now)).toEqual({ pct: 50, usual: 70 });
    expect(vsUsual({ '2026-11-22': D('2026-11-22', 105) }, now)).toBeNull();
    expect(avgBefore(days, now)).toEqual({ total: 180, unlocks: 10, days: 2 });
  });
  it('scalanie i co pobrać', () => {
    const a = D('2026-11-21', 100, H({}), { t: 1 });
    const b = D('2026-11-21', 120, H({}), { t: 2 });
    expect(mergeScreenDays({ '2026-11-21': b }, [a])['2026-11-21'].total).toBe(120);
    expect(mergeScreenDays({ '2026-11-21': a }, [b])['2026-11-21'].total).toBe(120);
    const now = new Date(2026, 10, 22, 9);
    const starts = dayStarts(now, 3);
    expect(starts.map((s) => ymd(new Date(s)))).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
    // 20.11 pełny, 21.11 odczytany w trakcie dnia → do ponowienia, dziś zawsze
    const days = { '2026-11-20': D('2026-11-20', 1), '2026-11-21': D('2026-11-21', 1, H({}), { t: new Date(2026, 10, 21, 15).getTime() }) };
    expect(daysToFetch(days, now, 3).map((s) => ymd(new Date(s)))).toEqual(['2026-11-21', '2026-11-22']);
    // nowy moduł (v2): dni policzone v1 pobierane ponownie, v2 — nie
    expect(daysToFetch(days, now, 3, 2).map((s) => ymd(new Date(s)))).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
    const v2 = { ...days, '2026-11-20': { ...days['2026-11-20'], v: 2 } };
    expect(daysToFetch(v2, now, 3, 2).map((s) => ymd(new Date(s)))).toEqual(['2026-11-21', '2026-11-22']);
  });
  it('szczyt i noc', () => {
    const d = D('2026-11-22', 0, H({ 1: 15, 3: 5, 21: 40 }));
    expect(peakHour(d)).toEqual({ h: 21, m: 40 });
    expect(nightMinutes(d)).toBe(20);
  });
  it('zwykły rozkład godzin', () => {
    const now = new Date(2026, 10, 22, 9);
    expect(avgHours({}, now)).toBeNull();
    const days = { '2026-11-20': D('2026-11-20', 30, H({ 8: 10, 20: 20 })), '2026-11-21': D('2026-11-21', 30, H({ 8: 30 })), '2026-11-22': D('2026-11-22', 99, H({ 8: 99 })) };
    const a = avgHours(days, now)!;
    expect(a[8]).toBe(20);
    expect(a[20]).toBe(10);
    expect(a[3]).toBe(0);
  });
});
