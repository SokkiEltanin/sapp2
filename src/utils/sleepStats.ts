import type { HealthDaySnapshot, SleepStageKind } from '@/types/health';

// Szczegóły snu (2026-11-13, user: "kafelek snu w daily... fazy... po kliknięciu
// wszystkie szczegóły snu, które możemy zebrać"). Czyste wyliczenia z
// HealthDaySnapshot (Health Connect) — UI w Daily + components/health/SleepSheet.
export const SLEEP_GOAL_MIN = 8 * 60;

export const PHASE_META: Record<SleepStageKind, { label: string; norm: [number, number] }> = {
  deep: { label: 'Głęboki', norm: [13, 23] },
  rem: { label: 'REM', norm: [20, 25] },
  light: { label: 'Płytki', norm: [45, 60] },
  awake: { label: 'Wybudzenia', norm: [0, 10] },
};
export const PHASE_ORDER: SleepStageKind[] = ['deep', 'light', 'rem', 'awake'];

export interface PhaseStat { kind: SleepStageKind; min: number; pct: number; status: 'low' | 'ok' | 'high' }
export interface SleepSummary {
  total: number;       // od zaśnięcia do pobudki (min)
  asleep: number;      // bez wybudzeń
  efficiency: number | null; // % snu w czasie w łóżku
  phases: PhaseStat[];
  hasPhases: boolean;
}

export function sleepSummary(s: HealthDaySnapshot): SleepSummary | null {
  if (s.sleepMinutes == null) return null;
  const mins: Record<SleepStageKind, number> = {
    deep: s.sleepDeepMin ?? 0, light: s.sleepLightMin ?? 0, rem: s.sleepRemMin ?? 0, awake: s.sleepAwakeMin ?? 0,
  };
  const staged = PHASE_ORDER.reduce((a, k) => a + mins[k], 0);
  const hasPhases = staged > 0;
  const base = hasPhases ? staged : s.sleepMinutes;
  const phases = PHASE_ORDER.map((kind) => {
    const pct = base > 0 ? Math.round((mins[kind] / base) * 100) : 0;
    const [lo, hi] = PHASE_META[kind].norm;
    return { kind, min: mins[kind], pct, status: (pct < lo ? 'low' : pct > hi ? 'high' : 'ok') as PhaseStat['status'] };
  });
  const asleep = s.sleepMinutes - mins.awake;
  return {
    total: s.sleepMinutes,
    asleep,
    efficiency: hasPhases && s.sleepMinutes > 0 ? Math.round((asleep / s.sleepMinutes) * 100) : null,
    phases,
    hasPhases,
  };
}

const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const fmtClock = (m: number) => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

export interface SleepNight { date: string; minutes: number | null; from: string | null; to: string | null }
export interface SleepWeek {
  nights: SleepNight[];          // 7 dni, najstarszy pierwszy, dziś ostatni
  avgMinutes: number | null;
  avgBedtime: string | null;     // "23:40"
  avgWake: string | null;
  debtMin: number;               // suma braków do 8 h z nocy z danymi
  count: number;
}

export function sleepWeek(history: Record<string, HealthDaySnapshot>, now: Date = new Date()): SleepWeek {
  const nights: SleepNight[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const s = history[keyOf(d)];
    nights.push({ date: keyOf(d), minutes: s?.sleepMinutes ?? null, from: s?.sleepFrom ?? null, to: s?.sleepTo ?? null });
  }
  const withData = nights.filter((n) => n.minutes != null) as (SleepNight & { minutes: number })[];
  const avgMinutes = withData.length ? Math.round(withData.reduce((a, n) => a + n.minutes, 0) / withData.length) : null;
  // Godzina zaśnięcia: przesunięcie o 12 h, żeby 23:30 i 00:30 uśredniły się do 00:00, nie 12:00.
  const beds = withData.filter((n) => n.from).map((n) => (toMin(n.from!) + 720) % 1440);
  const wakes = withData.filter((n) => n.to).map((n) => toMin(n.to!));
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    nights,
    avgMinutes,
    avgBedtime: beds.length ? fmtClock(avg(beds) - 720) : null,
    avgWake: wakes.length ? fmtClock(avg(wakes)) : null,
    debtMin: withData.reduce((a, n) => a + Math.max(0, SLEEP_GOAL_MIN - n.minutes), 0),
    count: withData.length,
  };
}

export const fmtDur = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`;

// "+35 min vs średnia" / "−1h 10m vs średnia" (średnia z innych nocy tygodnia).
export function vsAverage(today: number, week: SleepWeek): string | null {
  const others = week.nights.slice(0, -1).filter((n) => n.minutes != null).map((n) => n.minutes!);
  if (others.length < 2) return null;
  const avg = others.reduce((a, b) => a + b, 0) / others.length;
  const d = Math.round(today - avg);
  if (Math.abs(d) < 10) return 'jak zwykle';
  const abs = Math.abs(d);
  const txt = abs >= 60 ? `${Math.floor(abs / 60)}h ${String(abs % 60).padStart(2, '0')}m` : `${abs} min`;
  return `${d > 0 ? '+' : '−'}${txt} vs tydzień`;
}

// Kolory faz (Daily + SleepSheet) — jak w aplikacjach snu: głęboki ciemny
// indygo → płytki niebieski → REM jasny cyjan, wybudzenia pomarańczowe.
export const PHASE_COLOR: Record<SleepStageKind, string> = {
  deep: '#5B5BD6', light: '#4C8DF6', rem: '#38BDF8', awake: '#F59E0B',
};
