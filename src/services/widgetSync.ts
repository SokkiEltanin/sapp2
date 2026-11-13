import { NativeModules, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { Task } from '@/types/calendar';
import { buildWidgetSnapshot } from '@/utils/widgetTasks';

// Widget pulpitu "Zadania" (2026-11-13, port z sapp) — plik-jako-most: JS pisze
// snapshot do filesDir (= FileSystem.documentDirectory), natywny provider go czyta.
// `NativeModules.TasksWidget` istnieje dopiero w APK zbudowanym z
// plugins/withTasksWidget.js — `?.` jest obowiązkowe (web/stary build = no-op).
const FILE = `${FileSystem.documentDirectory ?? ''}widget_tasks.json`;
let lastWritten = '';

export async function syncTasksWidget(tasks: Task[]): Promise<void> {
  if (Platform.OS !== 'android' || !FileSystem.documentDirectory) return;
  const json = JSON.stringify(buildWidgetSnapshot(tasks));
  if (json === lastWritten) return;
  lastWritten = json;
  try {
    await FileSystem.writeAsStringAsync(FILE, json);
    NativeModules.TasksWidget?.requestUpdate?.();
  } catch { /* widget to dodatek — nigdy nie blokuje appki */ }
}

// Wygląd (Ustawienia → Widget): natywny zapis do SharedPreferences + przemalowanie.
export function applyWidgetAppearance(opacity: number, color: string, textScale: string): void {
  if (Platform.OS !== 'android') return;
  try { NativeModules.TasksWidget?.setAppearance?.(opacity, color, textScale); } catch { /* stary APK */ }
}
