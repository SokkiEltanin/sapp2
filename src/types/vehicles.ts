// Port z sapp (src/types/index.ts's Vehicle/VehicleMaintenance/OdometerReading) —
// "zakładka Pojazdy" (2026-11-09, user: "zależy mi na monitoringu jak w sapp tylko
// lepszym będziemy monitorować samochód przebieg, co robione w nim, ile na paliwo
// (aktualny przebieg, cena i ilość litrów czy LPG czy benzyna czy co tam [to będzie
// w kreatorze pojazdu co pije])").
//
// ULEPSZENIE względem sapp (nie tylko port): sapp trzyma `OdometerReading` (tylko
// {date,km}) ZUPEŁNIE osobno od wydatków na paliwo — `costPerKm()` tylko zgaduje
// koszt z PIERWSZEGO/OSTATNIEGO odczytu i sumy wydatków w tym oknie, nie wie ile
// faktycznie litrów wlano przy KTÓRYM przebiegu. `FuelLog` niżej to NOWY, bogatszy
// rekord — jedno "Zatankuj" w app/vehicles.tsx zapisuje przebieg+typ paliwa+litry+
// kwotę RAZEM (i tworzy powiązany `Expense`, otagowany tagiem pojazdu, więc wpada w
// ISTNIEJĄCE agregaty Finansów za darmo) — to właśnie pozwala policzyć realne
// zużycie L/100km między kolejnymi tankowaniami, czego sapp nie potrafi w ogóle.
//
// ŚWIADOMIE NIE portowane: `vehicleId` na `Expense` (sapp's ręczne, wyłączne
// przypisanie wydatku do pojazdu) — sapp2 nie dotyka schematu `Expense`, dopasowanie
// idzie WYŁĄCZNIE przez tag (już w pełni obsługiwany przez istniejące pole
// `Expense.tags` i `AddExpenseModal`'s pole Tagi, zero nowego UI potrzebne). `tireSeason`
// pominięte (przypomnienie o wymianie opon sezonowych — osobna, mniejsza funkcja,
// można dobudować później, nie blokuje reszty).
export type VehicleKind = 'car' | 'motorcycle' | 'scooter' | 'bike' | 'other';
export type FuelType = 'benzyna' | 'diesel' | 'lpg' | 'elektryczny';

export const FUEL_TYPE_LABEL: Record<FuelType, string> = {
  benzyna: 'Benzyna', diesel: 'Diesel', lpg: 'LPG', elektryczny: 'Elektryczny',
};

export const VEHICLE_KIND_LABEL: Record<VehicleKind, string> = {
  car: 'Samochód', motorcycle: 'Motocykl', scooter: 'Skuter', bike: 'Rower', other: 'Inny',
};

// Kind-aware: tylko pojazdy spalinowe/elektryczne mają sens z "co pije" (kreator
// pokazuje ten krok TYLKO dla tych rodzajów — rower pomija go całkiem).
export function vehicleHasFuel(kind: VehicleKind): boolean {
  return kind === 'car' || kind === 'motorcycle' || kind === 'scooter';
}

export interface VehicleMaintenance {
  id: string;
  label: string;           // "Wymiana oleju", "Smarowanie łańcucha", custom
  date: string;             // ISO data wykonania
  intervalMonths?: number;  // interwał przypomnienia (opcjonalny)
  expenseId?: string;       // powiązana transakcja (opcjonalnie)
}

// Bogaty rekord tankowania — przebieg+typ+litry+kwota RAZEM (patrz komentarz na
// górze pliku — to jest ULEPSZENIE względem sapp's osobnego OdometerReading).
export interface FuelLog {
  id: string;
  date: string;
  odometerKm: number;
  fuelType: FuelType;
  liters: number;
  amount: number;      // łączna kwota zapłacona (zł)
  expenseId?: string;  // auto-utworzony, otagowany Expense (dla agregatów Finansów)
  // true = podpięty do JUŻ ISTNIEJĄCEGO wydatku (np. złapanego z banku) zamiast
  // tworzyć nowy — usunięcie tankowania NIE kasuje wtedy tego wydatku.
  linkedExisting?: boolean;
}

// Samodzielny odczyt licznika (pojazdy bez paliwa, np. rower, albo dowolny ręczny
// wpis niezwiązany z tankowaniem) — ten sam kształt co sapp's `OdometerReading`.
export interface OdometerReading {
  id: string;
  date: string;
  km: number;
}

export interface Vehicle {
  id: string;
  name: string;               // "Octavia", "Mój rower"
  kind: VehicleKind;
  tag: string;                 // znormalizowany tag auto-dopasowujący wydatki (np. "rower")
  color: string;                // hex, do chipów/akcentów UI
  isMainCar?: boolean;          // ten samochód łapie generyczne "wygląda na paliwo" wydatki
  fuelTypes?: FuelType[];       // co pije (kreator) — puste/undefined dla roweru
  maintenance: VehicleMaintenance[];
  fuelLog: FuelLog[];
  odometerLog: OdometerReading[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
