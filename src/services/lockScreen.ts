import { NativeModules } from 'react-native';

// JS most do natywnego `LockScreenModule` (plugins/withFullScreenAlert.js) —
// przełącza "pokaż nad blokadą ekranu" W LOCIE, TYLKO na czas wyświetlania
// app/alert-test.tsx. NIGDY nie włączać tego na stałe/globalnie — wcześniejsza
// wersja ustawiała to jako statyczną flagę manifestu na MainActivity, co
// oznaczało że CAŁA appka (jedna Activity dla całego expo-router) omijała
// blokadę ekranu, nie tylko ekran alarmu (2026-10-30, user: "nie chcę żeby ktoś
// na zablokowanym telefonie mógł [finanse] przeglądać" — realna dziura
// bezpieczeństwa, już naprawiona na poziomie natywnym; ten plik to jedyne
// miejsce które wolno wołać, żeby się nie powtórzyła).
//
// `NativeModules.LockScreen` nie istnieje w Expo Go (custom natywny moduł) ani w
// buildach sprzed tej zmiany — stąd opcjonalne wołanie, cichy no-op zamiast
// crasha.
export function setShowOverLockScreen(enabled: boolean) {
  try {
    NativeModules.LockScreen?.setShowOverLockScreen?.(enabled);
  } catch {
    // brak natywnego modułu — nic nie robimy.
  }
}

// Wybudzenie ekranu na `ms` (wake lock z ACQUIRE_CAUSES_WAKEUP) — ekran alarmu, 2026-11-17.
export function wakeScreen(ms = 30000) {
  try { NativeModules.LockScreen?.wakeScreen?.(ms); } catch { /* brak modułu */ }
}

/** Android 14+: czy appka ma zgodę na pełnoekranowe powiadomienia (null = brak modułu / web). */
export async function canUseFullScreenIntent(): Promise<boolean | null> {
  try {
    const f = NativeModules.LockScreen?.canUseFullScreenIntent;
    return f ? !!(await f()) : null;
  } catch { return null; }
}

export function openFullScreenIntentSettings() {
  try { NativeModules.LockScreen?.openFullScreenIntentSettings?.(); } catch { /* brak modułu */ }
}

// Natywny ekran alarmu (2026-11-18, plugins/withFullScreenAlert.js → AlarmActivity): dane
// zapisane PRZED zaplanowaniem — Activity startuje bez JS (zgaszony ekran / zabita appka).
export const ALARM_ACTIVITY = 'com.sokki.sapp2.AlarmActivity';
export function hasAlarmActivity(): boolean {
  return !!NativeModules.LockScreen?.setAlarmPayload;
}
export function setAlarmPayload(p: { title: string; body?: string; color?: string; sound: boolean; vibrate: boolean; notifId?: string }) {
  try { NativeModules.LockScreen?.setAlarmPayload?.(JSON.stringify(p)); } catch { /* brak modułu */ }
}
