// Strażnik appki (2026-11-25, user: "samowystarczalna na długo"): raz na kilka godzin appka sama
// sprawdza Stan appki (utils/appHealth.ts) i JEDNYM powiadomieniem mówi, gdy coś stoi od dłużej —
// bez szumu: problem musi trwać ≥ 2 dni, a o tym samym przypomina najwyżej co 3 dni. Czysta logika.
import type { HealthRow } from './appHealth';

const DAY = 86_400_000;
// Co strażnik zgłasza (reszta — np. "nowy APK", błędy z ostatniej doby — zostaje tylko w Stanie appki).
const WATCH = new Set(['sync', 'cloud', 'file', 'bankCapture', 'background', 'storage']);

export interface GuardianState { since: Record<string, number>; notified: Record<string, number> }

export function guardianDecide(rows: HealthRow[], st: GuardianState, now: number): { notify: HealthRow[]; next: GuardianState } {
  const since: Record<string, number> = {};
  const notified: Record<string, number> = { ...st.notified };
  const notify: HealthRow[] = [];
  for (const r of rows) {
    if (!WATCH.has(r.key) || r.level === 'ok') { delete notified[r.key]; continue; }
    // "wyłączona" synchronizacja / brak folderu kopii to świadomy wybór — nie zgłaszamy.
    if (r.key === 'sync' && r.detail === 'wyłączona') continue;
    if (r.key === 'file' && r.detail === 'nie ustawiona') continue;
    since[r.key] = st.since[r.key] ?? now;
    const longEnough = now - since[r.key] >= 2 * DAY || r.level === 'bad' && r.key === 'storage';
    const quiet = !notified[r.key] || now - notified[r.key] >= 3 * DAY;
    if (longEnough && quiet) { notify.push(r); notified[r.key] = now; }
  }
  return { notify, next: { since, notified } };
}

/** Treść powiadomienia: jedno zdanie na problem, max 3. */
export function guardianText(rows: HealthRow[]): { title: string; body: string } {
  const lines = rows.slice(0, 3).map((r) => `${r.label}: ${r.detail}${r.fix ? ` — ${r.fix}` : ''}`);
  return { title: rows.length === 1 ? 'Sapp: coś wymaga uwagi' : `Sapp: ${rows.length} rzeczy wymaga uwagi`, body: lines.join('\n') };
}
