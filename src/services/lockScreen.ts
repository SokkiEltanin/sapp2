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
