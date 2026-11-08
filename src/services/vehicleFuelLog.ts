import { useExpensesStore } from '@/store/expensesStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { FUEL_TYPE_LABEL, type FuelType } from '@/types/vehicles';

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

// Usuwa wpis tankowania I powiązany wydatek razem — inaczej user widziałby "duch"
// wydatku w Finansach bez możliwości powiązania go z niczym.
export function deleteFuelLogEntry(vehicleId: string, entryId: string): void {
  const vehicle = useVehiclesStore.getState().vehicles.find((v) => v.id === vehicleId);
  const entry = vehicle?.fuelLog.find((f) => f.id === entryId);
  useVehiclesStore.getState().deleteFuelLog(vehicleId, entryId);
  if (entry?.expenseId) useExpensesStore.getState().deleteExpense(entry.expenseId);
}
