import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeBatLogs, type WatchBattery, type BatSample } from '@/utils/deviceBattery';

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
  /** Dane z chmury: scalone z lokalnymi (nowszy odczyt wygrywa, historia się sumuje). */
  mergeRemote: (v: { phone?: PhoneBattery | null; watch?: WatchBattery | null; phoneLog?: BatSample[]; watchLog?: BatSample[] }) => void;
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
      // Natywny plik telefonu trzyma ~4 dni — dopisujemy go do dłuższej historii (2026-11-22),
      // zamiast zastępować (pusty plik po reinstalacji nie kasuje już historii, też na komputerze).
      setLogs: (phoneIn, watchIn) => {
        const cur = get();
        const phoneLog = mergeBatLogs(cur.phoneLog, phoneIn);
        const watchLog = mergeBatLogs(cur.watchLog, watchIn);
        if (lastT(phoneLog) === lastT(cur.phoneLog) && lastT(watchLog) === lastT(cur.watchLog) && phoneLog.length === cur.phoneLog.length && watchLog.length === cur.watchLog.length) return;
        set({ phoneLog, watchLog });
      },
      mergeRemote: (v) => {
        const cur = get();
        const newer = <T extends { t: number }>(a: T | null, b: T | null | undefined): T | null => (!b ? a : !a || b.t > a.t ? b : a);
        set({
          phone: newer(cur.phone, v.phone),
          watch: newer(cur.watch, v.watch),
          phoneLog: mergeBatLogs(cur.phoneLog, Array.isArray(v.phoneLog) ? v.phoneLog : []),
          watchLog: mergeBatLogs(cur.watchLog, Array.isArray(v.watchLog) ? v.watchLog : []),
        });
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
