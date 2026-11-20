import { moodStreak, planMoodReminders } from '@/utils/moodReminder';

const E = (date: string) => ({ date });
const NOW = new Date(2026, 10, 20, 12, 0); // 20.11 12:00

describe('zachęta do humoru', () => {
  it('seria: liczy do dziś albo do wczoraj, gdy dziś brak', () => {
    expect(moodStreak([E('2026-11-18'), E('2026-11-19')], NOW)).toEqual({ days: 2, today: false });
    expect(moodStreak([E('2026-11-19'), E('2026-11-20')], NOW)).toEqual({ days: 2, today: true });
    expect(moodStreak([E('2026-11-17')], NOW)).toEqual({ days: 0, today: false });
  });
  it('plan: pomija dni z wpisem i minione godziny, dziś z serią', () => {
    const cfg = { enabled: true, hour: 21, minute: 0 };
    const p = planMoodReminders([E('2026-11-19'), E('2026-11-21')], NOW, cfg, 4);
    expect(p.map((x) => x.date)).toEqual(['2026-11-20', '2026-11-22', '2026-11-23']);
    expect(p[0].body).toMatch(/Seria 1 dzień/);
    expect(new Date(p[0].fireAt).getHours()).toBe(21);
    // po 21:00 dzisiejszego już nie ma
    expect(planMoodReminders([], new Date(2026, 10, 20, 21, 30), cfg, 2).map((x) => x.date)).toEqual(['2026-11-21']);
    expect(planMoodReminders([], NOW, { ...cfg, enabled: false })).toEqual([]);
  });
});
