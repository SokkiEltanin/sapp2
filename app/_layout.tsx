import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, AppState, Dimensions, Image } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { User } from 'firebase/auth';
import {
  useFonts,
  Inter_200ExtraLight,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { colors } from '@/theme/colors';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useNotifeeAlertLaunch } from '@/hooks/useNotifeeAlertLaunch';
import { useShareReceiptLaunch } from '@/hooks/useShareReceiptLaunch';
import { loadOwnName } from '@/utils/ownName';
import { loadHapticsEnabled } from '@/utils/haptics';
import { drainBankNotifications } from '@/services/bankNotificationDrain';
import { useExpensesStore } from '@/store/expensesStore';

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
// Samochodowa siatka (Screen/Row/Tile w src/ui/layout.tsx) już liczy kolumny z
// reaktywnego `useWindowDimensions()`, co POWINNO wystarczyć — ale user zgłosił
// (2026-11-03, zrzut z Samsunga): po wejściu w split-screen layout się rozjechał
// (kafle ucięte poza ekranem) i NIE WRÓCIŁO do normy nawet po pełnym zamknięciu i
// ponownym otwarciu appki. To wygląda na znany bug Androida (głównie Samsung One
// UI) — system "zapamiętuje" geometrię okna z multi-window dla danego taska i
// aplikuje ją do KOLEJNEGO uruchomienia, więc nawet świeża instancja appki dostaje
// od Androida BŁĘDNE wymiary okna od samego startu (to nie jest "React nie
// zauważył zmiany", to "Android podaje złą liczbę") — żaden kod JS tego nie
// naprawi, bo wejściowe dane są złe, nie samo ich przetworzenie.
// To co appka MOŻE zrobić: nasłuchiwać `Dimensions`'owego eventu 'change' (NIE
// tylko polegać na samym `useWindowDimensions()` — udokumentowany na innych
// urządzeniach przypadek gdzie ten hook czasem nie łapie zmiany przy wejściu/
// wyjściu z multi-window) i wymusić PEŁNY remount drzewa ekranów za każdym razem
// gdy wymiary faktycznie się zmienią — więc jeśli/gdy Android w końcu sam sobie
// poprawi zapamiętaną geometrię (kolejne przełączenie multi-window, restart
// telefonu), appka złapie to NATYCHMIAST zamiast zostać zamrożona na starej,
// błędnej wartości do następnego pełnego restartu appki. `AppState`-owy trigger
// (każde wejście na pierwszy plan) ŚWIADOMIE pominięty — remontowałby cały stack
// nawigacji (gubiąc scroll/stan ekranów) przy KAŻDYM zwykłym przełączeniu appek,
// nie tylko przy realnej zmianie rozmiaru.
function useRemountOnDimensionChange(): number {
  const [key, setKey] = useState(0);
  const last = useRef(Dimensions.get('window'));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      if (window.width !== last.current.width || window.height !== last.current.height) {
        last.current = window;
        setKey((k) => k + 1);
      }
    });
    return () => sub.remove();
  }, []);
  return key;
}

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
    // 600/800 (Faza 3.1, design/app-design.html) — nowy komponent-system (Tile/Row/
    // Tag/Segmented) używa ich jako osobnych wag od 500/700/900, nie zamiennie.
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  const { user, initializing } = useAuthUser();
  useAuthGate(user, initializing);
  const dimensionKey = useRemountOnDimensionChange();
  // Deep-link z pełnoekranowego alertu notifee na dedykowany ekran alarmu (patrz
  // app/alert-test.tsx) — patrz komentarz w src/hooks/useNotifeeAlertLaunch.ts.
  useNotifeeAlertLaunch();

  // Udostępnij paragon przez Android Share Sheet (2026-11-09, user: "a zrobisz jak w
  // sapp udostępnianie paragonu po share?") — patrz komentarz w
  // src/hooks/useShareReceiptLaunch.ts.
  useShareReceiptLaunch();

  // Faza 2.5 (2026-11-01) — własne imię+nazwisko do wykrywania przelewów do siebie
  // (bankNotification.ts's `selfTransfer`), wczytane raz przy starcie.
  useEffect(() => { loadOwnName().catch(() => {}); }, []);

  // Faza 2.6 (2026-11-01) — globalny przełącznik wibracji (utils/haptics.ts), wczytany
  // raz przy starcie tak samo jak własne imię wyżej.
  useEffect(() => { loadHapticsEnabled().catch(() => {}); }, []);

  // Osusza powiadomienia z banku przechwycone przez natywny nasłuch
  // (plugins/withBankNotificationListener.js) podczas gdy appka była zamknięta/w tle —
  // przy zimnym starcie + za każdym wejściem na pierwszy plan. Zakolejkowane pozycje są
  // potem auto-zatwierdzane (zaufani sprzedawcy) albo czekają na ręczny przegląd
  // (app/bank-review.tsx). Drenaż, POTEM auto-commit — ale tylko gdy `expenses` już są
  // załadowane (dopasowywanie do istniejących wydatków inaczej nie ma czego porównać;
  // najbliższe wejście na Finanse i tak odpali to ponownie przez fokus ekranu).
  useEffect(() => {
    const drainThenAuto = () => drainBankNotifications()
      .then(() => { if (useExpensesStore.getState().expenses.length > 0) return import('@/services/bankAutoProcess').then((m) => m.processAutoBankQueue()); })
      .catch(() => {});
    const t = setTimeout(drainThenAuto, 1500);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') drainThenAuto(); });
    return () => { clearTimeout(t); sub.remove(); };
  }, []);

  // W przeciwieństwie do fontów, TEGO jednego czekania appka nie może "ignorować" —
  // pierwszy render musi wiedzieć czy pokazać ekrany, czy /login, inaczej zalogowany
  // user zobaczyłby błysk ekranu logowania (albo odwrotnie: niezalogowany błysk
  // dashboardu) na czas zanim pierwszy `onAuthStateChanged` zdąży odpowiedzieć —
  // zwykle poniżej jednej klatki (odczyt z AsyncStorage), więc krótki spinner tu nie
  // jest realnym kosztem.
  // `GestureHandlerRootView` (Faza 3.1, design/app-design.html) — zamontowany RAZ na
  // szczycie drzewa (nie per ekran), bo `react-native-gesture-handler` (MoodPad's
  // `Gesture.Pan()`, `Toggle`/`Segmented`'s `Pressable` z tej biblioteki) tego wymaga.
  // `BottomSheetModalProvider` USUNIĘTY (Faza 3.15, 2026-11-04) razem z
  // `@gorhom/bottom-sheet` — `AppBottomSheet` jest teraz własnym `Modal`-em, nie
  // potrzebuje już tego providera (patrz src/components/design/AppBottomSheet.tsx).
  if (initializing) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, backgroundColor: colors.bg.primary }}>
            {/* 2026-11-08, user: "Dodałem nowe logo dodaj je do appki" — ten ekran
                (ładowanie fontów/stanu auth, widoczny KRÓTKO przy każdym zimnym
                starcie, zaraz po natywnym splashu) był dotąd gołym spinnerem. */}
            <Image source={require('../assets/Logo_Sapp2_OrangeTranspare.png')} style={{ width: 64, height: 64 }} resizeMode="contain" />
            <ActivityIndicator color={colors.text.primary} />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack key={dimensionKey} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.primary } }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
