import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useReplacementsStore } from '@/store/replacementsStore';
import { REPLACED_ACTION } from '@/utils/replaceReminders';
import { TASK_DONE_ACTION } from '@/utils/taskReminders';
import { useCalendarStore } from '@/store/calendarStore';
import { todayISO } from '@/utils/date';
import { offerUndo } from '@/services/undo';
import { handleBackgroundAction } from '@/services/notifeeBackground';

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
          if (data.route === 'alert-test') router.replace({ pathname: '/alert-test', params: { test: typeof data.test === 'string' ? data.test : '' } } as any);
          else if (data.route === 'subscriptions' && pressed) router.push('/subscriptions');
          else if (data.route === 'replacements' && pressed) router.push('/replacements' as any);
          else if (data.route === 'finances' && pressed) router.push('/finances' as any);
          // strażnik (2026-11-25) → Ustawienia z otwartym Stanem appki
          else if (data.route === 'health' && pressed) router.push({ pathname: '/settings', params: { health: '1' } } as any);
          // przypomnienie o humorze (2026-11-18) → Daily z otwartym wpisem humoru
          else if (data.route === 'daily' && pressed) router.navigate({ pathname: '/daily', params: { mood: String(Date.now()) } } as any);
          else if (data.route === 'tasks' && pressed) router.navigate(typeof data.taskId === 'string' ? { pathname: '/tasks', params: { task: data.taskId } } as any : '/tasks');
        };

        // Przycisk "Wymienione" w przypomnieniu o wymianie (2026-11-14): zaznacz dziś,
        // zdejmij powiadomienie, pokaż listę z "Cofnij".
        const action = async (actionId: string | undefined, n: { id?: string; data?: Record<string, string | object | number> } | undefined) => {
          if (actionId === TASK_DONE_ACTION && typeof n?.data?.taskId === 'string') {
            // "Zrobione" w przypomnieniu o zadaniu — odhacz (jak tap w liście), z "Cofnij".
            const taskId = n.data.taskId;
            const cal = useCalendarStore;
            if (!cal.persist.hasHydrated()) await cal.persist.rehydrate();
            const task = cal.getState().tasks.find((t) => t.id === taskId);
            if (n.id) notifee.cancelNotification(n.id).catch(() => {});
            router.navigate('/tasks' as any);
            if (!task || task.status === 'done') return true;
            cal.getState().updateTask(taskId, { status: 'done', updatedAt: new Date().toISOString() });
            offerUndo(`Zrobione: ${task.title}`, () => cal.getState().updateTask(taskId, { status: task.status, updatedAt: new Date().toISOString() }));
            return true;
          }
          if (actionId !== REPLACED_ACTION || typeof n?.data?.itemId !== 'string') return false;
          const itemId = n.data.itemId;
          const st = useReplacementsStore;
          if (!st.persist.hasHydrated()) await st.persist.rehydrate();
          const item = st.getState().items.find((x) => x.id === itemId);
          if (n.id) notifee.cancelNotification(n.id).catch(() => {});
          router.push('/replacements' as any);
          if (!item || item.lastDate === todayISO()) return true; // już zaznaczone (np. drugie zdarzenie)
          st.getState().replaced(itemId, todayISO());
          offerUndo(`Wymienione: ${item.name}`, () => st.getState().undo(itemId));
          return true;
        };

        const initial = await notifee.getInitialNotification();
        if (initial && !(await action(initial.pressAction?.id, initial.notification))) route(initial.notification.data, true);

        unsubscribeForeground = notifee.onForegroundEvent(({ type, detail }) => {
          if (type === EventType.ACTION_PRESS) {
            handleBackgroundAction(detail).then((done) => { if (!done) action(detail.pressAction?.id, detail.notification); });
            return;
          }
          if (type === EventType.PRESS || type === EventType.DELIVERED) {
            route(detail.notification?.data, type === EventType.PRESS);
          }
        });

        notifee.onBackgroundEvent(async ({ type, detail }) => {
          if (type === EventType.ACTION_PRESS) {
            if (!(await handleBackgroundAction(detail))) await action(detail.pressAction?.id, detail.notification);
            return;
          }
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
