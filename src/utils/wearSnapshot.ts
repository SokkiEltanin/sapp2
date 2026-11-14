import type { Task } from '@/types/calendar';
import type { Expense } from '@/types/finances';
import { buildWidgetSnapshot } from './widgetTasks';
import { affectsBalance } from './balance';

// Dane dla zegarka Wear OS (2026-11-14, user: "na Wear OS tylko basic rzeczy:
// ostatnie wydatki, dzisiejsze zadania"). Telefon wysyła ten JSON przez Wear Data
// Layer (plugins/withWearSync.js → ścieżka /sapp2/snapshot), aplikacja na zegarku
// (wear/) tylko go wyświetla. Zadania — te same co widget (buildWidgetSnapshot).
export interface WearSnapshot {
  t: number;
  tasks: { id: string; title: string; sub: string; overdue: boolean }[];
  today: number;   // wydatki dziś (zł)
  month: number;   // wydatki w tym miesiącu (zł)
  recent: { label: string; amount: number; date: string }[];
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function buildWearSnapshot(tasks: Task[], expenses: Expense[], now: Date = new Date()): WearSnapshot {
  const today = ymd(now), month = today.slice(0, 7);
  let t = 0, m = 0;
  for (const e of expenses) {
    if (e.type !== 'expense' || !affectsBalance(e) || e.date > today) continue;
    if (e.date.slice(0, 7) === month) { m += e.amount; if (e.date === today) t += e.amount; }
  }
  const recent = [...expenses]
    .filter((e) => e.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, 8)
    .map((e) => ({ label: e.storeName || e.note || (e.type === 'income' ? 'Przychód' : 'Wydatek'), amount: e.type === 'income' ? e.amount : -e.amount, date: e.date }));
  return {
    t: now.getTime(),
    tasks: buildWidgetSnapshot(tasks, now, 10).rows.map((r) => ({ id: r.id, title: r.title, sub: r.sub, overdue: r.overdue })),
    today: Math.round(t * 100) / 100,
    month: Math.round(m * 100) / 100,
    recent,
  };
}
