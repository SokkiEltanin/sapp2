import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyCategoryPrefs, resolveCategories, newTag, okey, EMPTY_CATEGORY_PREFS,
  type CategoryPrefs, type CatKind,
} from '@/utils/categoryRegistry';

// Kategorie edytowalne w Ustawieniach (2026-11-14) — patrz utils/categoryRegistry.ts.
// `version` rośnie przy każdej zmianie: ekrany z listami kategorii subskrybują ją,
// żeby odświeżyć się po zmianie nazwy/koloru. Synchronizowane w dokumencie `prefs`.
interface CategoriesState {
  prefs: CategoryPrefs;
  version: number;
  rename: (kind: CatKind, tag: string, label: string) => void;
  recolor: (kind: CatKind, tag: string, color: string) => void;
  setHidden: (kind: CatKind, tag: string, hidden: boolean) => void;
  add: (kind: CatKind, label: string, color: string) => string;
  removeCustom: (kind: CatKind, tag: string) => void;
  setPrefs: (prefs: CategoryPrefs) => void;
}

const patch = (prefs: CategoryPrefs, kind: CatKind, tag: string, o: Record<string, unknown>): CategoryPrefs => ({
  ...prefs, overrides: { ...prefs.overrides, [okey(kind, tag)]: { ...prefs.overrides[okey(kind, tag)], ...o } },
});

export const useCategoriesStore = create<CategoriesState>()(
  persist(
    (set, get) => ({
      prefs: EMPTY_CATEGORY_PREFS,
      version: 0,
      rename: (kind, tag, label) => set((st) => ({ prefs: patch(st.prefs, kind, tag, { label }) })),
      recolor: (kind, tag, color) => set((st) => ({ prefs: patch(st.prefs, kind, tag, { color }) })),
      setHidden: (kind, tag, hidden) => set((st) => ({ prefs: patch(st.prefs, kind, tag, { hidden }) })),
      add: (kind, label, color) => {
        const tag = newTag(label, resolveCategories(get().prefs, kind).map((c) => c.tag));
        set((st) => ({ prefs: { ...st.prefs, added: { ...st.prefs.added, [kind]: [...(st.prefs.added[kind] ?? []), { tag, label: label.trim(), color }] } } }));
        return tag;
      },
      removeCustom: (kind, tag) => set((st) => {
        const overrides = { ...st.prefs.overrides };
        delete overrides[okey(kind, tag)];
        return { prefs: { added: { ...st.prefs.added, [kind]: (st.prefs.added[kind] ?? []).filter((c) => c.tag !== tag) }, overrides } };
      }),
      setPrefs: (prefs) => set({ prefs }),
    }),
    {
      name: 'categories-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (st) => ({ prefs: st.prefs }),
      onRehydrateStorage: () => (st) => { if (st) { applyCategoryPrefs(st.prefs); useCategoriesStore.setState({ version: st.version + 1 }); } },
    },
  ),
);

// Każda zmiana preferencji → odtworzenie list/słowników w miejscu + nowa wersja.
useCategoriesStore.subscribe((s, p) => {
  if (s.prefs === p.prefs) return;
  applyCategoryPrefs(s.prefs);
  useCategoriesStore.setState({ version: s.version + 1 });
});

export const useCategoriesVersion = () => useCategoriesStore((st) => st.version);
