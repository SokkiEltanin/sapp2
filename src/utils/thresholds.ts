// Progi ustawiane przez usera (2026-11-14, plan "appka modyfikowalna bez programisty"):
// Ustawienia → Ogólne → Progi i przypomnienia. Obiekt modyfikowany W MIEJSCU
// (store/thresholdsStore.ts → applyThresholds), czyste funkcje czytają go przy
// każdym wywołaniu — ten sam wzorzec co kategorie (applyCategoryPrefs).
export interface Thresholds {
  fuelMin: number;        // zł — zakup na stacji poniżej tej kwoty to nie tankowanie (batonik, kawa)
  budgetWarnPct: number;  // % limitu, od którego budżet ostrzega
  reminderHour: number;   // godzina przypomnień o opłatach i wymianach
}

export const DEFAULT_THRESHOLDS: Thresholds = { fuelMin: 30, budgetWarnPct: 80, reminderHour: 9 };
export const THRESHOLDS: Thresholds = { ...DEFAULT_THRESHOLDS };

const clamp = (v: unknown, lo: number, hi: number, def: number) =>
  (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : def);

export function applyThresholds(t: Partial<Thresholds> | null | undefined): Thresholds {
  THRESHOLDS.fuelMin = clamp(t?.fuelMin, 0, 500, DEFAULT_THRESHOLDS.fuelMin);
  THRESHOLDS.budgetWarnPct = clamp(t?.budgetWarnPct, 50, 99, DEFAULT_THRESHOLDS.budgetWarnPct);
  THRESHOLDS.reminderHour = clamp(t?.reminderHour, 5, 22, DEFAULT_THRESHOLDS.reminderHour);
  return { ...THRESHOLDS };
}
