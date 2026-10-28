import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { User } from 'firebase/auth';
import {
  useFonts,
  Inter_200ExtraLight,
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { colors } from '@/theme/colors';
import { useAuthUser } from '@/hooks/useAuthUser';

// ŚWIADOMIE bez importu @react-native-google-signin/google-signin tutaj — to natywny
// moduł, Expo Go go nie ma, a import na poziomie modułu (nie wołanie funkcji) wywaliłby
// CAŁĄ appkę przy starcie w Expo Go, łącznie z samym podglądem pustych zakładek. Logowanie
// Google importowane jest DYNAMICZNIE, w środku app/login.tsx i app/settings.tsx (test
// Diagnostyki) — więc podgląd zakładek działa w Expo Go, a ekrany logowania/testu po
// prostu grzecznie informują że trzeba dev-clienta, zamiast crashować całą appkę.
// `ErrorBoundary` (łapanie crashy renderu zamiast pustego ekranu produkcyjnego expo-router)
// dorzucimy jak będzie coś realnego do łapania — na pustych zakładkach-zaślepkach nic nie
// ma prawa crashnąć, więc to na razie pominięte świadomie, nie zapomniane.

// Bramka logowania (2026-10-28, user: "wymagaj logowania Google od razu") — appka NIE
// ma anonimowej sesji/fallbacku jak sapp (src/services/firebase.ts tam): bez
// zalogowanego Firebase-usera `userCol`/`userDoc` (src/utils/userData.ts) nie mają gdzie
// pisać, więc żaden ekran poza `/login` nie może być dostępny bez usera. `segments[0]
// === 'login'` rozpoznaje czy user JEST na ekranie logowania (to trasa POZA grupą
// `(tabs)`, więc widoczna w segmentach) — jeden efekt pokrywa oba przekierowania:
// niezalogowany gdzieś poza /login → na /login; zalogowany wciąż na /login (np. wrócił
// gestem "wstecz" po sukcesie) → na /.
function useAuthGate(user: User | null, initializing: boolean) {
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (initializing) return;
    const onLoginScreen = segments[0] === 'login';
    if (!user && !onLoginScreen) router.replace('/login');
    else if (user && onLoginScreen) router.replace('/');
  }, [user, initializing, segments, router]);
}

export default function RootLayout() {
  // Nieblokujące (ten sam wzorzec co w sapp): appka renderuje się natychmiast, komponenty
  // używające fontów Inter dostają je kilka klatek później, zamiast trzymać cały start
  // appki za ekranem ładowania.
  useFonts({
    Inter_200ExtraLight,
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Inter_900Black,
  });

  const { user, initializing } = useAuthUser();
  useAuthGate(user, initializing);

  // W przeciwieństwie do fontów, TEGO jednego czekania appka nie może "ignorować" —
  // pierwszy render musi wiedzieć czy pokazać ekrany, czy /login, inaczej zalogowany
  // user zobaczyłby błysk ekranu logowania (albo odwrotnie: niezalogowany błysk
  // dashboardu) na czas zanim pierwszy `onAuthStateChanged` zdąży odpowiedzieć —
  // zwykle poniżej jednej klatki (odczyt z AsyncStorage), więc krótki spinner tu nie
  // jest realnym kosztem.
  if (initializing) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.primary }}>
          <ActivityIndicator color={colors.text.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.primary } }} />
    </SafeAreaProvider>
  );
}
