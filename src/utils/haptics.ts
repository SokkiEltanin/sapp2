import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Faza 2.6 (2026-11-01) — port z sapp 1:1, uproszczony: sapp miał `appSettings.ts`
// (duży, ogólny store ustawień) — sapp2 nie ma takiego pliku, więc stan "wibracje
// włączone?" jest tu lokalnym, cache'owanym AsyncStorage-flagiem (ten sam wzorzec co
// dawny `ownName.ts`: wczytane raz przy starcie, potem czysta synchroniczna funkcja bez
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

// Siła (2026-11-15, user: "poddodawaj wibracje... bardziej większe uczucie
// haptyczne"). Na Androidzie `Light` z expo-haptics jest ledwo wyczuwalny, więc
// domyślnie 'medium' = tap jako Medium. Zmiana w Ustawieniach → Ogólne.
export type HapticStrength = 'light' | 'medium' | 'strong';
const SKEY = 'haptics_strength_v1';
let strength: HapticStrength = 'medium';
export const HAPTIC_STRENGTH_LABEL: Record<HapticStrength, string> = { light: 'lekka', medium: 'średnia', strong: 'mocna' };
export const getHapticStrength = () => strength;
export async function setHapticStrength(v: HapticStrength): Promise<void> {
  strength = v;
  try { await AsyncStorage.setItem(SKEY, v); } catch {}
}
export async function loadHapticStrength(): Promise<HapticStrength> {
  try {
    const raw = await AsyncStorage.getItem(SKEY);
    if (raw === 'light' || raw === 'medium' || raw === 'strong') strength = raw;
  } catch {}
  return strength;
}

const ok = () => enabled;
const I = Haptics.ImpactFeedbackStyle;
const TAP: Record<HapticStrength, Haptics.ImpactFeedbackStyle> = { light: I.Light, medium: I.Medium, strong: I.Heavy };
const MEDIUM: Record<HapticStrength, Haptics.ImpactFeedbackStyle> = { light: I.Medium, medium: I.Heavy, strong: I.Heavy };

export const haptic = {
  tap: () => ok() && Haptics.impactAsync(TAP[strength]),
  medium: () => ok() && Haptics.impactAsync(MEDIUM[strength]),
  success: () => ok() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => ok() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  warn: () => ok() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
