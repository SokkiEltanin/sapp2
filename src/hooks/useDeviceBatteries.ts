import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Battery from 'expo-battery';
import { readWatchBattery, requestWatchBattery, writeWatchBatteryCfg } from '@/services/watchBattery';
import { useThresholdsStore } from '@/store/thresholdsStore';
import type { WatchBattery } from '@/utils/deviceBattery';
import { useDeviceBatteryStore } from '@/store/deviceBatteryStore';

// Baterie na Dashboardzie (2026-11-16): telefon (expo-battery; na komputerze bateria
// laptopa, jeśli przeglądarka ją podaje) + zegarek (plik od WearListenerService).
// Odświeżanie: co minutę, przy powrocie do appki (z prośbą do zegarka) i na żądanie.
type Bat = { level: number; charging: boolean } | null;

// Bateria tego urządzenia. Android: expo-battery (odczyt + nasłuch). Komputer:
// navigator.getBattery (Chrome/Edge; Firefox/Safari — brak → null). Hooki
// expo-battery NIE na web (brak addListener → wywalało Dashboard).
function useOwnBattery(): Bat {
  const [b, setB] = useState<Bat>(null);
  useEffect(() => {
    let alive = true;
    if (Platform.OS === 'web') {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (!nav?.getBattery) return;
      let bat: any = null;
      const upd = () => { if (alive && bat) setB({ level: Math.round(bat.level * 100), charging: !!bat.charging }); };
      nav.getBattery().then((x: any) => { bat = x; upd(); x.addEventListener?.('levelchange', upd); x.addEventListener?.('chargingchange', upd); }).catch(() => {});
      return () => { alive = false; bat?.removeEventListener?.('levelchange', upd); bat?.removeEventListener?.('chargingchange', upd); };
    }
    const read = async () => {
      try {
        const [lvl, st] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync()]);
        if (alive && lvl >= 0) setB({ level: Math.round(lvl * 100), charging: st === Battery.BatteryState.CHARGING || st === Battery.BatteryState.FULL });
      } catch {}
    };
    read();
    const subs: { remove: () => void }[] = [];
    try { subs.push(Battery.addBatteryLevelListener(read), Battery.addBatteryStateListener(read)); } catch {}
    const iv = setInterval(read, 120_000);
    return () => { alive = false; clearInterval(iv); subs.forEach((x) => { try { x.remove(); } catch {} }); };
  }, []);
  return b;
}

export function useDeviceBatteries() {
  const phone = useOwnBattery();
  const [watch, setWatch] = useState<WatchBattery | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const read = useCallback(() => { readWatchBattery().then(setWatch).catch(() => {}); }, []);
  const refresh = useCallback(() => {
    requestWatchBattery();
    timers.current.forEach(clearTimeout);
    timers.current = [setTimeout(read, 2500), setTimeout(read, 7000)];
  }, [read]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    read();
    refresh();
    const iv = setInterval(read, 60_000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => { clearInterval(iv); sub.remove(); timers.current.forEach(clearTimeout); };
  }, [read, refresh]);

  // Telefon → chmura (komputer pokazuje baterię telefonu i zegarka, store/deviceBatteryStore.ts).
  useEffect(() => {
    if (Platform.OS === 'android') useDeviceBatteryStore.getState().report(phone, watch);
  }, [phone?.level, phone?.charging, watch?.t]); // eslint-disable-line react-hooks/exhaustive-deps

  // Komputer: telefon i zegarek z chmury (ostatni odczyt telefonu).
  const remote = useDeviceBatteryStore((st) => (Platform.OS === 'web' ? st : null));
  return {
    phone,
    watch: Platform.OS === 'web' ? remote?.watch ?? null : watch,
    remotePhone: Platform.OS === 'web' ? remote?.phone ?? null : null,
    refresh,
  };
}

/** Próg powiadomienia → plik dla natywnej usługi (raz przy starcie i przy zmianie). */
export function useWatchBatteryCfg() {
  const pct = useThresholdsStore((st) => st.t.watchBatteryPct);
  useEffect(() => { writeWatchBatteryCfg(pct ?? 20).catch(() => {}); }, [pct]);
}
