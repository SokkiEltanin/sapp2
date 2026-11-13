// Snapshot Health Connect na JEDEN dzień — tylko 5 metryk, które appka faktycznie
// pokazuje (Dashboard's Sen, Daily's Sen/Kroki/Tętno/Waga/Woda). `null` = brak
// danych tego dnia (user nie miał wpisu / zegarek nie zsynchronizował), NIE "appka
// nie umie tego odczytać" — rozróżnienie ważne dla stanów pustych z DESIGN.md.
export interface HealthDaySnapshot {
  date: string; // YYYY-MM-DD
  steps: number | null;
  sleepMinutes: number | null;
  sleepDeepMin: number | null;
  sleepRemMin: number | null;
  sleepLightMin: number | null;
  sleepAwakeMin: number | null;
  sleepFrom: string | null; // "HH:MM", lokalny czas zaśnięcia
  sleepTo: string | null; // "HH:MM", lokalny czas pobudki
  weightKg: number | null;
  restingHeartRate: number | null;
  hydrationMl: number | null;
  // Przebieg faz nocy (2026-11-13, user: "fazy... wszystkie szczegóły snu") —
  // odcinki z Health Connect dla wybranego źródła, czasy w ms (epoch). Brak w
  // starych snapshotach → optional.
  sleepStages?: SleepStageSpan[];
  sleepStartMs?: number | null;
  sleepEndMs?: number | null;
}

export type SleepStageKind = 'deep' | 'light' | 'rem' | 'awake';
export interface SleepStageSpan { stage: SleepStageKind; start: number; end: number }

export type HealthConnectFailReason = 'no-module' | 'unavailable' | 'update' | 'init' | 'denied' | 'error';
export type HealthConnectResult = { ok: true } | { ok: false; reason: HealthConnectFailReason };
