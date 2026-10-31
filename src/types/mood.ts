// Port z sapp (src/types/index.ts) 1:1 — model nastroju jest już dobrze zaprojektowany
// (circumplex: nastrój=walencja, energia=pobudzenie) i kategorio-niezależny, zero redesignu
// potrzebne. User (2026-10-31): "dodawanie humoru (jeden raz potem drugi raz dziennie...)" —
// `MoodEntry[]` jest płaską listą, NIE ma limitu wpisów/dzień (sapp też nie ma) — UI
// (MoodModal.tsx) sam odlicza "ile już dziś" i tytułuje kolejne wpisy "Humor 2. raz dziś" itd,
// co naturalnie realizuje "raz, potem drugi raz".
export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export interface MoodEntry {
  id: string;
  date: string;        // YYYY-MM-DD
  mood: MoodLevel;      // 1=fatalnie, 5=świetnie (walencja)
  energy: MoodLevel;    // 1=bez energii, 5=pełna energia (pobudzenie)
  note?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export const MOOD_LABELS: Record<MoodLevel, string> = {
  1: 'Fatalnie', 2: 'Słabo', 3: 'Tak sobie', 4: 'Dobrze', 5: 'Świetnie',
};
export const MOOD_COLORS: Record<MoodLevel, string> = {
  1: '#6B7280', 2: '#FF6B6B', 3: '#FBBF24', 4: '#4ECBA8', 5: '#6C9EFF',
};
export const ENERGY_LABELS: Record<MoodLevel, string> = {
  1: 'Bez energii', 2: 'Niska', 3: 'Średnia', 4: 'Dobra', 5: 'Pełna energia',
};
export const ENERGY_COLORS: Record<MoodLevel, string> = {
  1: '#374151', 2: '#6B7280', 3: '#6C9EFF', 4: '#4ECBA8', 5: '#FBBF24',
};
export const MOOD_EMOJIS: Record<MoodLevel, string> = { 1: '😩', 2: '😕', 3: '😐', 4: '😊', 5: '🤩' };
export const ENERGY_EMOJIS: Record<MoodLevel, string> = { 1: '😴', 2: '😌', 3: '⚡', 4: '✨', 5: '🚀' };
