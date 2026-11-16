import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WatchBattery } from '@/utils/deviceBattery';

// Baterie telefonu i zegarka dla KOMPUTERA (2026-11-16, user: "na telefonie jest, ale na
// komputerze nie ma — mam tylko baterię komputera"). Telefon zapisuje tu swoje odczyty
// (hooks/useDeviceBatteries.ts), cloudSync wysyła je jako dokument `devices` (tylko
// telefon pisze, komputer czyta). Zapis tylko przy zmianie poziomu/ładowania albo co
// 10 min — bez spamowania Firestore.
export interface PhoneBattery { level: number; charging: boolean; t: number }
interface DeviceBatteryState {
  phone: PhoneBattery | null;
  watch: WatchBattery | null;
  report: (phone: { level: number; charging: boolean } | null, watch: WatchBattery | null) => void;
}

const TEN_MIN = 10 * 60 * 1000;

export const useDeviceBatteryStore = create<DeviceBatteryState>()(
  persist(
    (set, get) => ({
      phone: null,
      watch: null,
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
    { name: 'device-battery-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (st) => ({ phone: st.phone, watch: st.watch }) },
  ),
);
