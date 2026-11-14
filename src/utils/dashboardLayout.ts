// Układ Dashboardu (2026-11-14, plan "appka modyfikowalna bez programisty"): rzędy
// kafli w kolejności usera, z ukrywaniem. Ukryty rząd oddaje miejsce rzędom
// rozciągliwym (notatka, eventy). Czyste funkcje (__tests__/dashboardLayout.test.ts).
export type DashSection = 'top' | 'factWeather' | 'food' | 'note' | 'upcoming';

export const DASH_SECTIONS: { id: DashSection; label: string; hint: string }[] = [
  { id: 'top', label: 'Wymiana i następny event', hint: 'najbliższa wymiana w pojeździe + co za chwilę' },
  { id: 'factWeather', label: 'Ciekawostka i pogoda', hint: 'fakt dnia + pogoda teraz' },
  { id: 'food', label: '#JedzeniePerMiesiąc', hint: 'wydatki na jedzenie, 6 miesięcy' },
  { id: 'note', label: 'Notatka i odliczanie', hint: 'przypięta notatka + odliczanie do eventu' },
  { id: 'upcoming', label: 'Najbliższe eventy', hint: 'kalendarz, terminy zadań, opłaty' },
];
export const DEFAULT_ORDER: DashSection[] = DASH_SECTIONS.map((s) => s.id);

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
