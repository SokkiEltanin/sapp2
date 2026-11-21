import { NativeModules, Platform } from 'react-native';
import type { Task, CalendarEvent } from '@/types/calendar';
import { buildWearSnapshot, type WearExtras } from '@/utils/wearSnapshot';

// Zegarek Wear OS (2026-11-14): snapshot → WearSync.push (plugins/withWearSync.js).
// Bez zegarka / stary APK / web = no-op. Wysyłane tylko przy zmianie treści.
let last = '';
export function syncWear(tasks: Task[], events: CalendarEvent[], extras: WearExtras = {}): void {
  if (Platform.OS !== 'android' || !NativeModules.WearSync?.push) return;
  const snap = buildWearSnapshot(tasks, events, new Date(), extras);
  const key = JSON.stringify({ ...snap, t: 0 });
  if (key === last) return;
  last = key;
  try { NativeModules.WearSync.push(JSON.stringify(snap)); } catch { /* dodatek */ }
}
