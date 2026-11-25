import { cleanMoodEntries, cleanMoodEntry } from '../src/utils/moodClean';
import type { MoodEntry } from '../src/types/mood';

const e = (p: Partial<MoodEntry>): MoodEntry => ({ id: 'a', date: '2026-11-25', mood: 4, energy: 3, tags: [], createdAt: '', updatedAt: '', ...p });

describe('cleanMoodEntries', () => {
  it('dobre wpisy zostają bez zmian (ta sama lista)', () => {
    const list = [e({}), e({ id: 'b', mood: 2.5, energy: 4.2 })];
    expect(cleanMoodEntries(list)).toBe(list);
  });
  it('brak energii → 3, tekst → liczba, poza zakresem → przycięte', () => {
    expect(cleanMoodEntry(e({ energy: undefined as unknown as number }))?.energy).toBe(3);
    expect(cleanMoodEntry(e({ mood: '5' as unknown as number }))?.mood).toBe(5);
    expect(cleanMoodEntry(e({ mood: 9, energy: 0 }))).toMatchObject({ mood: 5, energy: 1 });
    expect(cleanMoodEntry(e({ tags: undefined as unknown as string[] }))?.tags).toEqual([]);
  });
  it('bez nastroju albo bez daty → wpis odpada', () => {
    const out = cleanMoodEntries([e({ id: 'x', mood: NaN }), e({ id: 'y', date: 'wczoraj' }), e({ id: 'z' })]);
    expect(out.map((x) => x.id)).toEqual(['z']);
  });
});
