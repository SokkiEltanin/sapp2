import { wearMoodEntries } from '@/utils/wearMood';

describe('humor z zegarka', () => {
  it('zamienia wiadomości na wpisy, przycina zakres, pomija duble i błędne', () => {
    const out = wearMoodEntries([{ id: 'w_a' } as any], [
      { id: 'a', mood: 3, energy: 3, date: '2026-11-21', t: 1 },            // już jest
      { id: 'b', mood: 6.2, energy: 0.4, date: '2026-11-21', t: Date.UTC(2026, 10, 21, 9) },
      JSON.stringify({ id: 'c', mood: 2.456, energy: 4, date: '2026-11-20', t: 0 }),
      { id: 'b', mood: 2, energy: 2, date: '2026-11-21' },                   // dubel w kolejce
      { id: 'd', mood: 'x', energy: 2, date: '2026-11-21' },
      { id: 'e', mood: 2, energy: 2, date: '21.11.2026' },
      'nie json',
    ]);
    expect(out.map((e) => [e.id, e.date, e.mood, e.energy])).toEqual([
      ['w_b', '2026-11-21', 5, 1], ['w_c', '2026-11-20', 2.46, 4],
    ]);
    expect(out[0].tags).toEqual([]);
    expect(out[0].createdAt).toBe('2026-11-21T09:00:00.000Z');
  });
});
