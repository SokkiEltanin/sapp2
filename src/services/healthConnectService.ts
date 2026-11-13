import type { HealthConnectResult } from '@/types/health';
import type { SleepStageSpan, HealthDaySnapshot } from '@/types/health';

// Health Connect — natywny moduł (`react-native-health-connect`, patrz
// `plugins/withHealthConnectQueries.js`), niedostępny w Expo Go. Ten sam wzorzec
// dynamicznego importu co `@react-native-google-signin/google-signin`/`@notifee/
// react-native` gdzie indziej w appce (app/settings.tsx) — ŁADOWANY DOPIERO przy
// wywołaniu funkcji, nigdy na poziomie modułu, żeby podgląd appki w Expo Go/dev
// (gdzie tego modułu nie ma) nie crashował się na starcie. `hc` cache'owany PO
// pierwszym udanym imporcie (moduł się nie zmienia w trakcie życia appki).
let hc: typeof import('react-native-health-connect') | null = null;
let hcLoadAttempted = false;
async function mod(): Promise<typeof import('react-native-health-connect') | null> {
  if (hc) return hc;
  if (hcLoadAttempted) return null;
  hcLoadAttempted = true;
  try {
    hc = await import('react-native-health-connect');
  } catch {
    hc = null;
  }
  return hc;
}

export async function isHealthConnectAvailable(): Promise<boolean> {
  return !!(await mod());
}

const READ_PERMS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'Hydration' },
] as const;

let inited = false;

// Wołana zarówno z przycisku "Połącz" w Ustawieniach (gdzie OK pokazać systemowy
// dialog zgody), JAK I po cichu przy każdym odświeżeniu danych na Dashboard/Daily
// (gdzie zgoda jest już przyznana z poprzedniej sesji — `getGrantedPermissions`
// sprawdza to PRZED wywołaniem `requestPermission`, więc nie wyskakuje dialog
// userowi, który już raz się zgodził).
export async function ensureHealthConnect(): Promise<HealthConnectResult> {
  const lib = await mod();
  if (!lib) return { ok: false, reason: 'no-module' };
  try {
    const status = await lib.getSdkStatus();
    if (status === lib.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return { ok: false, reason: 'update' };
    }
    if (status !== lib.SdkAvailabilityStatus.SDK_AVAILABLE) {
      return { ok: false, reason: 'unavailable' };
    }

    if (!inited) {
      inited = await lib.initialize();
      if (!inited) return { ok: false, reason: 'init' };
    }

    let granted: { recordType: string }[] = [];
    try {
      granted = (await lib.getGrantedPermissions()) as { recordType: string }[];
    } catch {
      granted = [];
    }
    const have = new Set(granted.map((p) => p.recordType));
    if (READ_PERMS.every((p) => have.has(p.recordType))) return { ok: true };

    const res = await lib.requestPermission(READ_PERMS as any);
    return Array.isArray(res) && res.length > 0 ? { ok: true } : { ok: false, reason: 'denied' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function openHealthConnectSettings(): Promise<void> {
  const lib = await mod();
  try {
    lib?.openHealthConnectSettings();
  } catch {
    // brak Health Connect zainstalowanego na telefonie — nic sensownego do zrobienia
  }
}

function dayFilter(date: Date) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);
  return { operator: 'between' as const, startTime: start.toISOString(), endTime: end.toISOString() };
}
function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Konwersje jednostek — surowe rekordy Health Connect v4 trzymają `{value, unit}`
// (NIE `inKilograms`/`inMilliliters` — to osobny kształt zwracany tylko przez
// `aggregateRecord`, którego tu nie używamy, czytamy pojedyncze rekordy wprost).
function massToKg(m: { value: number; unit: string } | undefined): number | null {
  if (!m) return null;
  switch (m.unit) {
    case 'kilograms': return m.value;
    case 'grams': return m.value / 1000;
    case 'milligrams': return m.value / 1e6;
    case 'micrograms': return m.value / 1e9;
    case 'ounces': return m.value * 0.0283495;
    case 'pounds': return m.value * 0.453592;
    default: return m.value;
  }
}
function volumeToMl(v: { value: number; unit: string } | undefined): number {
  if (!v) return 0;
  switch (v.unit) {
    case 'milliliters': return v.value;
    case 'liters': return v.value * 1000;
    case 'fluidOuncesUs': return v.value * 29.5735;
    default: return v.value;
  }
}

function srcOf(r: any): string {
  return typeof r?.metadata?.dataOrigin === 'string' ? r.metadata.dataOrigin : 'unknown';
}

// Kroki: WIELU pisarzy naraz (zegarek + telefon) liczy TE SAME kroki osobno —
// suma wszystkich źródeł by podwajała. Grupuj po źródle, weź MAX pojedynczego
// źródła (nie sumę), tak jak sapp.
function stepsBySourceMax(recs: any[]): number {
  const bySrc = new Map<string, number>();
  for (const r of recs) {
    const src = srcOf(r);
    bySrc.set(src, (bySrc.get(src) ?? 0) + (r.count ?? 0));
  }
  return bySrc.size ? Math.max(...bySrc.values()) : 0;
}

async function read(lib: NonNullable<Awaited<ReturnType<typeof mod>>>, recordType: string, filter: any): Promise<any[]> {
  const res = await lib.readRecords(recordType as any, { timeRangeFilter: filter });
  return Array.isArray((res as any)?.records) ? (res as any).records : [];
}

// Czyta snapshot JEDNEGO dnia. Zakłada że `ensureHealthConnect()` już zwrócił
// `{ok:true}` (uprawnienia przyznane) — ta funkcja sama ich nie prosi.
export async function readHealthDay(date: Date): Promise<HealthDaySnapshot> {
  const empty: HealthDaySnapshot = {
    date: localKey(date), steps: null, sleepMinutes: null, sleepDeepMin: null,
    sleepRemMin: null, sleepLightMin: null, sleepAwakeMin: null, sleepFrom: null, sleepTo: null,
    weightKg: null, restingHeartRate: null, hydrationMl: null,
  };
  const lib = await mod();
  if (!lib) return empty;

  const filter = dayFilter(date);
  const dayKey = localKey(date);

  let steps: number | null = null;
  try { steps = stepsBySourceMax(await read(lib, 'Steps', filter)); } catch { /* brak danych/uprawnień */ }

  let sleepMinutes: number | null = null, sleepDeepMin: number | null = null, sleepRemMin: number | null = null;
  let sleepLightMin: number | null = null, sleepAwakeMin: number | null = null;
  let sleepFrom: string | null = null, sleepTo: string | null = null;
  let sleepStages: SleepStageSpan[] = [];
  let sleepStartMs: number | null = null, sleepEndMs: number | null = null;
  try {
    // Sen kończy się RANO — okno sięga 30h wstecz, żeby złapać sesję zaczętą
    // poprzedniego wieczoru, ale licz go na dzień, w którym się KOŃCZY (budzenie).
    const sleepWin = { operator: 'between' as const, startTime: new Date(date.getTime() - 30 * 3600_000).toISOString(), endTime: filter.endTime };
    const bySrc = new Map<string, { min: number; deep: number; rem: number; light: number; awake: number; start: number; end: number; spans: SleepStageSpan[] }>();
    for (const r of await read(lib, 'SleepSession', sleepWin)) {
      const st = new Date(r.startTime).getTime();
      const en = new Date(r.endTime).getTime();
      if (en <= st || localKey(new Date(en)) !== dayKey) continue;
      const src = srcOf(r);
      const e = bySrc.get(src) ?? { min: 0, deep: 0, rem: 0, light: 0, awake: 0, start: st, end: en, spans: [] };
      e.min += Math.round((en - st) / 60000);
      e.start = Math.min(e.start, st);
      e.end = Math.max(e.end, en);
      for (const stage of (r.stages ?? [])) {
        const ss = new Date(stage.startTime).getTime();
        const se = new Date(stage.endTime).getTime();
        if (se <= ss) continue;
        const mins = Math.round((se - ss) / 60000);
        if (stage.stage === lib.SleepStageType.DEEP) { e.deep += mins; e.spans.push({ stage: 'deep', start: ss, end: se }); }
        else if (stage.stage === lib.SleepStageType.REM) { e.rem += mins; e.spans.push({ stage: 'rem', start: ss, end: se }); }
        else if (stage.stage === lib.SleepStageType.LIGHT) { e.light += mins; e.spans.push({ stage: 'light', start: ss, end: se }); }
        else if (stage.stage === lib.SleepStageType.AWAKE) { e.awake += mins; e.spans.push({ stage: 'awake', start: ss, end: se }); }
      }
      bySrc.set(src, e);
    }
    const best = [...bySrc.values()].reduce(
      (a, b) => (b.min > a.min ? b : a),
      { min: 0, deep: 0, rem: 0, light: 0, awake: 0, start: 0, end: 0, spans: [] as SleepStageSpan[] },
    );
    if (best.min > 0) {
      sleepMinutes = best.min; sleepDeepMin = best.deep; sleepRemMin = best.rem; sleepLightMin = best.light; sleepAwakeMin = best.awake;
      const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
      sleepFrom = hhmm(best.start); sleepTo = hhmm(best.end);
      sleepStages = best.spans.sort((a, b) => a.start - b.start);
      sleepStartMs = best.start; sleepEndMs = best.end;
    }
  } catch { /* brak danych/uprawnień */ }

  let weightKg: number | null = null;
  try {
    const wide = { operator: 'between' as const, startTime: new Date(date.getTime() - 30 * 86400_000).toISOString(), endTime: filter.endTime };
    const recs = await read(lib, 'Weight', wide);
    const w = recs.length ? Math.round(massToKg(recs[recs.length - 1].weight)! * 10) / 10 : null;
    weightKg = Number.isFinite(w as number) ? w : null;
  } catch { /* brak danych/uprawnień */ }

  let restingHeartRate: number | null = null;
  try {
    const wide = { operator: 'between' as const, startTime: new Date(date.getTime() - 7 * 86400_000).toISOString(), endTime: filter.endTime };
    const recs = await read(lib, 'RestingHeartRate', wide);
    restingHeartRate = recs.length ? recs[recs.length - 1].beatsPerMinute ?? null : null;
  } catch { /* brak danych/uprawnień */ }

  let hydrationMl: number | null = null;
  try {
    const recs = await read(lib, 'Hydration', filter);
    hydrationMl = recs.length ? Math.round(recs.reduce((s, r) => s + volumeToMl(r.volume), 0)) : null;
  } catch { /* brak danych/uprawnień */ }

  return {
    date: dayKey, steps, sleepMinutes, sleepDeepMin, sleepRemMin, sleepLightMin, sleepAwakeMin, sleepFrom, sleepTo,
    weightKg, restingHeartRate, hydrationMl, sleepStages, sleepStartMs, sleepEndMs,
  };
}


// ── Diagnostyka: wszystko, co łapiemy (2026-11-13, user: "w ustawieniach test
// wszystkiego, co łapię z zegarka, z Health Connect... do skopiowania, żebyśmy
// mieli jakąś bazę"). Prosi o odczyt WSZYSTKICH sensownych typów (każdy musi być
// też w app.json android.permissions — CLAUDE.md zasada 2), czyta ostatnie 7 dni
// i zwraca raport: ile rekordów, z jakich aplikacji (Samsung Health, zegarek…),
// przykładowe rekordy. Samsung Health/Galaxy Watch są widoczne TYLKO przez Health
// Connect (tam, gdzie Samsung Health synchronizuje).
export const DIAG_RECORD_TYPES = [
  'Steps', 'Distance', 'FloorsClimbed', 'ElevationGained', 'ActiveCaloriesBurned', 'TotalCaloriesBurned',
  'BasalMetabolicRate', 'ExerciseSession', 'Speed', 'SleepSession', 'HeartRate', 'RestingHeartRate',
  'HeartRateVariabilityRmssd', 'OxygenSaturation', 'RespiratoryRate', 'Vo2Max', 'BloodPressure',
  'BloodGlucose', 'BodyTemperature', 'Weight', 'Height', 'BodyFat', 'BodyWaterMass', 'LeanBodyMass',
  'BoneMass', 'Hydration', 'Nutrition',
] as const;

export interface DiagTypeResult {
  type: string;
  granted: boolean;
  count: number;
  origins: Record<string, number>;
  first?: string; // ISO najstarszego
  last?: string;  // ISO najnowszego
  samples: unknown[];
  error?: string;
}
export interface HealthDiagReport {
  at: string;
  sdk: string;
  days: number;
  types: DiagTypeResult[];
}

function slim(r: any): unknown {
  // Bez długich tablic (np. samples HeartRate po kilkaset) — tylko początek.
  const out: any = {};
  for (const [k, v] of Object.entries(r ?? {})) {
    if (k === 'metadata') { out.origin = (v as any)?.dataOrigin; out.device = (v as any)?.device; continue; }
    if (Array.isArray(v)) { out[k] = v.slice(0, 3); if (v.length > 3) out[`${k}Count`] = v.length; continue; }
    out[k] = v;
  }
  return out;
}

export async function healthDiagnostics(days = 7): Promise<HealthDiagReport> {
  const lib = await mod();
  const report: HealthDiagReport = { at: new Date().toISOString(), sdk: 'brak modułu', days, types: [] };
  if (!lib) return report;
  try {
    const st = await lib.getSdkStatus();
    report.sdk = st === lib.SdkAvailabilityStatus.SDK_AVAILABLE ? 'dostępny' : `status ${st}`;
    if (st !== lib.SdkAvailabilityStatus.SDK_AVAILABLE) return report;
    if (!inited) inited = await lib.initialize();
  } catch (e: any) {
    report.sdk = `błąd: ${String(e?.message ?? e)}`;
    return report;
  }
  const perms = DIAG_RECORD_TYPES.map((t) => ({ accessType: 'read' as const, recordType: t }));
  try { await lib.requestPermission(perms as any); } catch { /* część typów może być nieobsługiwana — czytamy, co się da */ }
  let granted = new Set<string>();
  try { granted = new Set(((await lib.getGrantedPermissions()) as any[]).filter((p) => p.accessType === 'read').map((p) => p.recordType)); } catch { /* */ }
  const filter = { operator: 'between' as const, startTime: new Date(Date.now() - days * 86400_000).toISOString(), endTime: new Date().toISOString() };
  for (const type of DIAG_RECORD_TYPES) {
    const res: DiagTypeResult = { type, granted: granted.has(type), count: 0, origins: {}, samples: [] };
    if (res.granted) {
      try {
        const recs = await read(lib, type, filter);
        res.count = recs.length;
        for (const r of recs) {
          const o = r?.metadata?.dataOrigin ?? '?';
          res.origins[o] = (res.origins[o] ?? 0) + 1;
        }
        const times = recs.map((r: any) => r.time ?? r.startTime).filter(Boolean).sort();
        res.first = times[0]; res.last = times[times.length - 1];
        res.samples = recs.slice(-2).map(slim);
      } catch (e: any) {
        res.error = String(e?.message ?? e);
      }
    }
    report.types.push(res);
  }
  return report;
}
