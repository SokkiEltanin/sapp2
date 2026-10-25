import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';

// ŚWIADOMIE bez importu @react-native-google-signin/google-signin tutaj — to natywny
// moduł, Expo Go go nie ma, a import na poziomie modułu (nie wołanie funkcji) wywaliłby
// CAŁĄ appkę przy starcie w Expo Go, łącznie z samym podglądem pustych zakładek. Logowanie
// Google importowane jest DYNAMICZNIE, dopiero w środku ekranu Ustawień (patrz
// app/settings.tsx) — więc podgląd 5 zakładek działa w Expo Go, a Ustawienia po prostu
// grzecznie informują że trzeba dev-clienta, zamiast crashować całą appkę.
// `ErrorBoundary` (łapanie crashy renderu zamiast pustego ekranu produkcyjnego expo-router)
// dorzucimy jak będzie coś realnego do łapania — na pustych zakładkach-zaślepkach nic nie
// ma prawa crashnąć, więc to na razie pominięte świadomie, nie zapomniane.

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.primary } }} />
    </SafeAreaProvider>
  );
}
