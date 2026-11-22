// Układ Dashboardu (2026-11-14, plan "appka modyfikowalna bez programisty"): rzędy
// kafli w kolejności usera, z ukrywaniem. Ukryty rząd oddaje miejsce rzędom
// rozciągliwym (notatka, eventy). Czyste funkcje (__tests__/dashboardLayout.test.ts).
export type DashSection = 'top' | 'factWeather' | 'screen' | 'food' | 'note' | 'upcoming';

export const DASH_SECTIONS: { id: DashSection; label: string; hint: string }[] = [
  { id: 'top', label: 'Wymiana i następny event', hint: 'najbliższa wymiana w pojeździe + co za chwilę' },
  { id: 'factWeather', label: 'Baterie i pogoda', hint: 'bateria telefonu i zegarka + pogoda teraz' },
  // 2026-11-22, user: "zamiast #JedzeniePerMiesiąc statystyki użycia aplikacji, włączenia telefonu".
  { id: 'screen', label: 'Czas z telefonem', hint: 'czas w appkach, odblokowania, tydzień' },
  { id: 'note', label: 'Notatka i odliczanie', hint: 'przypięta notatka + odliczanie do eventu' },
  { id: 'upcoming', label: 'Najbliższe eventy', hint: 'kalendarz, terminy zadań, opłaty' },
  { id: 'food', label: '#JedzeniePerMiesiąc', hint: 'wydatki na jedzenie, 6 miesięcy (domyślnie ukryte)' },
];
export const DEFAULT_ORDER: DashSection[] = DASH_SECTIONS.map((s) => s.id);
export const DEFAULT_HIDDEN: DashSection[] = ['food'];

/**
 * Układ zapisany przed 2026-11-22 (wersja 0): "Czas z telefonem" wchodzi na miejsce
 * #JedzeniePerMiesiąc, a jedzenie zostaje ukryte (do włączenia w Ustawieniach → Układ).
 */
export function migrateLayoutV1(st: { order?: unknown; hidden?: unknown }): { order: DashSection[]; hidden: DashSection[] } {
  const order = (Array.isArray(st.order) ? st.order : []).filter((x): x is string => typeof x === 'string');
  const hidden = (Array.isArray(st.hidden) ? st.hidden : []).filter((x): x is string => typeof x === 'string');
  if (order.length && !order.includes('screen')) {
    const i = order.indexOf('food');
    if (i >= 0) order.splice(i, 0, 'screen'); else order.push('screen');
  }
  if (!hidden.includes('food')) hidden.push('food');
  return { order: normalizeOrder(order), hidden: hidden.filter((x) => (DEFAULT_ORDER as string[]).includes(x)) as DashSection[] };
}

/** Kolejność bez duplikatów i nieznanych; brakujące (np. nowa sekcja po aktualizacji) na końcu. */
export function normalizeOrder(order: unknown): DashSection[] {
  const known = new Set<string>(DEFAULT_ORDER);
  const seen = new Set<string>();
  const out: DashSection[] = [];
  for (const id of Array.isArray(order) ? order : []) {
    if (typeof id === 'string' && known.has(id) && !seen.has(id)) { seen.add(id); out.push(id as DashSection); }
  }
  for (const id of DEFAULT_ORDER) if (!seen.has(id)) out.push(id);
  return out;
}

export function moveSection(order: DashSection[], id: DashSection, dir: -1 | 1): DashSection[] {
  const i = order.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const out = order.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function visibleSections(order: DashSection[], hidden: DashSection[]): DashSection[] {
  const h = new Set(hidden);
  return normalizeOrder(order).filter((id) => !h.has(id));
}
