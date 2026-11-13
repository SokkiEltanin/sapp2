import {
  looksLikeFuel, expenseMatchesVehicle, mainCarId, summarizeVehicle,
  maintenanceDueMonths, maintenanceDueLabel, maintenancePresets, costPerKm,
  vehicleYearSummary, currentOdometer, avgFuelConsumption,
} from '@/utils/vehicleMatch';
import type { Expense } from '@/types/finances';
import type { Vehicle, VehicleMaintenance, OdometerReading, FuelLog } from '@/types/vehicles';

// Port z sapp (__tests__/vehicleMatch.test.ts), fixture'y dopasowane do sapp2's
// `Expense` (bez `category`/`currency`) i `Vehicle` (bez `vehicleId` na Expense —
// dopasowanie WYŁĄCZNIE przez tag, patrz src/types/vehicles.ts). `currentOdometer`/
// `avgFuelConsumption` NOWE (nie ma odpowiednika w sapp — patrz komentarz w
// src/utils/vehicleMatch.ts).

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', type: 'expense', amount: 0, tags: [], note: '',
  date: '2026-08-04', source: 'manual', createdAt: '', updatedAt: '', ...o,
});
const v = (o: Partial<Vehicle>): Vehicle => ({
  id: 'v1', name: 'Auto', kind: 'car', tag: '', color: '#fff',
  maintenance: [], fuelLog: [], odometerLog: [], createdAt: 0, updatedAt: 0, ...o,
});

describe('vehicleMatch — looksLikeFuel', () => {
  test('rozpoznaje po tagu (case-insensitive)', () => {
    expect(looksLikeFuel(e({ tags: ['Paliwo'] }))).toBe(true);
  });
  test('rozpoznaje stację paliw po nazwie sklepu/notatce', () => {
    expect(looksLikeFuel(e({ storeName: 'Orlen Rzeszów' }))).toBe(true);
    expect(looksLikeFuel(e({ note: 'tankowanie przed trasą' }))).toBe(true);
  });
  test('zwykły wydatek transportowy (np. bilet MPK) to NIE paliwo', () => {
    expect(looksLikeFuel(e({ storeName: 'MPK Rzeszów', note: 'bilet miesięczny' }))).toBe(false);
  });
  test('"bp" jako CAŁE słowo trafia, ale nie jako fragment innego słowa', () => {
    expect(looksLikeFuel(e({ storeName: 'BP Stacja' }))).toBe(true);
    expect(looksLikeFuel(e({ storeName: 'Sklep' }))).toBe(false);
  });
});

describe('vehicleMatch — expenseMatchesVehicle', () => {
  test('przychód (income) nigdy nie pasuje, nawet z pasującym tagiem', () => {
    const car = v({ tag: 'auto' });
    expect(expenseMatchesVehicle(e({ type: 'income', tags: ['auto'] }), car)).toBe(false);
  });
  test('dopasowanie po tagu wydatku', () => {
    const bike = v({ id: 'v1', kind: 'bike', tag: 'rower' });
    expect(expenseMatchesVehicle(e({ tags: ['rower'] }), bike)).toBe(true);
  });
  test('dopasowanie po prefiksie #tag lub [T] w notatce', () => {
    const bike = v({ id: 'v1', kind: 'bike', tag: 'rower' });
    expect(expenseMatchesVehicle(e({ note: 'nowe opony #rower' }), bike)).toBe(true);
    expect(expenseMatchesVehicle(e({ note: '[R] łańcuch' }), bike)).toBe(true);
  });
  test('paliwo pasuje TYLKO do wyznaczonego głównego samochodu, nie do innych aut', () => {
    const mainCar = v({ id: 'main', kind: 'car', tag: '' });
    const otherCar = v({ id: 'other', kind: 'car', tag: '' });
    const fuelExp = e({ storeName: 'Orlen' });
    expect(expenseMatchesVehicle(fuelExp, mainCar, 'main')).toBe(true);
    expect(expenseMatchesVehicle(fuelExp, otherCar, 'main')).toBe(false);
  });
  test('paliwo NIE pasuje do roweru nawet jeśli byłby "głównym" (musi być kind=car)', () => {
    const bike = v({ id: 'main', kind: 'bike', tag: '' });
    expect(expenseMatchesVehicle(e({ storeName: 'Orlen' }), bike, 'main')).toBe(false);
  });
  test('bez tagu i bez dopasowania paliwa → false', () => {
    const car = v({ id: 'v1', tag: '' });
    expect(expenseMatchesVehicle(e({ storeName: 'Zupełnie inny sklep' }), car)).toBe(false);
  });
});

describe('vehicleMatch — mainCarId', () => {
  test('samochód oflagowany isMainCar wygrywa', () => {
    const vehicles = [v({ id: 'a', kind: 'car' }), v({ id: 'b', kind: 'car', isMainCar: true })];
    expect(mainCarId(vehicles)).toBe('b');
  });
  test('brak flagi, ale DOKŁADNIE jeden samochód → ten jest głównym', () => {
    const vehicles = [v({ id: 'a', kind: 'car' }), v({ id: 'bike1', kind: 'bike' })];
    expect(mainCarId(vehicles)).toBe('a');
  });
  test('kilka aut bez flagi → niejednoznaczne, undefined', () => {
    const vehicles = [v({ id: 'a', kind: 'car' }), v({ id: 'b', kind: 'car' })];
    expect(mainCarId(vehicles)).toBeUndefined();
  });
  test('brak żadnego auta → undefined', () => {
    expect(mainCarId([v({ id: 'a', kind: 'bike' })])).toBeUndefined();
  });
});

describe('vehicleMatch — summarizeVehicle', () => {
  test('sumuje paliwo/inne osobno, liczy tylko pasujące wydatki, sortuje najnowsze pierwsze', () => {
    const car = v({ id: 'v1', tag: 'auto' });
    const exps = [
      e({ id: '1', tags: ['auto'], amount: 100, storeName: 'Orlen', date: '2026-01-01' }),
      e({ id: '2', tags: ['auto'], amount: 50, storeName: 'Warsztat', date: '2026-03-01' }),
      e({ id: '3', tags: ['inny'], amount: 999, date: '2026-02-01' }),
    ];
    const s = summarizeVehicle(car, exps);
    expect(s.count).toBe(2);
    expect(s.total).toBe(150);
    expect(s.fuel).toBe(100);
    expect(s.other).toBe(50);
    expect(s.expenses.map((x) => x.id)).toEqual(['2', '1']);
  });
});

describe('vehicleMatch — maintenanceDueMonths', () => {
  const m = (o: Partial<VehicleMaintenance>): VehicleMaintenance => ({ id: 'm1', label: 'Serwis', date: '2026-01-01', ...o });

  test('brak interwału → null', () => {
    expect(maintenanceDueMonths(m({ intervalMonths: undefined }))).toBeNull();
  });
  test('termin dziś + 1 miesiąc interwału → ok. +1 miesiąc do terminu (dodatnie)', () => {
    const now = new Date(2026, 0, 1);
    const result = maintenanceDueMonths(m({ date: '2026-01-01', intervalMonths: 1 }), now);
    expect(result).toBeGreaterThan(0.8);
    expect(result).toBeLessThan(1.2);
  });
  test('serwis 2 miesiące temu + interwał 1 miesiąc → przeterminowane ok. -1 miesiąc', () => {
    const now = new Date(2026, 2, 1);
    const result = maintenanceDueMonths(m({ date: '2026-01-01', intervalMonths: 1 }), now);
    expect(result).toBeLessThan(-0.8);
    expect(result).toBeGreaterThan(-1.2);
  });
  test('31.01 + 1 mies. interwału, "dziś" = 1.03 → przeterminowane (przycięty termin 28.02), NIE przewinięty 3.03', () => {
    const now = new Date(2026, 2, 1, 12);
    const result = maintenanceDueMonths(m({ date: '2026-01-31', intervalMonths: 1 }), now);
    expect(result).toBeLessThan(0);
  });
});

describe('vehicleMatch — maintenanceDueLabel', () => {
  test('przeterminowane (due <= 0) → "zaległe"', () => {
    expect(maintenanceDueLabel(0)).toBe('zaległe');
    expect(maintenanceDueLabel(-0.5)).toBe('zaległe');
  });
  test('due < 1 miesiąc → dni, NIE "za ~0 mies."', () => {
    expect(maintenanceDueLabel(0.2)).toBe('za 6 dni');
    expect(maintenanceDueLabel(0.03)).toBe('za 1 dzień');
  });
  test('due >= 1 miesiąc → miesiące jak dotychczas', () => {
    expect(maintenanceDueLabel(1)).toBe('za ~1 mies.');
    expect(maintenanceDueLabel(11.4)).toBe('za ~11 mies.');
  });
});

describe('vehicleMatch — maintenancePresets', () => {
  test('rower ma presety specyficzne dla roweru (smarowanie łańcucha)', () => {
    expect(maintenancePresets('bike').map((p) => p.label)).toContain('Smarowanie łańcucha');
  });
  test('samochód ma presety specyficzne dla auta (klocki hamulcowe)', () => {
    expect(maintenancePresets('car').map((p) => p.label)).toContain('Klocki hamulcowe');
  });
  test('inny rodzaj pojazdu dostaje generyczny fallback', () => {
    expect(maintenancePresets('other').map((p) => p.label)).toContain('Serwis');
  });
});

describe('vehicleMatch — costPerKm', () => {
  const odo = (o: Partial<OdometerReading>): OdometerReading => ({ id: 'o', date: '2026-08-01', km: 0, ...o });

  test('< 2 odczyty → null', () => {
    expect(costPerKm(v({}), [])).toBeNull();
    expect(costPerKm(v({ odometerLog: [odo({ km: 100 })] }), [])).toBeNull();
  });
  test('licznik się nie zmienił albo spadł → null, nie ujemny/NaN koszt', () => {
    const car = v({ odometerLog: [odo({ date: '2026-08-01', km: 500 }), odo({ date: '2026-08-15', km: 500 })] });
    expect(costPerKm(car, [])).toBeNull();
    const backwards = v({ odometerLog: [odo({ date: '2026-08-01', km: 500 }), odo({ date: '2026-08-15', km: 480 })] });
    expect(costPerKm(backwards, [])).toBeNull();
  });
  test('liczy z PIERWSZEGO i OSTATNIEGO odczytu (nieposortowane), łącząc odometerLog+fuelLog', () => {
    const car = v({
      tag: 'auto',
      odometerLog: [odo({ id: 'a', date: '2026-08-20', km: 12300 }), odo({ id: 'b', date: '2026-08-01', km: 12000 })],
    });
    const expenses = [
      e({ date: '2026-08-05', amount: 150, tags: ['auto'] }),
      e({ date: '2026-08-25', amount: 999, tags: ['auto'] }),
    ];
    const r = costPerKm(car, expenses);
    expect(r).not.toBeNull();
    expect(r!.kmDelta).toBe(300);
    expect(r!.spendDelta).toBe(150);
    expect(r!.value).toBeCloseTo(0.5);
  });
  test('sumuje paliwo I części (te same zasady dopasowania co summarizeVehicle)', () => {
    const bike = v({ kind: 'bike', tag: 'rower', odometerLog: [odo({ date: '2026-08-01', km: 0 }), odo({ date: '2026-08-31', km: 100 })] });
    const expenses = [e({ date: '2026-08-10', amount: 40, tags: ['rower'] }), e({ date: '2026-08-20', amount: 60, tags: ['rower'] })];
    const r = costPerKm(bike, expenses);
    expect(r!.spendDelta).toBe(100);
    expect(r!.value).toBeCloseTo(1);
  });
});

describe('vehicleMatch — vehicleYearSummary', () => {
  const NOW = new Date(2026, 8, 29);

  test('sumuje ostatnie 12 miesięcy, dzieli na paliwo/inne, bez danych sprzed roku → prevTotal null', () => {
    const car = v({ tag: 'auto' });
    const expenses = [
      e({ date: '2026-06-01', amount: 200, tags: ['auto'], storeName: 'Orlen' }),
      e({ date: '2026-03-01', amount: 300, tags: ['auto'] }),
      e({ date: '2023-01-01', amount: 999, tags: ['auto'] }),
    ];
    const r = vehicleYearSummary(car, expenses, undefined, NOW);
    expect(r.total).toBe(500);
    expect(r.fuel).toBe(200);
    expect(r.other).toBe(300);
    expect(r.count).toBe(2);
    expect(r.prevTotal).toBeNull();
    expect(r.deltaPct).toBeNull();
  });
  test('liczy % zmiany względem poprzednich 12 miesięcy, gdy jest historia', () => {
    const car = v({ tag: 'auto' });
    const expenses = [e({ date: '2026-06-01', amount: 600, tags: ['auto'] }), e({ date: '2025-06-01', amount: 400, tags: ['auto'] })];
    const r = vehicleYearSummary(car, expenses, undefined, NOW);
    expect(r.total).toBe(600);
    expect(r.prevTotal).toBe(400);
    expect(r.deltaPct).toBe(50);
  });
  test('wydatki innego pojazdu / przychody nie wliczają się', () => {
    const car = v({ id: 'v1', tag: 'auto' });
    const expenses = [e({ date: '2026-06-01', amount: 100, tags: ['rower'] }), e({ date: '2026-06-01', amount: 50, type: 'income', tags: ['auto'] })];
    const r = vehicleYearSummary(car, expenses, undefined, NOW);
    expect(r.total).toBe(0);
  });
});

// NOWE (nie ma odpowiednika w sapp) — currentOdometer/avgFuelConsumption korzystają
// z bogatszego FuelLog (przebieg+litry RAZEM), patrz src/types/vehicles.ts.
describe('vehicleMatch — currentOdometer', () => {
  test('bierze MAX km ze wszystkich odczytów (odometerLog + fuelLog), nie ostatni chronologicznie', () => {
    const car = v({
      odometerLog: [{ id: 'o1', date: '2026-08-01', km: 10000 }],
      fuelLog: [{ id: 'f1', date: '2026-08-10', odometerKm: 10500, fuelType: 'benzyna', liters: 40, amount: 200 } as FuelLog],
    });
    expect(currentOdometer(car)).toBe(10500);
  });
  test('brak jakichkolwiek odczytów → null', () => {
    expect(currentOdometer(v({}))).toBeNull();
  });
});

describe('vehicleMatch — avgFuelConsumption', () => {
  test('< 2 tankowania (danego typu) → null', () => {
    const car = v({ fuelLog: [{ id: 'f1', date: '2026-08-01', odometerKm: 1000, fuelType: 'benzyna', liters: 40, amount: 200 } as FuelLog] });
    expect(avgFuelConsumption(car)).toBeNull();
  });
  test('liczy L/100km między kolejnymi tankowaniami wg przebiegu (nie daty dodania)', () => {
    const car = v({
      fuelLog: [
        { id: 'f2', date: '2026-08-20', odometerKm: 1500, fuelType: 'benzyna', liters: 35, amount: 180 } as FuelLog,
        { id: 'f1', date: '2026-08-01', odometerKm: 1000, fuelType: 'benzyna', liters: 40, amount: 200 } as FuelLog,
      ],
    });
    // 500km przejechane między tankowaniami, drugie tankowanie wlało 35l → 7 L/100km
    expect(avgFuelConsumption(car)).toBeCloseTo(7);
  });
  test('filtruje po typie paliwa gdy pojazd tankuje dwa (np. LPG+benzyna)', () => {
    const car = v({
      fuelLog: [
        { id: 'b1', date: '2026-08-01', odometerKm: 1000, fuelType: 'benzyna', liters: 10, amount: 60 } as FuelLog,
        { id: 'l1', date: '2026-08-05', odometerKm: 1100, fuelType: 'lpg', liters: 8, amount: 30 } as FuelLog,
        { id: 'l2', date: '2026-08-10', odometerKm: 1200, fuelType: 'lpg', liters: 9, amount: 32 } as FuelLog,
      ],
    });
    expect(avgFuelConsumption(car, 'lpg')).toBeCloseTo(9); // 100km, 9l LPG
  });
});
