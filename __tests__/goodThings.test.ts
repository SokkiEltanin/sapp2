import { goodList, goodStreak, goodMemory, isRoughDay, goodExample, type GoodThing } from '@/utils/goodThings';

const G = (date: string, text = 'x'): GoodThing => ({ id: `g_${date}`, date, text, createdAt: '', updatedAt: '' });

describe('jedna dobra rzecz z dnia', () => {
  it('lista od najnowszej, bez pustych', () => {
    expect(goodList([G('2026-11-20'), G('2026-11-22'), G('2026-11-21', '  ')]).map((g) => g.date)).toEqual(['2026-11-22', '2026-11-20']);
  });
  it('seria liczy do dziś albo do wczoraj', () => {
    const items = [G('2026-11-19'), G('2026-11-20'), G('2026-11-21')];
    expect(goodStreak(items, '2026-11-21')).toBe(3);
    expect(goodStreak(items, '2026-11-22')).toBe(3); // dziś jeszcze nic — seria trwa
    expect(goodStreak(items, '2026-11-23')).toBe(0);
  });
  it('wspomnienie: tylko starsze niż 3 dni, stałe w ciągu dnia', () => {
    const items = [G('2026-11-10', 'a'), G('2026-11-15', 'b'), G('2026-11-21', 'c')];
    const m = goodMemory(items, '2026-11-22');
    expect(['a', 'b']).toContain(m!.text);
    expect(goodMemory(items, '2026-11-22')).toBe(m);
    expect(goodMemory([G('2026-11-21')], '2026-11-22')).toBeNull();
  });
  it('gorszy dzień i przykłady', () => {
    expect(isRoughDay([{ date: '2026-11-22', mood: 2 }, { date: '2026-11-22', mood: 3 }], '2026-11-22')).toBe(true);
    expect(isRoughDay([{ date: '2026-11-22', mood: 4 }], '2026-11-22')).toBe(false);
    expect(isRoughDay([], '2026-11-22')).toBe(false);
    expect(typeof goodExample('2026-11-22')).toBe('string');
  });
});
