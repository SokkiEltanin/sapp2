import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WatchBattery, BatSample } from '@/utils/deviceBattery';

// Baterie telefonu i zegarka dla KOMPUTERA (2026-11-16, user: "na telefonie jest, ale na
// komputerze nie ma — mam tylko baterię komputera"). Telefon zapisuje tu swoje odczyty
// (hooks/useDeviceBatteries.ts), cloudSync wysyła je jako dokument `devices` (tylko
// telefon pisze, komputer czyta). Zapis tylko przy zmianie poziomu/ładowania albo co
// 10 min — bez spamowania Firestore.
export interface PhoneBattery { level: number; charging: boolean; t: number }
interface DeviceBatteryState {
  phone: PhoneBattery | null;
  watch: WatchBattery | null;
  // Historia (2026-11-17) — z natywnego BatteryLog na telefonie; komputer dostaje z chmury.
  phoneLog: BatSample[];
  watchLog: BatSample[];
  report: (phone: { level: number; charging: boolean } | null, watch: WatchBattery | null) => void;
  setLogs: (phone: BatSample[], watch: BatSample[]) => void;
}
const lastT = (l: BatSample[]) => (l.length ? l[l.length - 1].t : 0);

const TEN_MIN = 10 * 60 * 1000;

export const useDeviceBatteryStore = create<DeviceBatteryState>()(
  persist(
    (set, get) => ({
      phone: null,
      watch: null,
      phoneLog: [],
      watchLog: [],
      setLogs: (phoneLog, watchLog) => {
        const cur = get();
        if (lastT(phoneLog) === lastT(cur.phoneLog) && lastT(watchLog) === lastT(cur.watchLog) && phoneLog.length === cur.phoneLog.length && watchLog.length === cur.watchLog.length) return;
        set({ phoneLog, watchLog });
      },
      report: (phone, watch) => {
        const cur = get();
        const now = Date.now();
        const phoneChanged = !!phone && (!cur.phone || cur.phone.level !== phone.level || cur.phone.charging !== phone.charging || now - cur.phone.t > TEN_MIN);
        const watchChanged = !!watch && (!cur.watch || cur.watch.t !== watch.t);
        if (!phoneChanged && !watchChanged) return;
        set({
          phone: phoneChanged && phone ? { ...phone, t: now } : cur.phone,
          watch: watchChanged ? watch : cur.watch,
        });
      },
    }),
    { name: 'device-battery-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (st) => ({ phone: st.phone, watch: st.watch, phoneLog: st.phoneLog, watchLog: st.watchLog }) },
  ),
);
