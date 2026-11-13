import { useEffect } from 'react';
import { useRouter } from 'expo-router';

// Łapie launch/wznowienie appki przez pełnoekranowy alert notifee
// (`fullScreenAction`) i przekierowuje na dedykowany ekran alarmu
// (app/alert-test.tsx) zamiast zostawiać usera na ostatnim otwartym ekranie appki
// (2026-10-29, user po teście na urządzeniu: pełnoekranowy launch nad blokadą
// DZIAŁA, ale ląduje w zwykłej appce, nie w dedykowanym ekranie alarmu — "trzeba
// dostosować okno alertu osobne... żeby nie cała apka była"). `getInitialNotification`
// łapie cold-start (appka była zabita/nieotwarta), `onForegroundEvent` łapie
// wznowienie z tła do pierwszego planu, `onBackgroundEvent` — zgodnie z
// dokumentacją notifee powinien być zarejestrowany jak najwcześniej/poza cyklem
// życia komponentów, ale u nas notifee MUSI być importowany dynamicznie (zasada z
// app/_layout.tsx — natywny moduł, zero w Expo Go), więc rejestrujemy go tutaj,
// w efekcie montowanym raz przy starcie appki — pokrywa przypadek appki w tle
// (nie zabitej), czyli dokładnie to co user przetestował.
//
// `router.replace` NIE `router.push` (2026-11-01, user: "czasami ekran otwiera się
// 2 razy") — `sendNotifeeAlert` z `includeInstant=true` wysyła DWA powiadomienia na
// jeden tap (natychmiastowe + opóźnione), oba z tym samym `data:{route:'alert-test'}`.
// Każde z nich osobno potrafi odpalić `onForegroundEvent`/`onBackgroundEvent` — z
// `push` to dwa NIEZALEŻNE wpisy na stosie nawigacji (user widzi alarm, "Wyłącz",
// a pod spodem drugi, identyczny ekran). `replace` podmienia bieżący szczyt stosu
// zamiast go nakładać, więc powtórne wywołania zlewają się w JEDEN ekran.
export function useNotifeeAlertLaunch() {
  const router = useRouter();

  useEffect(() => {
    let unsubscribeForeground: (() => void) | undefined;

    (async () => {
      try {
        const notifeeModule = await import('@notifee/react-native');
        const notifee = notifeeModule.default;
        const { EventType } = notifeeModule;

        // `pressed` — przypomnienie o Stałej opłacie (2026-11-11,
        // `data.route:'subscriptions'`) otwiera ekran TYLKO po stuknięciu.
        // Alarm (`alert-test`) dalej też na samo DELIVERED — to pełnoekranowy
        // alarm, ma przejąć ekran sam; zwykłe przypomnienie NIE może wyrywać
        // usera z tego co robi w appce w momencie doręczenia.
        const route = (data: Record<string, string | object | number> | undefined, pressed: boolean) => {
          if (typeof data?.route !== 'string') return;
          if (data.route === 'alert-test') router.replace('/alert-test');
          else if (data.route === 'subscriptions' && pressed) router.push('/subscriptions');
          else if (data.route === 'replacements' && pressed) router.push('/replacements' as any);
        };

        const initial = await notifee.getInitialNotification();
        if (initial) route(initial.notification.data, true);

        unsubscribeForeground = notifee.onForegroundEvent(({ type, detail }) => {
          if (type === EventType.PRESS || type === EventType.DELIVERED) {
            route(detail.notification?.data, type === EventType.PRESS);
          }
        });

        notifee.onBackgroundEvent(async ({ type, detail }) => {
          if (type === EventType.PRESS) {
            route(detail.notification?.data, true);
          }
        });
      } catch {
        // notifee niedostępny (Expo Go) — po prostu nic nie robimy, dokładnie jak
        // w pozostałych dynamicznych importach tego modułu w appce.
      }
    })();

    return () => unsubscribeForeground?.();
  }, [router]);
}
