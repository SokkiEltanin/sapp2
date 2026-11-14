// Dziennik błędów (2026-11-14, plan "appka ma sobie poradzić sama") — czysta logika
// (bez AsyncStorage), testowalna. Zapis/przechwytywanie: services/errorLog.ts.

export type ErrorEntry = { t: number; where: string; msg: string; stack?: string; n?: number };

export const ERROR_LOG_MAX = 100;

export function errorText(e: unknown): { msg: string; stack?: string } {
  if (e instanceof Error) return { msg: `${e.name}: ${e.message}`.slice(0, 500), stack: e.stack?.split('\n').slice(0, 8).join('\n') };
  if (typeof e === 'string') return { msg: e.slice(0, 500) };
  try { return { msg: JSON.stringify(e).slice(0, 500) }; } catch { return { msg: String(e).slice(0, 500) }; }
}

/** Nowy wpis na początek; ten sam błąd z tego samego miejsca tuż po poprzednim = licznik, nie duplikat. */
export function pushEntry(list: ErrorEntry[], e: ErrorEntry, max = ERROR_LOG_MAX): ErrorEntry[] {
  const top = list[0];
  if (top && top.where === e.where && top.msg === e.msg && e.t - top.t < 10 * 60 * 1000) {
    return [{ ...top, t: e.t, n: (top.n ?? 1) + 1 }, ...list.slice(1)];
  }
  return [e, ...list].slice(0, max);
}

const pad = (n: number) => String(n).padStart(2, '0');
export function entryTime(t: number): string {
  const d = new Date(t);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Tekst do skopiowania (wklejenia w czat / zgłoszenie). */
export function formatErrorLog(list: ErrorEntry[], header: string): string {
  const lines = [header, `${list.length} wpisów`, ''];
  for (const e of list) {
    lines.push(`[${entryTime(e.t)}] ${e.where}${e.n && e.n > 1 ? ` ×${e.n}` : ''}: ${e.msg}`);
    if (e.stack) lines.push(e.stack.split('\n').map((l) => `    ${l.trim()}`).join('\n'));
  }
  return lines.join('\n');
}
