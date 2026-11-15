import { create } from 'zustand';

// Szybkie dodawanie z klawiatury (2026-11-14, komputer): skrót W / Z zgłasza prośbę,
// a ekran Finansów / Zadań (który trzyma swój formularz) ją odbiera i otwiera
// formularz. Prośba czeka, aż ekran się zamontuje (wąskie okno: najpierw nawigacja).
export type QuickAddKind = 'expense' | 'task';
type S = { pending: QuickAddKind | null };
export const useQuickAdd = create<S>(() => ({ pending: null }));

export function requestQuickAdd(kind: QuickAddKind): void {
  useQuickAdd.setState({ pending: kind });
}

/** Ekran odbiera prośbę swojego rodzaju (true = była, już wyczyszczona). */
export function takeQuickAdd(kind: QuickAddKind): boolean {
  if (useQuickAdd.getState().pending !== kind) return false;
  useQuickAdd.setState({ pending: null });
  return true;
}
