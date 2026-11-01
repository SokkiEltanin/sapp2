import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Faza 2.6 (2026-11-01) — port z sapp 1:1, uproszczony: sapp miał `appSettings.ts`
// (duży, ogólny store ustawień) — sapp2 nie ma takiego pliku, więc stan "wibracje
// włączone?" jest tu lokalnym, cache'owanym AsyncStorage-flagiem (ten sam wzorzec co
// `ownName.ts`: wczytane raz przy starcie, potem czysta synchroniczna funkcja bez
// await w gorącej ścieżce — haptyka musi odpalać się NATYCHMIAST przy tapie, nie po
// odczycie z dysku).
//
// JEDEN globalny przełącznik w Ustawieniach (ARCHITECTURE.md §Ogólne, ustalone
// 2026-10-26: "NIE per-ekran — jeśli jakiś ekran okaże się zbyt »wibrujący«,
// wyciszamy to w kodzie tego ekranu, nie dodajemy osobnego przełącznika w UI").
const KEY = 'haptics_enabled_v1';
let enabled = true; // domyślnie włączone, jak w sapp

export function isHapticsEnabled(): boolean {
  return enabled;
}

export async function setHapticsEnabled(v: boolean): Promise<void> {
  enabled = v;
  try { await AsyncStorage.setItem(KEY, v ? '1' : '0'); } catch {}
}

export async function loadHapticsEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    enabled = raw === null ? true : raw === '1';
  } catch { enabled = true; }
  return enabled;
}

const ok = () => enabled;

export const haptic = {
  tap: () => ok() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => ok() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => ok() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => ok() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  warn: () => ok() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
