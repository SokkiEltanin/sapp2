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
// `ids` / `detail` (2026-11-18, user: "jeśli nie nadpisuję, musi pisać datę i konkretny event,
// kiedy to wyłapało — żebym mógł zobaczyć i edytować"): skąd rekord z danych. ids = transakcje.
export interface Rec { value: number; date: string; note?: string; ids?: string[]; detail?: string }

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
  const better = (k: RecordKey, value: number, date: string, note?: string, extra?: { ids?: string[]; detail?: string }) => {
    const def = RECORD_DEFS.find((d) => d.key === k)!;
    const cur = out[k];
    if (!cur || (def.better === 'max' ? value > cur.value : value < cur.value)) {
      const r: Rec = { value, date };
      if (note) r.note = note;
      if (extra?.ids?.length) r.ids = extra.ids;
      if (extra?.detail) r.detail = extra.detail;
      out[k] = r;
    }
  };
  const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

  for (const [d, [steps, sleep]] of Object.entries(log)) {
    if (steps && steps > 0) better('steps', steps, d, undefined, { detail: 'kroki z zegarka (Health Connect)' });
    if (sleep && sleep > 0) better('sleep', sleep, d, undefined, { detail: 'sen z zegarka (Health Connect), noc kończąca się tego dnia' });
  }

  const byDay = new Map<string, { v: number; ids: string[] }>();
  const sweetDays = new Map<string, string[]>();
  let first: string | null = null;
  for (const e of expenses) {
    if (isOwnTransfer(e)) continue;
    const d = (e.date ?? '').slice(0, 10);
    if (!d) continue;
    const name = e.storeName || e.note || undefined;
    if (e.type === 'income') { if (e.amount > 0) better('income', round2(e.amount), d, name, { ids: [e.id] }); continue; }
    const s = fvSplitOf(e);
    if (s.fixed + s.food + s.variable <= 0) continue;
    if (!first || d < first) first = d;
    // Bez stałych opłat (2026-11-18): czynsz wygrywałby zawsze — rekord ma mówić o zakupach.
    const own = s.food + s.variable;
    if (own > 0) {
      better('bigExpense', round2(own), d, name, { ids: [e.id] });
      const day = byDay.get(d) ?? { v: 0, ids: [] };
      day.v += own; day.ids.push(e.id); byDay.set(d, day);
    }
    if ((foodSplitOf(e).get('słodycze') ?? 0) > 0) sweetDays.set(d, [...(sweetDays.get(d) ?? []), e.id]);
  }
  for (const [d, day] of byDay) better('daySpend', round2(day.v), d, `${day.ids.length} ${day.ids.length === 1 ? 'transakcja' : day.ids.length < 5 ? 'transakcje' : 'transakcji'}`, { ids: day.ids, detail: 'suma zakupów dnia, bez stałych opłat' });

  // Najdłuższa przerwa między zakupami słodyczy (do dziś włącznie).
  if (sweetDays.size) {
    const days = [...sweetDays.keys()].sort();
    const today = ymd(now);
    let prev = days[0];
    for (const d of [...days.slice(1), today]) {
      const gap = Math.round((Date.parse(`${d}T12:00:00`) - Date.parse(`${prev}T12:00:00`)) / DAY) - 1;
      // data = dzień, w którym seria się skończyła (albo dziś, gdy trwa); ids = zakupy słodyczy
      // na początku i końcu przerwy
      if (gap > 0) better('noSweets', gap, d, d === today ? 'trwa' : undefined, {
        ids: [...(sweetDays.get(prev) ?? []), ...(sweetDays.get(d) ?? [])],
        detail: d === today ? `od ostatnich słodyczy ${dmy(prev)} do dziś` : `przerwa od ${dmy(prev)} do ${dmy(d)} (zakupy słodyczy poniżej)`,
      });
      prev = d;
    }
  }

  for (const c of cards) {
    const detail = `wydatki ${c.spent.toFixed(2).replace('.', ',')} zł · wpływy ${c.income.toFixed(2).replace('.', ',')} zł`;
    if (c.spent > 0) better('cheapMonth', c.spent, c.key, undefined, { detail });
    if (c.income > 0) better('saveMonth', c.balance, c.key, undefined, { detail });
  }

  const doneBy = new Map<string, string[]>();
  for (const t of tasks) if (t.status === 'done' && t.completedAt) { const d = t.completedAt.slice(0, 10); doneBy.set(d, [...(doneBy.get(d) ?? []), t.title]); }
  for (const [d, titles] of doneBy) better('tasksDay', titles.length, d, undefined, { detail: titles.slice(0, 4).join(', ') + (titles.length > 4 ? ` +${titles.length - 4}` : '') });
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
