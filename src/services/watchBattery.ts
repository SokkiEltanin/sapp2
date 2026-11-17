import { NativeModules, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { parseWatchBattery, parseBatteryLog, type WatchBattery, type BatSample } from '@/utils/deviceBattery';

// Bateria zegarka po stronie telefonu (2026-11-16). Natywny WearListenerService
// (plugins/withWearSync.js) zapisuje wear_battery.json przy każdym raporcie zegarka i
// sam wysyła powiadomienie poniżej progu — próg i włącznik bierze z
// wear_battery_cfg.json, który zapisuje tu JS (Ustawienia → Progi).
const DIR = FileSystem.documentDirectory ?? '';
const FILE = `${DIR}wear_battery.json`;
const CFG = `${DIR}wear_battery_cfg.json`;

export async function readWatchBattery(): Promise<WatchBattery | null> {
  if (Platform.OS !== 'android' || !DIR) return null;
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return null;
    return parseWatchBattery(await FileSystem.readAsStringAsync(FILE));
  } catch { return null; }
}

/** Poproś zegarek o świeży stan (odpowiedź po 1–3 s trafia do pliku). */
export function requestWatchBattery(): void {
  try { NativeModules.WearSync?.requestBattery?.(); } catch {}
}

export async function writeWatchBatteryCfg(lowPct: number, notify = true): Promise<void> {
  if (Platform.OS !== 'android' || !DIR) return;
  try { await FileSystem.writeAsStringAsync(CFG, JSON.stringify({ lowPct, notify })); } catch {}
}

// Historia baterii (2026-11-17) — natywny BatteryLog (plugins/withWearSync.js) dopisuje
// zegarek przy każdym jego raporcie (~15 min) i przy okazji telefon (z temperaturą).
export async function readBatteryLogs(): Promise<{ phone: BatSample[]; watch: BatSample[] }> {
  if (Platform.OS !== 'android' || !DIR) return { phone: [], watch: [] };
  const read = async (name: string) => {
    try {
      const f = `${DIR}${name}`;
      if (!(await FileSystem.getInfoAsync(f)).exists) return [];
      return parseBatteryLog(await FileSystem.readAsStringAsync(f));
    } catch { return []; }
  };
  const [phone, watch] = await Promise.all([read('battery_log_phone.json'), read('battery_log_watch.json')]);
  return { phone, watch };
}

/** Dopisz bieżący stan baterii telefonu do historii (z temperaturą). */
export function samplePhoneBattery(): void {
  try { NativeModules.WearSync?.samplePhone?.(); } catch {}
}
