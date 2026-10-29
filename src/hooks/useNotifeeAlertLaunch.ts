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
export function useNotifeeAlertLaunch() {
  const router = useRouter();

  useEffect(() => {
    let unsubscribeForeground: (() => void) | undefined;

    (async () => {
      try {
        const notifeeModule = await import('@notifee/react-native');
        const notifee = notifeeModule.default;
        const { EventType } = notifeeModule;

        const goToAlert = (data: Record<string, string | object | number> | undefined) => {
          if (typeof data?.route === 'string' && data.route === 'alert-test') {
            router.push('/alert-test');
          }
        };

        const initial = await notifee.getInitialNotification();
        if (initial) goToAlert(initial.notification.data);

        unsubscribeForeground = notifee.onForegroundEvent(({ type, detail }) => {
          if (type === EventType.PRESS || type === EventType.DELIVERED) {
            goToAlert(detail.notification?.data);
          }
        });

        notifee.onBackgroundEvent(async ({ type, detail }) => {
          if (type === EventType.PRESS) {
            goToAlert(detail.notification?.data);
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
