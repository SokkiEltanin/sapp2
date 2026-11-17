import type { Expense } from '@/types/finances';
import type { Task } from '@/types/calendar';
import { fvSplitOf, isOwnTransfer } from './fixedVariable';
import { foodSplitOf } from './foodStats';
import { round2 } from './money';
import type { HealthLog, MonthCard } from './monthCards';

// Rekordy (2026-11-17, user: "rekordy z danych, które się zapisują — ale żeby można było
// je potwierdzić / edytować, bo niektórych nie ma w danych, a pamiętam 43k kroków w jeden
// dzień"). Liczone z danych; ręczny wpis wygrywa, dopóki dane go nie pobiją.
export type RecordKey = 'steps' | 'sleep' | 'bigExpense' | 'daySpend' | 'cheapMonth' | 'saveMonth' | 'income' | 'noSweets' | 'tasksDay';
export interface RecordDef { key: RecordKey; label: string; unit: string; better: 'max' | 'min'; money?: boolean }
export interface Rec { value: number; date: string; note?: string }

export const RECORD_DEFS: RecordDef[] = [
  { key: 'steps', label: 'Najwięcej kroków w dzień', unit: 'kroków', better: 'max' },
  { key: 'sleep', label: 'Najdłuższy sen', unit: 'min', better: 'max' },
  { key: 'tasksDay', label: 'Najwięcej zadań w dzień', unit: 'zadań', better: 'max' },
  { key: 'noSweets', label: 'Najdłużej bez słodyczy', unit: 'dni', better: 'max' },
  { key: 'saveMonth', label: 'Najwięcej odłożone w miesiąc', unit: 'zł', better: 'max', money: true },
  { key: 'cheapMonth', label: 'Najtańszy miesiąc', unit: 'zł', better: 'min', money: true },
  { key: 'income', label: 'Największy wpływ', unit: 'zł', better: 'max', money: true },
  { key: 'bigExpense', label: 'Największy pojedynczy wydatek', unit: 'zł', better: 'max', money: true },
  { key: 'daySpend', label: 'Najdroższy dzień', unit: 'zł', better: 'max', money: true },
];

const DAY = 86400000;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function computeRecords(expenses: Expense[], log: HealthLog, tasks: Task[], cards: MonthCard[], now: Date = new Date()): Partial<Record<RecordKey, Rec>> {
  const out: Partial<Record<RecordKey, Rec>> = {};
  const better = (k: RecordKey, value: number, date: string, note?: string) => {
    const def = RECORD_DEFS.find((d) => d.key === k)!;
    const cur = out[k];
    if (!cur || (def.better === 'max' ? value > cur.value : value < cur.value)) out[k] = { value, date, note };
  };

  for (const [d, [steps, sleep]] of Object.entries(log)) {
    if (steps && steps > 0) better('steps', steps, d);
    if (sleep && sleep > 0) better('sleep', sleep, d);
  }

  const byDay = new Map<string, number>();
  const sweetDays = new Set<string>();
  let first: string | null = null;
  for (const e of expenses) {
    if (isOwnTransfer(e)) continue;
    const d = (e.date ?? '').slice(0, 10);
    if (!d) continue;
    if (e.type === 'income') { if (e.amount > 0) better('income', round2(e.amount), d, e.storeName || e.note || undefined); continue; }
    const s = fvSplitOf(e); const amt = s.fixed + s.food + s.variable;
    if (amt <= 0) continue;
    if (!first || d < first) first = d;
    better('bigExpense', round2(amt), d, e.storeName || e.note || undefined);
    // Najdroższy dzień bez stałych opłat (czynsz zawyżałby każdy 10. dzień miesiąca).
    if (s.food + s.variable > 0) byDay.set(d, (byDay.get(d) ?? 0) + s.food + s.variable);
    if ((foodSplitOf(e).get('słodycze') ?? 0) > 0) sweetDays.add(d);
  }
  for (const [d, v] of byDay) better('daySpend', round2(v), d);

  // Najdłuższa przerwa między zakupami słodyczy (do dziś włącznie).
  if (sweetDays.size) {
    const days = [...sweetDays].sort();
    const today = ymd(now);
    let prev = days[0];
    for (const d of [...days.slice(1), today]) {
      const gap = Math.round((Date.parse(`${d}T12:00:00`) - Date.parse(`${prev}T12:00:00`)) / DAY) - 1;
      // data = dzień, w którym seria się skończyła (albo dziś, gdy trwa)
      if (gap > 0) better('noSweets', gap, d, d === today ? 'trwa' : undefined);
      prev = d;
    }
  }

  for (const c of cards) {
    if (c.spent > 0) better('cheapMonth', c.spent, c.key);
    if (c.income > 0) better('saveMonth', c.balance, c.key);
  }

  const doneBy = new Map<string, number>();
  for (const t of tasks) if (t.status === 'done' && t.completedAt) { const d = t.completedAt.slice(0, 10); doneBy.set(d, (doneBy.get(d) ?? 0) + 1); }
  for (const [d, n] of doneBy) better('tasksDay', n, d);
  return out;
}

/** Wynik do pokazania: ręczny wpis albo dane — lepszy z dwóch. */
export function bestRecord(def: RecordDef, data?: Rec, manual?: Rec): { rec: Rec; source: 'data' | 'manual' } | null {
  if (!data && !manual) return null;
  if (!data) return { rec: manual!, source: 'manual' };
  if (!manual) return { rec: data, source: 'data' };
  const dataWins = def.better === 'max' ? data.value > manual.value : data.value < manual.value;
  return dataWins ? { rec: data, source: 'data' } : { rec: manual, source: 'manual' };
}

export const recordSig = (r: Rec) => `${r.value}|${r.date}`;
