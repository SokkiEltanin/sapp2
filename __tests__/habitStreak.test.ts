import { habitStreak } from '@/utils/habitStreak';
import type { HabitDay } from '@/types/habits';

const d = (date: string, water = false): HabitDay => ({ date, water, sweets: false, training: false });

describe('habitStreak', () => {
  test('brak jakichkolwiek rekordów → 0', () => {
    expect(habitStreak([], 'water', '2026-11-02')).toBe(0);
  });

  test('dziś jawnie false → passa przerwana, 0 (nawet jeśli wczoraj było true)', () => {
    const days = [d('2026-11-01', true), d('2026-11-02', false)];
    expect(habitStreak(days, 'water', '2026-11-02')).toBe(0);
  });

  test('dziś jeszcze nieoznaczone (brak rekordu) → liczy się od wczoraj, nie zeruje passy', () => {
    const days = [d('2026-10-31', true), d('2026-11-01', true)];
    expect(habitStreak(days, 'water', '2026-11-02')).toBe(2);
  });

  test('dziś true → liczy od dziś włącznie', () => {
    const days = [d('2026-11-01', true), d('2026-11-02', true)];
    expect(habitStreak(days, 'water', '2026-11-02')).toBe(2);
  });

  test('przerwa w środku → liczy tylko ciągłą passę wstecz od dziś', () => {
    const days = [
      d('2026-10-30', true),
      d('2026-10-31', false),
      d('2026-11-01', true),
      d('2026-11-02', true),
    ];
    expect(habitStreak(days, 'water', '2026-11-02')).toBe(2);
  });

  test('liczy TYLKO wskazany klucz, nie inne nawyki tego samego dnia', () => {
    const days: HabitDay[] = [{ date: '2026-11-01', water: true, sweets: false, training: true }];
    expect(habitStreak(days, 'water', '2026-11-02')).toBe(1);
    expect(habitStreak(days, 'sweets', '2026-11-02')).toBe(0);
    expect(habitStreak(days, 'training', '2026-11-02')).toBe(1);
  });
});
