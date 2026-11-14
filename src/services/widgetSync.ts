import { NativeModules, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { Task } from '@/types/calendar';
import { buildWidgetSnapshot } from '@/utils/widgetTasks';
import { buildWeatherWidgetSnapshot } from '@/utils/widgetWeather';
import type { WeatherData } from '@/utils/weather';

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

// Widget "Pogoda" (2026-11-13): snapshot po każdym pobraniu pogody w appce;
// współrzędne w snapshocie → natywny provider sam odświeża, gdy appka zamknięta.
const WEATHER_FILE = `${FileSystem.documentDirectory ?? ''}widget_weather.json`;
let lastWeather = '';
export async function syncWeatherWidget(data: WeatherData, lat: number, lon: number): Promise<void> {
  if (Platform.OS !== 'android' || !FileSystem.documentDirectory) return;
  const json = JSON.stringify(buildWeatherWidgetSnapshot(data, lat, lon));
  if (json === lastWeather) return;
  lastWeather = json;
  try {
    await FileSystem.writeAsStringAsync(WEATHER_FILE, json);
    NativeModules.WeatherWidget?.requestUpdate?.();
  } catch { /* dodatek — nigdy nie blokuje appki */ }
}

// Wygląd (Ustawienia → Widget): natywny zapis do SharedPreferences + przemalowanie.
// Osobno dla każdego widgetu (2026-11-14). Stary APK bez WeatherWidget.setAppearance
// — pogoda zostaje przy wspólnym wyglądzie z Zadań, nic się nie wywraca.
export function applyWidgetAppearance(id: 'tasks' | 'weather', look: { bgOpacity: number; bgColor: string; textScale: string }): void {
  if (Platform.OS !== 'android') return;
  const mod = id === 'tasks' ? NativeModules.TasksWidget : NativeModules.WeatherWidget;
  try { mod?.setAppearance?.(look.bgOpacity, look.bgColor, look.textScale); } catch { /* stary APK */ }
}
