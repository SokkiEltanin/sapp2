// Skróty klawiszowe na komputerze (2026-11-14). Czysta decyzja "klawisz → akcja"
// (testy: __tests__/desktopShortcuts.test.ts); podpięcie: hooks/useDesktopShortcuts.ts.
export type ShortcutAction =
  | { kind: 'go'; href: '/' | '/finances' | '/tasks' | '/daily' | '/search' | '/settings' | '/notes' }
  | { kind: 'back' };

export interface KeyInfo { key: string; ctrl: boolean; meta: boolean; alt: boolean; typing: boolean }

export const SHORTCUT_HELP: [string, string][] = [
  ['1 – 4', 'Dashboard / Finanse / Zadania / Daily'],
  ['/ albo Ctrl+K', 'Szukaj'],
  ['N', 'Notatki'],
  [',', 'Ustawienia'],
  ['Esc', 'Zamknij panel / wstecz'],
];

const TABS = ['/', '/finances', '/tasks', '/daily'] as const;

export function shortcutFor(k: KeyInfo): ShortcutAction | null {
  if ((k.ctrl || k.meta) && k.key.toLowerCase() === 'k') return { kind: 'go', href: '/search' };
  if (k.key === 'Escape') return k.typing ? null : { kind: 'back' };
  // Pisanie w polu tekstowym albo skróty przeglądarki — nie przechwytujemy.
  if (k.typing || k.ctrl || k.meta || k.alt) return null;
  if (k.key >= '1' && k.key <= '4') return { kind: 'go', href: TABS[Number(k.key) - 1] };
  if (k.key === '/') return { kind: 'go', href: '/search' };
  if (k.key === ',') return { kind: 'go', href: '/settings' };
  if (k.key.toLowerCase() === 'n') return { kind: 'go', href: '/notes' };
  return null;
}
