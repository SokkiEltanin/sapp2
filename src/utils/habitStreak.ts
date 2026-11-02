import { ymd } from '@/utils/date';
import type { HabitDay, HabitKey } from '@/types/habits';

// Passa = kolejne dni wstecz, w których `key` === true, przerywana pierwszym
// dniem `false`/brakiem rekordu. "Dziś" jest specjalny: brak rekordu (user
// jeszcze nie zaznaczył) NIE przerywa wczorajszej passy — liczenie zaczyna się
// wtedy od wczoraj, żeby poranny check-in nie zerował passy z dnia na dzień do
// czasu aż user faktycznie zaznaczy. Jeśli dziś jest JAWNIE `false` — passa
// jest przerwana, 0.
export function habitStreak(days: HabitDay[], key: HabitKey, todayISO: string): number {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const todayRecord = byDate.get(todayISO);
  if (todayRecord && todayRecord[key] === false) return 0;

  let streak = 0;
  const cursor = new Date(`${todayISO}T00:00:00`);
  if (!todayRecord || todayRecord[key] !== true) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (;;) {
    const rec = byDate.get(ymd(cursor));
    if (!rec || rec[key] !== true) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
