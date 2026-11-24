// Wzorzec dnia na Dashboardzie (2026-11-24, user zaakceptował: "wzorzec mógłby zmieniać się
// codziennie, a nowy oznaczać jako »nowy«"). Czysta logika — app/(tabs)/index.tsx.
//  • nowy = wzorzec, którego appka wcześniej nie widziała (pierwsze zobaczenie dziś) — ma
//    pierwszeństwo i dostaje plakietkę „nowy”;
//  • inaczej rotacja po dniach, silniejsze częściej (wagi 3, 2, 1, 1, …; lista jest już
//    posortowana od najsilniejszego w computeInsights).
export function dayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

export function pickDailyInsight(ids: string[], day: number, firstSeen: Record<string, string>, today: string): { index: number; isNew: boolean } {
  if (!ids.length) return { index: -1, isNew: false };
  const fresh = ids.findIndex((id) => firstSeen[id] === today);
  if (fresh >= 0) return { index: fresh, isNew: true };
  const weights = ids.map((_, i) => Math.max(1, 3 - i));
  const total = weights.reduce((a, b) => a + b, 0);
  let slot = ((day % total) + total) % total;
  for (let i = 0; i < ids.length; i++) {
    if (slot < weights[i]) return { index: i, isNew: false };
    slot -= weights[i];
  }
  return { index: 0, isNew: false };
}

/** Uzupełnia mapę "pierwszy raz widziany". Pierwsze uruchomienie (pusta mapa) = wszystko
 *  stare (bez wysypu "nowych"); potem każdy nieznany id dostaje dzisiejszą datę. */
export function markSeen(ids: string[], firstSeen: Record<string, string>, today: string, seeded: boolean): Record<string, string> | null {
  const next = { ...firstSeen };
  let changed = false;
  for (const id of ids) if (!next[id]) { next[id] = seeded ? today : '0000-00-00'; changed = true; }
  return changed ? next : null;
}
