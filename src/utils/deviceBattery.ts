// Bateria urządzeń na Dashboardzie (2026-11-16, user: "paski naładowania urządzeń
// zamiast kafelka Ciekawostek"). Czyste funkcje — kafel i testy.
export interface WatchBattery { level: number; charging: boolean; model: string; t: number }

export function parseWatchBattery(raw: string | null | undefined): WatchBattery | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    const level = Number(j.level);
    if (!Number.isFinite(level) || level < 0 || level > 100) return null;
    return { level: Math.round(level), charging: !!j.charging, model: String(j.model ?? ''), t: Number(j.t) || 0 };
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

