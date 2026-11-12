import { vehicleStats, unlinkedFuelExpenses } from '@/utils/vehicleMatch';
import type { Expense } from '@/types/finances';
import type { Vehicle, FuelLog } from '@/types/vehicles';

// 2026-11-12, CLAUDE.md zasada 10 — ekran Pojazdy pokazuje liczby, nie config.
const e = (o: Partial<Expense>): Expense => ({
  id: `e${Math.random()}`, type: 'expense', amount: 0, date: '2026-11-01', note: '', tags: [],
  source: 'manual', createdAt: '', updatedAt: '', ...o,
});
const fill = (o: Partial<FuelLog>): FuelLog => ({ id: `f${Math.random()}`, date: '2026-10-01', odometerKm: 0, fuelType: 'lpg', liters: 0, amount: 0, ...o });
const car = (o: Partial<Vehicle>): Vehicle => ({
  id: 'a3', name: 'Audi', kind: 'car', tag: 'auto', color: '#fff', fuelTypes: ['benzyna', 'lpg'],
  maintenance: [], fuelLog: [], odometerLog: [], createdAt: 0, updatedAt: 0, ...o,
});

describe('vehicleStats', () => {
  const v = car({
    fuelLog: [
      fill({ id: 'f1', date: '2026-10-01', odometerKm: 100000, liters: 40, amount: 120 }),
      fill({ id: 'f2', date: '2026-10-20', odometerKm: 100400, liters: 40, amount: 124 }), // 10 l/100
      fill({ id: 'f3', date: '2026-11-05', odometerKm: 100900, liters: 50, amount: 150 }), // 10 l/100
    ],
  });
  const now = new Date(2026, 10, 12);
  const st = vehicleStats(v, [], 'a3', now);

  test('przebieg, km w tym miesiącu, km/mies.', () => {
    expect(st.odometer).toBe(100900);
    expect(st.kmThisMonth).toBe(500); // 100400 (przed 1.11) → 100900
    expect(st.kmPerMonth).toBeGreaterThan(600); // 900 km / 35 dni × 30,44 ≈ 783
    expect(st.kmPerMonth).toBeLessThan(900);
  });

  test('spalanie i cena litra głównego paliwa', () => {
    expect(st.mainFuel).toBe('lpg');
    expect(st.consumption).toBeCloseTo(10);
    expect(st.avgPricePerLiter).toBeCloseTo((120 + 124 + 150) / 130);
    expect(st.fuelPer100km).toBeCloseTo(10 * ((120 + 124 + 150) / 130));
  });

  test('wiersze tankowań: najnowsze pierwsze, odcinkowe spalanie', () => {
    expect(st.fills.map((f) => f.id)).toEqual(['f3', 'f2', 'f1']);
    expect(st.fills[0].kmSincePrev).toBe(500);
    expect(st.fills[0].consumption).toBeCloseTo(10);
    expect(st.fills[2].consumption).toBeNull();
    expect(st.lastFillDaysAgo).toBe(7);
  });

  test('brak danych → null-e, bez wyjątków', () => {
    const empty = vehicleStats(car({}), [], 'a3', now);
    expect(empty.odometer).toBeNull();
    expect(empty.consumption).toBeNull();
    expect(empty.kmPerMonth).toBeNull();
    expect(empty.fills).toEqual([]);
  });
});

describe('unlinkedFuelExpenses', () => {
  const now = new Date(2026, 10, 12);
  test('paliwo głównego auta bez wpisu tankowania → do uzupełnienia; podpięte i nie-paliwo pomijane', () => {
    const orlen = e({ id: 'o', storeName: 'ORLEN STACJA 123', amount: 200, date: '2026-11-10T08:00:00' });
    const linked = e({ id: 'l', storeName: 'Shell', amount: 150, date: '2026-11-02' });
    const myjnia = e({ id: 'm', storeName: 'Myjnia', amount: 30, date: '2026-11-03', tags: ['auto'] });
    const v = car({ fuelLog: [fill({ expenseId: 'l' })] });
    expect(unlinkedFuelExpenses(v, [orlen, linked, myjnia], 'a3', 90, now).map((x) => x.id)).toEqual(['o']);
  });
});
