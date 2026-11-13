// Port z sapp (src/types/index.ts's WorkSettings/Employer) 1:1 w polach, ale JEDNA
// świadoma uproszczona architektura (2026-11-09, user: "Pełny port z sapp od razu"):
// sapp ma Employer JAKO WARSTWĘ NAD osobnym, globalnym WorkSettings — bo ~17 miejsc w
// sapp (dashboard/bank/osiągnięcia) czyta `workSettings.workPrefix` BEZPOŚREDNIO, bez
// pojęcia o liście pracodawców, więc `workService.setActiveEmployer()` zwierciadli pola
// aktywnego pracodawcy do tego osobnego store'a, żeby te miejsca "same" zaczęły liczyć
// nową pracę. sapp2 NIE MA żadnego takiego dotychczasowego konsumenta (Praca nie
// istniała w sapp2 przed tą rundą) — więc `Employer[]` + `activeEmployerId` to JEDYNE
// źródło prawdy, bez osobnego mirrorowanego `WorkSettings` i bez całej migracyjnej
// otoczki wokół niego. Funkcjonalnie 1:1 (wiele pracodawców, nadpisania, potwierdzone
// miesiące, ukrywanie starych).
//
// ŚWIADOMIE NIE PORTOWANE: `WorkShift` (ręczne zmiany bez kalendarza, "clock in/out") i
// cały `useWorkEarnings.ts`'s per-sekundowy, żywy licznik zarobków (setInterval 1Hz,
// aktywna zmiana TERAZ, powiadomienia początek/koniec zmiany) — osobna, znacznie
// większa funkcja (sapp's historia: ten licznik kiedyś sam powodował realny lag przez
// wymuszone re-rendery co sekundę). sapp2 zaczyna od trybu kalendarzowego (kolor/prefiks
// eventu) — statyczne stawka/godziny/historia, bez animowanego "zarabiasz TERAZ"
// zegara. Można dobudować później jako osobna, świadoma runda, jeśli faktycznie
// potrzebne.
export interface ConfirmedMonth {
  salary: number;
  hours: number;
  excluded?: boolean;
}

export interface Employer {
  id: string;
  name: string; // np. "Firma X" — user sam nazywa
  // 'manual' = bez tagowania kalendarza, stawka = monthlySalary ÷ hoursPerMonth
  // bezpośrednio. undefined zachowuje się jak 'calendar'.
  workMode?: 'calendar' | 'manual';
  workColor?: string;   // hex koloru — eventy kalendarza z tym kolorem liczą się jako praca
  workPrefix?: string;  // prefiks tytułu — eventy zaczynające się od tego liczą się jako praca
  monthlySalary: number;
  hoursPerMonth: number;
  rateOverride?: number;  // stałe zł/h, nadpisuje wyliczoną stawkę NA STAŁE
  hoursOverride?: number; // ręczne nadpisanie godzin z poprzedniego miesiąca
  salaryOverride?: number; // ręczne nadpisanie kwoty ostatniej wypłaty
  // Miesiące osobiście POTWIERDZONE przez usera (pensja + godziny). Gdy istnieją,
  // szacowana stawka = Σpensja / Σgodziny po nich (uśrednione po miesiącach, którym
  // user ufa), zamiast zgadywania z samej ostatniej wypłaty.
  confirmedMonths?: Record<string, ConfirmedMonth>; // YYYY-MM
  excludedPayMonths?: string[]; // YYYY-MM wyłączone ze średniej liczonej z wypłat
  hidden?: boolean; // wyłączony z ŁĄCZNYCH statystyk (dane zostają, można odkryć z powrotem)
  createdAt: number;
  updatedAt?: number; // synchronizacja (2026-11-13)
}

export const DEFAULT_EMPLOYER_FIELDS: Pick<Employer, 'monthlySalary' | 'hoursPerMonth'> = {
  monthlySalary: 5000,
  hoursPerMonth: 168,
};
