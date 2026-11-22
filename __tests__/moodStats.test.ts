import { dailyMood, moodSummary, weekdayMood, yearPixels, moodLinks, tagMood, lastDays } from '@/utils/moodStats';

const E = (date: string, mood: number, energy = 3, tags: string[] = []) => ({ id: date + mood, date, mood, energy, tags, createdAt: '', updatedAt: '' });
const X = (date: string, amount: number, extra: any = {}) => ({ id: date + amount, type: 'expense', amount, date, note: '', tags: [], source: 'manual', createdAt: date, updatedAt: date, ...extra }) as any;

describe('humor — statystyki', () => {
  it('dzień = średnia z wpisów', () => {
    const d = dailyMood([E('2026-11-01', 2, 1), E('2026-11-01', 4, 5)]);
    expect(d.get('2026-11-01')).toMatchObject({ mood: 3, energy: 3, n: 2 });
  });
  it('średnia 30 dni i zmiana vs poprzednie 30', () => {
    const now = new Date(2026, 10, 30);
    const entries = [
      ...[1, 2, 3, 4].map((i) => E(`2026-11-${String(i + 10).padStart(2, '0')}`, 4)),
      ...[1, 2, 3].map((i) => E(`2026-10-${String(i + 10).padStart(2, '0')}`, 2)),
    ];
    const s = moodSummary(dailyMood(entries), 30, now);
    expect(s.avg).toBe(4);
    expect(s.days).toBe(4);
    expect(s.prevAvg).toBe(2);
    expect(s.delta).toBe(2);
  });
  it('lastDays: od najstarszego, dziś na końcu', () => {
    const l = lastDays(dailyMood([E('2026-11-18', 5)]), 3, new Date(2026, 10, 18));
    expect(l.map((x) => x.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
    expect(l[2].d?.mood).toBe(5);
  });
  it('dni tygodnia od poniedziałku', () => {
    const w = weekdayMood(dailyMood([E('2026-11-16', 5), E('2026-11-22', 1)])); // pn, nd
    expect(w[0]).toMatchObject({ label: 'pn', avg: 5 });
    expect(w[6]).toMatchObject({ label: 'nd', avg: 1 });
  });
  it('rok w pikselach: 12 miesięcy, dni miesiąca', () => {
    const p = yearPixels(dailyMood([E('2026-02-28', 4)]), 2026);
    expect(p).toHaveLength(12);
    expect(p[1]).toHaveLength(28);
    expect(p[1][27]).toBe(4);
    expect(p[0][0]).toBeNull();
  });
  it('zależności: słodycze i dni bez wydatków, tylko z ≥3 dniami po obu stronach', () => {
    const entries: any[] = []; const ex: any[] = [];
    for (let i = 1; i <= 8; i++) {
      const d = `2026-11-${String(i).padStart(2, '0')}`;
      const sweet = i <= 4;
      entries.push(E(d, sweet ? 2 : 4));
      if (sweet) ex.push(X(d, 30, { receiptItems: [{ name: 'Czekolada', price: 30, quantity: 1, unitPrice: 30, foodSubcat: 'słodycze' }] }));
    }
    const links = moodLinks(dailyMood(entries), ex, {});
    const sw = links.find((l) => l.key === 'sweets')!;
    expect(sw).toMatchObject({ a: 2, b: 4, na: 4, nb: 4, diff: -2 });
    expect(links.find((l) => l.key === 'nospend')!.diff).toBe(2);
    expect(links.find((l) => l.key === 'sleep')).toBeUndefined(); // brak danych snu
  });
  it('zależność od czasu z telefonem: próg = mediana (do 30 min)', () => {
    const entries: any[] = []; const screen: Record<string, { total: number }> = {};
    for (let i = 1; i <= 8; i++) {
      const d = `2026-11-${String(i).padStart(2, '0')}`;
      const heavy = i <= 4;
      entries.push(E(d, heavy ? 2 : 4));
      screen[d] = { total: heavy ? 300 : 120 };
    }
    const l = moodLinks(dailyMood(entries), [], {}, screen).find((x) => x.key === 'screen')!;
    expect(l.label).toBe('Ponad 3,5 h z telefonem');
    expect(l).toMatchObject({ a: 2, b: 4, na: 4, nb: 4 });
    expect(moodLinks(dailyMood(entries), [], {}).find((x) => x.key === 'screen')).toBeUndefined();
  });
  it('zależność od dobrej rzeczy dnia — tylko dni od pierwszego wpisu', () => {
    const entries: any[] = []; const good = new Set<string>();
    for (let i = 1; i <= 10; i++) {
      const d = `2026-11-${String(i).padStart(2, '0')}`;
      entries.push(E(d, i <= 2 ? 1 : i % 2 ? 4 : 3));
      if (i >= 3 && i % 2) good.add(d);
    }
    const l = moodLinks(dailyMood(entries), [], {}, {}, good).find((x) => x.key === 'good')!;
    expect(l).toMatchObject({ a: 4, b: 3, na: 4, nb: 4 }); // dni 1–2 (przed pierwszym wpisem) pominięte
  });
  it('tagi: min 3 użycia, od najlepszego', () => {
    const t = tagMood([E('a', 5, 3, ['spokojny']), E('b', 5, 3, ['spokojny']), E('c', 4, 3, ['spokojny']), E('d', 1, 3, ['zmęczony'])]);
    expect(t).toEqual([{ tag: 'spokojny', avg: 14 / 3, n: 3 }]);
  });
});
