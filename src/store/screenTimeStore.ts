import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeScreenDays, type ScreenDay } from '@/utils/screenTime';

// Czas z telefonem (2026-11-22) — dni (90) z modułu UsageStats (services/screenTime.ts).
// Telefon pisze, komputer czyta z chmury (services/cloudSync.ts doc 'screen'). `access` =
// czy Android dał dostęp (null = nie sprawdzono / web).
interface ScreenTimeState {
  days: Record<string, ScreenDay>;
  access: boolean | null;
  t: number; // ostatni odczyt (ms)
  addDays: (d: ScreenDay[]) => void;
  setAccess: (v: boolean) => void;
  mergeRemote: (d: ScreenDay[], t: number) => void;
}

export const useScreenTimeStore = create<ScreenTimeState>()(
  persist(
    (set) => ({
      days: {},
      access: null,
      t: 0,
      addDays: (d) => set((st) => ({ days: mergeScreenDays(st.days, d), t: Math.max(st.t, ...d.map((x) => x.t)) })),
      setAccess: (v) => set({ access: v }),
      // z chmury: scalenie (nowszy odczyt dnia wygrywa), nic nie znika
      mergeRemote: (d, t) => set((st) => ({ days: mergeScreenDays(st.days, d.filter((x) => x && typeof x.date === 'string' && typeof x.t === 'number')), t: Math.max(st.t, t) })),
    }),
    { name: 'screen-time-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (st) => ({ days: st.days, access: st.access, t: st.t }) },
  ),
);

// Ikony appek — osobno i poza kopią zapasową (prefiks "cache-", utils/backupSnapshot.ts):
// da się je zawsze odczytać ponownie z telefonu.
interface IconState { icons: Record<string, string>; addIcons: (m: Record<string, string>) => void }
export const useAppIconsStore = create<IconState>()(
  persist(
    (set) => ({
      icons: {},
      addIcons: (m) => set((st) => {
        const all = { ...st.icons, ...m };
        const keys = Object.keys(all);
        return { icons: keys.length > 150 ? Object.fromEntries(keys.slice(-150).map((k) => [k, all[k]])) : all };
      }),
    }),
    { name: 'cache-app-icons-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (st) => ({ icons: st.icons }) },
  ),
);
