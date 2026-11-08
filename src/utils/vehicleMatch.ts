import type { Expense } from '@/types/finances';
import type { Vehicle, VehicleMaintenance, VehicleKind, OdometerReading } from '@/types/vehicles';

// Port z sapp (src/utils/vehicleMatch.ts) — adaptowane do sapp2 (bez `Expense.
// vehicleId`/`category` — patrz komentarz w src/types/vehicles.ts). `addMonths`
// WŁASNA implementacja (sapp używa `date-fns`, sapp2 go nie ma) — przycina dzień
// nieistniejący w docelowym miesiącu zamiast przewijać (ten sam fix co sapp's
// komentarz niżej przy `maintenanceDueMonths` opisuje).
function addMonthsClipped(date: Date, months: number): Date {
  const targetMonthIndex = date.getMonth() + months;
  const daysInTarget = new Date(date.getFullYear(), targetMonthIndex + 1, 0).getDate();
  const result = new Date(date.getFullYear(), targetMonthIndex, Math.min(date.getDate(), daysInTarget));
  return result;
}

export interface CostPerKm {
  value: number;
  kmDelta: number;
  spendDelta: number;
  fromDate: string;
  toDate: string;
}

// Co "wygląda jak paliwo" (tag albo tekst notatki/sklepu) — "bp" jako CAŁE słowo,
// nie fragment innego.
const FUEL_TAGS = ['paliwo', 'tankowanie', 'benzyna', 'diesel', 'lpg', 'olej napędowy'];
export function looksLikeFuel(e: Pick<Expense, 'tags' | 'note' | 'storeName'>): boolean {
  if ((e.tags ?? []).some((t) => FUEL_TAGS.includes(t.toLowerCase()))) return true;
  const txt = `${e.note ?? ''} ${e.storeName ?? ''}`.toLowerCase();
  return /paliw|tankow|benzyn|diesel|\blpg\b|orlen|\bbp\b|shell|circle\s*k|\bmoya\b|amic|lotos/.test(txt);
}

// Czy wydatek pasuje do pojazdu? Bez `vehicleId` (sapp2 nie dotyka schematu
// `Expense` — patrz src/types/vehicles.ts): tag pojazdu na wydatku, LUB prefiks
// #tag/[X] w notatce/sklepie, LUB (tylko dla wyznaczonego głównego samochodu)
// wydatek "wygląda jak paliwo".
export function expenseMatchesVehicle(e: Expense, v: Pick<Vehicle, 'id' | 'kind' | 'tag'>, mainCarId?: string): boolean {
  if (e.type === 'income') return false;
  const tag = (v.tag ?? '').toLowerCase().trim();
  if (tag) {
    if ((e.tags ?? []).some((t) => t.toLowerCase() === tag)) return true;
    const txt = `${e.note ?? ''} ${e.storeName ?? ''}`.toLowerCase();
    if (txt.includes(`#${tag}`) || txt.includes(`[${tag[0]}]`)) return true;
  }
  if (v.id === mainCarId && v.kind === 'car' && looksLikeFuel(e)) return true;
  return false;
}

// Samochód który łapie generyczne "wygląda jak paliwo" wydatki — oflagowany
// `isMainCar`, inaczej: dokładnie jeden samochód w ogóle.
export function mainCarId(vehicles: Pick<Vehicle, 'id' | 'kind' | 'isMainCar'>[]): string | undefined {
  const flagged = vehicles.find((v) => v.isMainCar && v.kind === 'car');
  if (flagged) return flagged.id;
  const cars = vehicles.filter((v) => v.kind === 'car');
  return cars.length === 1 ? cars[0].id : undefined;
}

export interface VehicleSummary {
  total: number;
  fuel: number;
  other: number;
  count: number;
  thisMonth: number;
  expenses: Expense[]; // najnowsze pierwsze
}

export function summarizeVehicle(v: Pick<Vehicle, 'id' | 'kind' | 'tag'>, expenses: Expense[], mainId?: string, now: Date = new Date()): VehicleSummary {
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const mine = expenses.filter((e) => expenseMatchesVehicle(e, v, mainId));
  let total = 0, fuel = 0, other = 0, thisMonth = 0;
  for (const e of mine) {
    total += e.amount;
    if (looksLikeFuel(e)) fuel += e.amount; else other += e.amount;
    if ((e.date ?? '').slice(0, 7) === ym) thisMonth += e.amount;
  }
  mine.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { total, fuel, other, count: mine.length, thisMonth, expenses: mine };
}

export interface VehicleYearSummary {
  total: number; fuel: number; other: number; count: number;
  prevTotal: number | null;
  deltaPct: number | null;
}

// "Roczne podsumowanie kosztu posiadania" — okno 12 miesięcy wstecz od `now` (nie
// rok kalendarzowy), porównane z KOLEJNYMI 12 miesiącami przed tym oknem.
export function vehicleYearSummary(v: Pick<Vehicle, 'id' | 'kind' | 'tag'>, expenses: Expense[], mainId?: string, now: Date = new Date()): VehicleYearSummary {
  const mine = expenses.filter((e) => expenseMatchesVehicle(e, v, mainId));
  const nowStr = now.toISOString().slice(0, 10);
  const curStart = new Date(now); curStart.setFullYear(curStart.getFullYear() - 1);
  const curStartStr = curStart.toISOString().slice(0, 10);
  const prevStart = new Date(now); prevStart.setFullYear(prevStart.getFullYear() - 2);
  const prevStartStr = prevStart.toISOString().slice(0, 10);

  let total = 0, fuel = 0, other = 0, count = 0, prevTotal = 0, hasPrevData = false;
  for (const e of mine) {
    const d = (e.date ?? '').slice(0, 10);
    if (d >= curStartStr && d <= nowStr) {
      total += e.amount; count++;
      if (looksLikeFuel(e)) fuel += e.amount; else other += e.amount;
    } else if (d >= prevStartStr && d < curStartStr) {
      prevTotal += e.amount; hasPrevData = true;
    }
  }
  const deltaPct = hasPrevData && prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  return { total, fuel, other, count, prevTotal: hasPrevData ? prevTotal : null, deltaPct };
}

// Miesiące do następnego terminu serwisu (ujemne = przeterminowane). `null` gdy
// brak ustawionego interwału.
export function maintenanceDueMonths(m: Pick<VehicleMaintenance, 'date' | 'intervalMonths'>, now: Date = new Date()): number | null {
  if (!m.intervalMonths) return null;
  const due = addMonthsClipped(new Date(m.date), m.intervalMonths);
  return (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

function plDays(n: number): string {
  if (n === 1) return 'dzień';
  return 'dni';
}

export function maintenanceDueLabel(due: number): string {
  if (due <= 0) return 'zaległe';
  if (due < 1) {
    const days = Math.max(1, Math.round(due * 30.44));
    return `za ${days} ${plDays(days)}`;
  }
  return `za ~${Math.round(due)} mies.`;
}

export function maintenancePresets(kind: VehicleKind): { label: string; intervalMonths?: number }[] {
  if (kind === 'bike') return [
    { label: 'Smarowanie łańcucha', intervalMonths: 1 },
    { label: 'Wymiana opony' },
    { label: 'Przegląd / serwis', intervalMonths: 12 },
    { label: 'Akcesoria' },
  ];
  if (kind === 'car') return [
    { label: 'Wymiana oleju', intervalMonths: 12 },
    { label: 'Płyn do spryskiwaczy' },
    { label: 'Klocki hamulcowe', intervalMonths: 24 },
    { label: 'Wymiana opon', intervalMonths: 6 },
    { label: 'Przegląd techniczny', intervalMonths: 12 },
  ];
  return [
    { label: 'Serwis', intervalMonths: 12 },
    { label: 'Części / akcesoria' },
  ];
}

// Koszt/km — PIERWSZY i OSTATNI odczyt (nie każda kolejna para — stabilniejsza
// "średnia od kiedy zacząłem śledzić"), licznik złożony z `fuelLog`'s odometerKm +
// samodzielnego `odometerLog` (ULEPSZENIE vs sapp: tam tylko jedna lista).
export function costPerKm(v: Pick<Vehicle, 'id' | 'kind' | 'tag' | 'fuelLog' | 'odometerLog'>, expenses: Expense[], mainId?: string): CostPerKm | null {
  const combined: OdometerReading[] = [
    ...(v.odometerLog ?? []),
    ...(v.fuelLog ?? []).map((f) => ({ id: f.id, date: f.date, km: f.odometerKm })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  if (combined.length < 2) return null;
  const first = combined[0], last = combined[combined.length - 1];
  const kmDelta = last.km - first.km;
  if (kmDelta <= 0) return null;
  const spendDelta = expenses
    .filter((e) => expenseMatchesVehicle(e, v, mainId) && e.date >= first.date && e.date <= last.date)
    .reduce((s, e) => s + e.amount, 0);
  return { value: spendDelta / kmDelta, kmDelta, spendDelta, fromDate: first.date, toDate: last.date };
}

// Najświeższy znany przebieg (max km ze wszystkich odczytów — nie zawsze ostatni
// CHRONOLOGICZNIE wpisany jest największy, np. korekta błędnego wpisu).
export function currentOdometer(v: Pick<Vehicle, 'fuelLog' | 'odometerLog'>): number | null {
  const kms = [...(v.odometerLog ?? []).map((o) => o.km), ...(v.fuelLog ?? []).map((f) => f.odometerKm)];
  return kms.length ? Math.max(...kms) : null;
}

// Średnie zużycie L/100km między kolejnymi (po przebiegu) tankowaniami TEGO SAMEGO
// typu paliwa — NOWA funkcja, niemożliwa w sapp (tam `OdometerReading` nie niesie
// litrów). Pierwsze tankowanie każdego typu to tylko punkt odniesienia (nie da się
// policzyć zużycia "do" niego, nie ma poprzedniego km TEGO typu).
export function avgFuelConsumption(v: Pick<Vehicle, 'fuelLog'>, fuelType?: string): number | null {
  const log = [...(v.fuelLog ?? [])]
    .filter((f) => !fuelType || f.fuelType === fuelType)
    .sort((a, b) => (a.odometerKm - b.odometerKm));
  if (log.length < 2) return null;
  let totalLiters = 0, totalKm = 0;
  for (let i = 1; i < log.length; i++) {
    const kmDelta = log[i].odometerKm - log[i - 1].odometerKm;
    if (kmDelta <= 0) continue;
    totalLiters += log[i].liters;
    totalKm += kmDelta;
  }
  if (totalKm <= 0) return null;
  return (totalLiters / totalKm) * 100;
}
