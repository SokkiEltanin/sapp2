import { create } from 'zustand';

// Globalne "Cofnij" (2026-11-14): po usunięciu czegoś pasek na dole przez 6 s
// (components/UndoToast.tsx w app/_layout.tsx). Użycie: offerUndo('Usunięto: Lidl', () => przywróć).
type UndoState = { label: string | null; action: (() => void) | null; id: number };
export const useUndoStore = create<UndoState>(() => ({ label: null, action: null, id: 0 }));

export const UNDO_MS = 6000;
let timer: ReturnType<typeof setTimeout> | null = null;

export function offerUndo(label: string, action: () => void): void {
  if (timer) clearTimeout(timer);
  const id = useUndoStore.getState().id + 1;
  useUndoStore.setState({ label, action, id });
  timer = setTimeout(() => { if (useUndoStore.getState().id === id) dismissUndo(); }, UNDO_MS);
}

export function runUndo(): void {
  const a = useUndoStore.getState().action;
  dismissUndo();
  a?.();
}

export function dismissUndo(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  useUndoStore.setState({ label: null, action: null });
}

type ListStore = { getState: () => any; setState: (p: any) => void };

/**
 * Usunięcie elementu listy z "Cofnij": zdejmuje z `store[key]` i oferuje przywrócenie
 * (to samo id, nowszy updatedAt → synchronizacja odtworzy go też na innych urządzeniach).
 */
export function removeWithUndo<T extends { id: string; updatedAt?: string | number }>(store: ListStore, key: string, item: T, label: string): void {
  store.setState({ [key]: (store.getState()[key] as T[]).filter((x) => x.id !== item.id) });
  offerUndo(label, () => {
    const cur = store.getState()[key] as T[];
    if (cur.some((x) => x.id === item.id)) return;
    const updatedAt = typeof item.updatedAt === 'number' ? Date.now() : new Date().toISOString();
    store.setState({ [key]: [...cur, { ...item, updatedAt }] });
  });
}
