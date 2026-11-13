import type { ReplaceItem, ReplaceUnit } from '@/types/replacements';
import type { Expense } from '@/types/finances';
import type { Vehicle } from '@/types/vehicles';
import { addMonthsClipped, ymdLocal } from './dateMath';

// Logika wymian domowych (2026-11-13) — czyste funkcje, testy w
// __tests__/replacements.test.ts.

export interface ReplacePreset {
  key: string; name: string; every: number; unit: ReplaceUnit; icon: string; keywords: string[];
}

// Typowe interwały wg zaleceń producentów (zaokrąglone, do zmiany w formularzu).
export const REPLACE_PRESETS: ReplacePreset[] = [
  { key: 'jug', name: 'Filtr w dzbanku', every: 1, unit: 'm', icon: 'GlassWater', keywords: ['dafi', 'brita', 'aquaphor', 'maxtra', 'unimax', 'wklad filtr', 'filtr do dzbanka', 'filtr wody'] },
  { key: 'air', name: 'Filtr oczyszczacza', every: 6, unit: 'm', icon: 'Wind', keywords: ['hepa', 'oczyszczacz', 'filtr powietrza'] },
  { key: 'brushHead', name: 'Końcówki szczoteczki', every: 3, unit: 'm', icon: 'Toothbrush', keywords: ['koncowk', 'oral-b', 'oral b', 'sonicare', 'glowki do szczoteczki', 'glowka szczoteczki'] },
  { key: 'toothbrush', name: 'Szczoteczka do zębów', every: 3, unit: 'm', icon: 'Toothbrush', keywords: ['szczoteczka do zebow', 'szczoteczka'] },
  { key: 'razor', name: 'Ostrza maszynki', every: 1, unit: 'm', icon: 'Scissors', keywords: ['gillette', 'wilkinson', 'ostrz', 'wklady do maszynki', 'maszynk'] },
  { key: 'sponge', name: 'Gąbka do naczyń', every: 2, unit: 'w', icon: 'Square', keywords: ['gabk', 'zmywak'] },
  { key: 'hood', name: 'Filtr okapu', every: 3, unit: 'm', icon: 'Fan', keywords: ['filtr do okapu', 'filtr okapu', 'okap'] },
  { key: 'fridge', name: 'Filtr wody w lodówce', every: 6, unit: 'm', icon: 'Refrigerator', keywords: ['filtr do lodowki', 'filtr lodowki'] },
  { key: 'vacuum', name: 'Filtr odkurzacza', every: 6, unit: 'm', icon: 'Wind', keywords: ['filtr do odkurzacza', 'worki do odkurzacza', 'odkurzacz'] },
  { key: 'ac', name: 'Filtr klimatyzacji', every: 6, unit: 'm', icon: 'Snowflake', keywords: ['filtr klimatyzacji'] },
  { key: 'smoke', name: 'Bateria czujnika dymu', every: 12, unit: 'm', icon: 'BatteryLow', keywords: ['bateria 9v', '9v'] },
  { key: 'pillow', name: 'Poduszka', every: 24, unit: 'm', icon: 'BedDouble', keywords: ['poduszka'] },
];

export const presetByKey = (k?: string) => REPLACE_PRESETS.find((p) => p.key === k);
export const UNIT_LABEL: Record<ReplaceUnit, [string, string, string]> = {
  d: ['dzień', 'dni', 'dni'], w: ['tydzień', 'tygodnie', 'tygodni'], m: ['miesiąc', 'miesiące', 'miesięcy'],
};

function plForm(n: number, forms: [string, string, string]): string {
  if (n === 1) return forms[0];
  const t = n % 10, h = n % 100;
  if (t >= 2 && t <= 4 && !(h >= 12 && h <= 14)) return forms[1];
  return forms[2];
}

// "co 3 miesiące", "co 2 tygodnie", "co miesiąc"
export function everyLabel(every: number, unit: ReplaceUnit): string {
  if (every === 1) return `co ${UNIT_LABEL[unit][0]}`;
  return `co ${every} ${plForm(every, UNIT_LABEL[unit])}`;
}

// Krótko: "3 mies.", "2 tyg.", "10 dni".
export function shortEvery(every: number, unit: ReplaceUnit): string {
  return `${every} ${unit === 'm' ? 'mies.' : unit === 'w' ? 'tyg.' : every === 1 ? 'dzień' : 'dni'}`;
}

const parse = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d); };
const dayDiff = (a: Date, b: Date) => Math.round((new Date(a).setHours(0, 0, 0, 0) - new Date(b).setHours(0, 0, 0, 0)) / 86400000);

export function addInterval(fromYmd: string, every: number, unit: ReplaceUnit): string {
  const d = parse(fromYmd);
  if (unit === 'm') return ymdLocal(addMonthsClipped(d, every));
  d.setDate(d.getDate() + every * (unit === 'w' ? 7 : 1));
  return ymdLocal(d);
}

export interface ReplaceDue {
  nextDate: string;   // YYYY-MM-DD
  daysLeft: number;   // <0 = po terminie
  used: number;       // 0..1+ zużycia okresu
  label: string;      // "za 5 dni" / "dziś" / "3 dni po terminie"
}

export function dueLabel(daysLeft: number): string {
  if (daysLeft < 0) { const n = -daysLeft; return `${n} ${n === 1 ? 'dzień' : 'dni'} po terminie`; }
  if (daysLeft === 0) return 'dziś';
  if (daysLeft === 1) return 'jutro';
  if (daysLeft < 45) return `za ${daysLeft} dni`;
  return `za ~${Math.round(daysLeft / 30.44)} mies.`;
}

export function replaceDue(item: Pick<ReplaceItem, 'lastDate' | 'every' | 'unit'>, now: Date = new Date()): ReplaceDue {
  const nextDate = addInterval(item.lastDate, item.every, item.unit);
  const daysLeft = dayDiff(parse(nextDate), now);
  const total = Math.max(1, dayDiff(parse(nextDate), parse(item.lastDate)));
  const used = Math.max(0, dayDiff(now, parse(item.lastDate)) / total);
  return { nextDate, daysLeft, used, label: dueLabel(daysLeft) };
}

export function sortByDue(items: ReplaceItem[], now: Date = new Date()): { item: ReplaceItem; due: ReplaceDue }[] {
  return items.map((item) => ({ item, due: replaceDue(item, now) })).sort((a, b) => a.due.daysLeft - b.due.daysLeft);
}

// Oznaczenie wymiany: nowa data na szczyt, poprzednia do historii (bez duplikatów).
export function markReplaced(item: ReplaceItem, date: string, nowIso: string = new Date().toISOString()): ReplaceItem {
  if (date === item.lastDate) return item;
  const all = [...new Set([item.lastDate, ...item.history, date])].sort().reverse();
  const [lastDate, ...history] = all;
  return { ...item, lastDate, history: history.slice(0, 50), updatedAt: nowIso };
}

// Cofnięcie ostatniej wymiany (pomyłka) — poprzednia data wraca jako ostatnia.
export function undoLastReplace(item: ReplaceItem, nowIso: string = new Date().toISOString()): ReplaceItem {
  if (item.history.length === 0) return item;
  const [lastDate, ...history] = item.history;
  return { ...item, lastDate, history, updatedAt: nowIso };
}

// Średni realny odstęp między wymianami (dni) — z historii, gdy ≥2 daty.
export function realAvgDays(item: Pick<ReplaceItem, 'lastDate' | 'history'>): number | null {
  const dates = [item.lastDate, ...item.history].sort();
  if (dates.length < 2) return null;
  const span = dayDiff(parse(dates[dates.length - 1]), parse(dates[0]));
  return Math.round(span / (dates.length - 1));
}

// ── Zakupy z paragonów ────────────────────────────────────────────────────────
const fold = (s: string) => s.toLowerCase()
  .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l').replace(/ń/g, 'n')
  .replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ż/g, 'z').replace(/ź/g, 'z');

export interface ReplaceBuy { expenseId: string; date: string; text: string; price: number | null }

// Zakupy pasujące do słów rzeczy (pozycje paragonu, a bez pozycji — notatka).
export function findBuys(item: Pick<ReplaceItem, 'keywords'>, expenses: Expense[]): ReplaceBuy[] {
  const kws = item.keywords.map(fold).filter((k) => k.length >= 2);
  if (kws.length === 0) return [];
  const out: ReplaceBuy[] = [];
  for (const e of expenses) {
    if (e.type !== 'expense') continue;
    const hit = e.receiptItems?.find((ri) => kws.some((k) => fold(ri.name).includes(k)));
    if (hit) { out.push({ expenseId: e.id, date: e.date, text: hit.name, price: hit.price }); continue; }
    if (!e.receiptItems?.length && e.note && kws.some((k) => fold(e.note).includes(k))) {
      out.push({ expenseId: e.id, date: e.date, text: e.note, price: e.amount });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// Zakup PO ostatniej wymianie (i nieodrzucony) → "Kupione 12.11 — wymienione?".
export function pendingBuy(item: ReplaceItem, expenses: Expense[]): ReplaceBuy | null {
  const dismissed = new Set(item.dismissedBuys ?? []);
  return findBuys(item, expenses).find((b) => b.date > item.lastDate && !dismissed.has(b.expenseId)) ?? null;
}

// Koszt roczny: ostatnia cena za sztukę × liczba wymian w roku.
export function yearlyCost(item: Pick<ReplaceItem, 'every' | 'unit' | 'keywords'>, expenses: Expense[]): number | null {
  const last = findBuys(item, expenses).find((b) => b.price != null && b.price > 0);
  if (!last || last.price == null) return null;
  const perYear = item.unit === 'm' ? 12 / item.every : item.unit === 'w' ? 52 / item.every : 365 / item.every;
  return Math.round(last.price * perYear);
}

// ── Wspólna lista: dom + pojazdy ─────────────────────────────────────────────
// (2026-11-13, user: "tutaj też muszą się pokazywać zwykłe rzeczy, ale też te
// rzeczy z samochodu — olej do wymienienia za tydzień"). Serwis pojazdów żyje w
// vehiclesStore (ekran Pojazdy); tu najnowszy wpis per pozycja z interwałem.
export interface CarMaint { vehicleId: string; vehicleName: string; vehicleColor: string; label: string; every: number; lastDate: string }
export type ReplaceRow =
  | { key: string; kind: 'home'; item: ReplaceItem; due: ReplaceDue }
  | { key: string; kind: 'car'; car: CarMaint; due: ReplaceDue };

export function carMaintItems(vehicles: Pick<Vehicle, 'id' | 'name' | 'color' | 'maintenance'>[]): CarMaint[] {
  const out: CarMaint[] = [];
  for (const v of vehicles) {
    const latest = new Map<string, { date: string; intervalMonths?: number }>();
    for (const m of v.maintenance) {
      const cur = latest.get(m.label);
      if (!cur || m.date > cur.date) latest.set(m.label, m);
    }
    for (const [label, m] of latest) {
      if (!m.intervalMonths) continue; // najnowszy wpis bez interwału = bez terminu
      out.push({ vehicleId: v.id, vehicleName: v.name, vehicleColor: v.color, label, every: m.intervalMonths, lastDate: m.date.slice(0, 10) });
    }
  }
  return out;
}

export function allReplaceRows(items: ReplaceItem[], vehicles: Pick<Vehicle, 'id' | 'name' | 'color' | 'maintenance'>[], now: Date = new Date()): ReplaceRow[] {
  const rows: ReplaceRow[] = items.map((item) => ({ key: item.id, kind: 'home' as const, item, due: replaceDue(item, now) }));
  for (const car of carMaintItems(vehicles)) {
    rows.push({ key: `car:${car.vehicleId}:${car.label}`, kind: 'car', car, due: replaceDue({ lastDate: car.lastDate, every: car.every, unit: 'm' }, now) });
  }
  return rows.sort((a, b) => a.due.daysLeft - b.due.daysLeft);
}

export const rowName = (r: ReplaceRow) => (r.kind === 'home' ? r.item.name : r.car.label);

// Przypomnienia dla serwisu pojazdów: tydzień przed (czas na umówienie warsztatu).
export const CAR_REMIND_DAYS = 7;
export function carReminderItems(cars: CarMaint[]): ReplaceItem[] {
  return cars.map((c) => ({
    id: `car_${c.vehicleId}_${c.label.replace(/[^A-Za-z0-9]/g, '').slice(0, 24)}`,
    name: `${c.vehicleName}: ${c.label}`, every: c.every, unit: 'm' as const, lastDate: c.lastDate, history: [],
    remindDaysBefore: CAR_REMIND_DAYS, keywords: [], createdAt: '', updatedAt: '',
  }));
}
