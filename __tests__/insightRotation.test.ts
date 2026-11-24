import { pickDailyInsight, markSeen, dayNumber } from '@/utils/insightRotation';

describe('wzorzec dnia', () => {
  const ids = ['a', 'b', 'c', 'd'];
  it('nowy ma pierwszeństwo i plakietkę', () => {
    expect(pickDailyInsight(ids, 5, { a: '0000-00-00', b: '0000-00-00', c: '2026-11-24', d: '0000-00-00' }, '2026-11-24')).toEqual({ index: 2, isNew: true });
  });
  it('rotacja po dniach, silniejsze częściej (wagi 3,2,1,1)', () => {
    const seen = { a: 'x', b: 'x', c: 'x', d: 'x' };
    const picks = Array.from({ length: 7 }, (_, d) => pickDailyInsight(ids, d, seen, '2026-11-24').index);
    expect(picks).toEqual([0, 0, 0, 1, 1, 2, 3]);
    expect(pickDailyInsight([], 1, {}, 't')).toEqual({ index: -1, isNew: false });
  });
  it('pierwsze uruchomienie nie robi wysypu nowych; potem nieznane = dziś', () => {
    expect(markSeen(['a', 'b'], {}, '2026-11-24', false)).toEqual({ a: '0000-00-00', b: '0000-00-00' });
    expect(markSeen(['a', 'c'], { a: '0000-00-00' }, '2026-11-24', true)).toEqual({ a: '0000-00-00', c: '2026-11-24' });
    expect(markSeen(['a'], { a: 'x' }, 't', true)).toBeNull();
    expect(dayNumber(new Date(2026, 10, 25)) - dayNumber(new Date(2026, 10, 24))).toBe(1);
  });
});
