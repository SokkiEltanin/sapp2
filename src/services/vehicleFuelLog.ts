import { useExpensesStore } from '@/store/expensesStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { FUEL_TYPE_LABEL, type FuelType, type Vehicle } from '@/types/vehicles';
import { offerUndo } from '@/services/undo';

function genId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Jedno "Zatankuj" = przebieg+typ+litry+kwota RAZEM (patrz src/types/vehicles.ts —
// to jest ULEPSZENIE względem sapp, który trzyma te dane osobno). Tworzy PRAWDZIWY,
// otagowany `Expense` (synchronicznie, ten sam offline-first wzorzec co
// bankCommit.ts) ORAZ `FuelLog` powiązany z nim przez `expenseId` — wydatek wpada w
// ISTNIEJĄCE agregaty Finansów (saldo, Stałe/Zmienne, Ostatnie transakcje) za darmo,
// bo tag pojazdu już jest tym czego `expenseMatchesVehicle` szuka.
export function logFuelFillUp(
  vehicleId: string,
  input: { date: string; odometerKm: number; fuelType: FuelType; liters: number; amount: number },
): void {
  const vehicle = useVehiclesStore.getState().vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return;

  const now = new Date().toISOString();
  const expenseId = genId();
  const tags = ['paliwo', vehicle.tag].filter((t, i, arr) => t && arr.indexOf(t) === i);
  useExpensesStore.getState().addExpense({
    id: expenseId,
    type: 'expense',
    amount: input.amount,
    date: input.date,
    note: `Tankowanie · ${FUEL_TYPE_LABEL[input.fuelType]} · ${vehicle.name}`,
    tags,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  });

  useVehiclesStore.getState().addFuelLog(vehicleId, {
    date: input.date,
    odometerKm: input.odometerKm,
    fuelType: input.fuelType,
    liters: input.liters,
    amount: input.amount,
    expenseId,
  });
}

// Uzupełnia tankowanie dla wydatku, który JUŻ jest (np. Orlen złapany z
// powiadomienia banku, 2026-11-12, user: "przy wydatku automatycznym z
// tankowania muszę mieć formularz tankowania") — bez drugiego wydatku: FuelLog
// wskazuje istniejący, a wydatek dostaje tagi 'paliwo' + tag pojazdu (i
// ewentualnie poprawioną kwotę z formularza).
export function logFuelForExistingExpense(
  vehicleId: string,
  expenseId: string,
  input: { date: string; odometerKm: number; fuelType: FuelType; liters: number; amount: number },
): void {
  const vehicle = useVehiclesStore.getState().vehicles.find((v) => v.id === vehicleId);
  const exp = useExpensesStore.getState().expenses.find((e) => e.id === expenseId);
  if (!vehicle || !exp) return;
  const tags = [...(exp.tags ?? [])];
  for (const t of ['paliwo', vehicle.tag]) if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) tags.push(t);
  useExpensesStore.getState().updateExpense(expenseId, {
    tags,
    ...(Math.abs(exp.amount - input.amount) > 0.001 ? { amount: input.amount } : {}),
    updatedAt: new Date().toISOString(),
  });
  useVehiclesStore.getState().addFuelLog(vehicleId, { ...input, expenseId, linkedExisting: true });
}

// Usuwa wpis tankowania I powiązany wydatek razem — inaczej user widziałby "duch"
// wydatku w Finansach bez możliwości powiązania go z niczym.
export function deleteFuelLogEntry(vehicleId: string, entryId: string): void {
  const vehicle = useVehiclesStore.getState().vehicles.find((v) => v.id === vehicleId);
  const entry = vehicle?.fuelLog.find((f) => f.id === entryId);
  if (!entry) return;
  const exp = entry.expenseId && !entry.linkedExisting
    ? useExpensesStore.getState().expenses.find((e) => e.id === entry.expenseId)
    : undefined;
  useVehiclesStore.getState().deleteFuelLog(vehicleId, entryId);
  if (exp) useExpensesStore.getState().deleteExpense(exp.id);
  // "Cofnij" (2026-11-14) — wraca wpis tankowania i jego wydatek (to samo id).
  offerUndo(`Usunięto tankowanie · ${entry.amount.toFixed(2).replace('.', ',')} zł`, () => {
    restoreVehicleEntry(vehicleId, 'fuelLog', entry);
    if (exp) {
      const st = useExpensesStore.getState();
      if (!st.expenses.some((e) => e.id === exp.id)) useExpensesStore.setState({ expenses: [...st.expenses, { ...exp, updatedAt: new Date().toISOString() }] });
    }
  });
}

/** Usunięcie wpisu serwisu z "Cofnij". */
export function deleteMaintenanceEntry(vehicleId: string, entryId: string): void {
  const entry = useVehiclesStore.getState().vehicles.find((v) => v.id === vehicleId)?.maintenance.find((m) => m.id === entryId);
  if (!entry) return;
  useVehiclesStore.getState().deleteMaintenance(vehicleId, entryId);
  offerUndo(`Usunięto: ${entry.label}`, () => restoreVehicleEntry(vehicleId, 'maintenance', entry));
}

/** Wstawia z powrotem usunięty wpis pojazdu (najnowsze pierwsze, jak w liście). */
function restoreVehicleEntry<K extends 'fuelLog' | 'maintenance'>(vehicleId: string, key: K, entry: Vehicle[K][number]): void {
  useVehiclesStore.setState((s) => ({
    vehicles: s.vehicles.map((v) => {
      if (v.id !== vehicleId) return v;
      const list = v[key] as { id: string; date: string }[];
      if (list.some((x) => x.id === entry.id)) return v;
      const next = [...list, entry as { id: string; date: string }].sort((a, b) => b.date.localeCompare(a.date));
      return { ...v, [key]: next, updatedAt: Date.now() };
    }),
  }));
}
