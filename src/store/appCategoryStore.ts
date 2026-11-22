import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScreenCat } from '@/utils/screenTime';

// Kategorie appek ustawione przez usera (2026-11-22, user: "oznaczyć aplikacje, które to
// rozrywka, a które nie, bo niektóre może źle łapać"). `cats` = własna kategoria, `fun` =
// rozrywka tak/nie (nadpisuje domyślne: społeczności, wideo, gry). Sync: doc `prefs`.
interface AppCatState {
  cats: Record<string, ScreenCat>;
  fun: Record<string, boolean>;
  setCat: (pkg: string, cat: ScreenCat | null) => void;
  setFun: (pkg: string, fun: boolean | null) => void;
}

const without = <T,>(m: Record<string, T>, k: string) => { const o = { ...m }; delete o[k]; return o; };

export const useAppCategoryStore = create<AppCatState>()(
  persist(
    (set) => ({
      cats: {},
      fun: {},
      setCat: (pkg, cat) => set((st) => ({ cats: cat ? { ...st.cats, [pkg]: cat } : without(st.cats, pkg) })),
      setFun: (pkg, fun) => set((st) => ({ fun: fun == null ? without(st.fun, pkg) : { ...st.fun, [pkg]: fun } })),
    }),
    { name: 'app-categories-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (st) => ({ cats: st.cats, fun: st.fun }) },
  ),
);
