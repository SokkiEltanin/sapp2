// Port z sapp (src/types/index.ts) 1:1 — model nastroju jest już dobrze zaprojektowany
// (circumplex: nastrój=walencja, energia=pobudzenie) i kategorio-niezależny, zero redesignu
// potrzebne. User (2026-10-31): "dodawanie humoru (jeden raz potem drugi raz dziennie...)" —
// `MoodEntry[]` jest płaską listą, NIE ma limitu wpisów/dzień (sapp też nie ma) — UI
// (MoodModal.tsx) sam odlicza "ile już dziś" i tytułuje kolejne wpisy "Humor 2. raz dziś" itd,
// co naturalnie realizuje "raz, potem drugi raz".
export type MoodLevel = 1 | 2 | 3 | 4 | 5;

// `mood`/`energy` NIE SĄ już ograniczone do `MoodLevel` (2026-11-04, user: "humor musi być
// smooth a nie punktowy... liczy się w procentach... 0,0 na środku i droga to promień w
// każdym kierunku") — `MoodPad` kwantyzowało przeciąganie do siatki 5×5, user chciał
// płynne/ciągłe śledzenie palca. Zasięg (1..5) BEZ ZMIAN — stare, całkowitoliczbowe wpisy
// są po prostu szczególnym przypadkiem continuous value, więc żadnej migracji danych nie
// trzeba. `MoodLevel` żyje dalej TYLKO jako klucz do `MOOD_COLORS`/`MOOD_LABELS` itp. —
// każde miejsce wyświetlające kolor/etykietę z continuous wartości musi przejść przez
// `roundLevel()` poniżej.
export interface MoodEntry {
  id: string;
  date: string;        // YYYY-MM-DD
  mood: number;         // 1..5 continuous, 1=fatalnie, 5=świetnie (walencja)
  energy: number;       // 1..5 continuous, 1=bez energii, 5=pełna energia (pobudzenie)
  note?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export function roundLevel(value: number): MoodLevel {
  return Math.min(5, Math.max(1, Math.round(value))) as MoodLevel;
}

export const MOOD_LABELS: Record<MoodLevel, string> = {
  1: 'Fatalnie', 2: 'Słabo', 3: 'Tak sobie', 4: 'Dobrze', 5: 'Świetnie',
};
// Kolor = PRZYJEMNOŚĆ (2026-11-12, user: "w dodawaniu humoru kolor to
// przyjemność a energia to wielkość gradientu") — czerwień → pomarańcz → żółty
// → limonka → zieleń. Wcześniej kolor kropki szedł z ENERGII (a paleta była
// przypadkowa: szary/czerwony/żółty/morski/niebieski). Energia nie ma już
// koloru — wyraża się WIELKOŚCIĄ poświaty, patrz `energyGlow` niżej.
export const MOOD_COLORS: Record<MoodLevel, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#FBBF24', 4: '#A3E635', 5: '#22C55E',
};

const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// Płynny kolor dla CIĄGŁEJ wartości 1..5 (pad jest ciągły) — interpolacja
// między sąsiednimi stopniami `MOOD_COLORS`.
export function moodColor(mood: number): string {
  const v = Math.min(5, Math.max(1, mood));
  const lo = Math.floor(v) as MoodLevel;
  const hi = Math.min(5, lo + 1) as MoodLevel;
  const t = v - lo;
  const a = hexToRgb(MOOD_COLORS[lo]);
  const b = hexToRgb(MOOD_COLORS[hi]);
  return '#' + a.map((x, i) => Math.round(x + (b[i] - x) * t).toString(16).padStart(2, '0')).join('');
}

// Energia → 0..1 (rozmiar/jasność poświaty pod kropką).
export function energyGlow(energy: number): number {
  return (Math.min(5, Math.max(1, energy)) - 1) / 4;
}
export const ENERGY_LABELS: Record<MoodLevel, string> = {
  1: 'Bez energii', 2: 'Niska', 3: 'Średnia', 4: 'Dobra', 5: 'Pełna energia',
};
export const ENERGY_COLORS: Record<MoodLevel, string> = {
  1: '#374151', 2: '#6B7280', 3: '#6C9EFF', 4: '#4ECBA8', 5: '#FBBF24',
};
export const MOOD_EMOJIS: Record<MoodLevel, string> = { 1: '😩', 2: '😕', 3: '😐', 4: '😊', 5: '🤩' };
export const ENERGY_EMOJIS: Record<MoodLevel, string> = { 1: '😴', 2: '😌', 3: '⚡', 4: '✨', 5: '🚀' };
