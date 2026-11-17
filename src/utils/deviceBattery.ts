// Bateria urządzeń na Dashboardzie (2026-11-16, user: "paski naładowania urządzeń
// zamiast kafelka Ciekawostek"). Czyste funkcje — kafel i testy.
export interface WatchBattery { level: number; charging: boolean; model: string; t: number; temp?: number }

export function parseWatchBattery(raw: string | null | undefined): WatchBattery | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    const level = Number(j.level);
    if (!Number.isFinite(level) || level < 0 || level > 100) return null;
    return { level: Math.round(level), charging: !!j.charging, model: String(j.model ?? ''), t: Number(j.t) || 0, ...(Number.isFinite(Number(j.temp)) && j.temp != null ? { temp: Number(j.temp) } : {}) };
  } catch { return null; }
}

/** "teraz" / "12 min temu" / "3 h temu" / "2 dni temu". */
export function ageLabel(t: number, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - t) / 60000));
  if (min < 2) return 'teraz';
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h temu`;
  return `${Math.round(h / 24)} dni temu`;
}

/** Kolor paska: ładuje = zielony, ≤ próg = czerwony, ≤ próg+15 = pomarańczowy. */
export function batteryTone(level: number, charging: boolean, lowPct: number): 'charge' | 'low' | 'mid' | 'ok' {
  if (charging) return 'charge';
  if (level <= lowPct) return 'low';
  if (level <= lowPct + 15) return 'mid';
  return 'ok';
}


// ── Historia i analiza (2026-11-17, user: "kiedy ostatnio ładowane, temperatura, wykresy,
// zużycie od ostatniego ładowania"). Próbki z natywnego BatteryLog: {t, l, c, tp}.
export interface BatSample { t: number; l: number; c: boolean; tp?: number }

export function parseBatteryLog(raw: string | null | undefined): BatSample[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({ t: Number(x?.t), l: Number(x?.l), c: !!x?.c, ...(Number.isFinite(Number(x?.tp)) && x?.tp != null ? { tp: Number(x.tp) } : {}) }))
      .filter((x) => Number.isFinite(x.t) && x.t > 0 && Number.isFinite(x.l) && x.l >= 0 && x.l <= 100)
      .sort((a, b) => a.t - b.t);
  } catch { return []; }
}

export interface BatteryAnalysis {
  chargedAt: number | null;      // kiedy skończyło się ostatnie ładowanie (null = brak w historii / ładuje)
  chargedTo: number | null;      // do ilu %
  chargingSince: number | null;  // gdy ładuje teraz — od kiedy
  drainPerHour: number | null;   // %/h od końca ładowania (≥ 1 h danych)
  hoursLeft: number | null;      // przy tym tempie do 0%
  sinceCharge: BatSample[];      // próbki od końca ładowania (do wykresu)
  tempNow: number | null;
  tempMax24h: number | null;
}

export function analyzeBattery(samples: BatSample[], now = Date.now()): BatteryAnalysis {
  const out: BatteryAnalysis = { chargedAt: null, chargedTo: null, chargingSince: null, drainPerHour: null, hoursLeft: null, sinceCharge: [], tempNow: null, tempMax24h: null };
  if (!samples.length) return out;
  const last = samples[samples.length - 1];
  const temps = samples.filter((x) => x.tp != null && now - x.t <= 24 * 3600000).map((x) => x.tp!);
  out.tempMax24h = temps.length ? Math.max(...temps) : null;
  out.tempNow = last.tp ?? null;
  if (last.c) {
    let i = samples.length - 1;
    while (i > 0 && samples[i - 1].c) i--;
    out.chargingSince = samples[i].t;
    return out;
  }
  // koniec ostatniego ładowania = pierwsza próbka bez ładowania po ostatniej z ładowaniem
  let k = -1;
  for (let i = samples.length - 1; i >= 0; i--) if (samples[i].c) { k = i; break; }
  const start = k >= 0 ? k + 1 : 0;
  const run = samples.slice(start);
  out.sinceCharge = k >= 0 ? [samples[k], ...run] : run;
  if (k >= 0) { out.chargedAt = samples[k].t; out.chargedTo = Math.max(samples[k].l, run[0]?.l ?? 0); }
  const first = out.sinceCharge[0];
  const hours = (last.t - first.t) / 3600000;
  if (hours >= 1 && first.l > last.l) {
    out.drainPerHour = Math.round(((first.l - last.l) / hours) * 10) / 10;
    out.hoursLeft = out.drainPerHour > 0 ? Math.round((last.l / out.drainPerHour) * 10) / 10 : null;
  }
  return out;
}

/** Temperatura baterii: ok < 38 °C, ciepła 38–42, gorąca > 42. */
export const tempTone = (c: number): 'ok' | 'warm' | 'hot' => (c > 42 ? 'hot' : c >= 38 ? 'warm' : 'ok');
