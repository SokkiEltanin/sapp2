import { Platform } from 'react-native';
import type { Task } from '@/types/calendar';
import { planTaskReminders, snoozeFields, TASK_REMINDER_PREFIX, TASK_DONE_ACTION, TASK_SNOOZE_ACTION } from '@/utils/taskReminders';
import { useCalendarStore } from '@/store/calendarStore';

// Przypomnienia o zadaniach z godziną (2026-11-14) — plan z utils/taskReminders.ts →
// natywne triggery notifee (ten sam mechanizm co services/replaceReminders.ts).
// Wołane przy każdej zmianie zadań (hooks/useTaskReminderSync.ts). Przycisk
// "Zrobione" obsługuje hooks/useNotifeeAlertLaunch.ts.
const CHANNEL_ID = 'task-reminders-v1';
// Alarm na pełny ekran (2026-11-25, user: "zaplanować coś na dziś na 15 i żeby był alarm pełnoekranowy
// albo zwykły"): kanał BEZ dźwięku — dźwięk budzika i wibrację robi natywny AlarmActivity
// (plugins/withFullScreenAlert.js), tak jak w testach powiadomień (services/notifyTests.ts).
const ALARM_CHANNEL_ID = 'task-alarm-v1';
const ALARM_COLOR = '#FB923C';
let chain: Promise<void> = Promise.resolve();

export function syncTaskReminders(tasks: Task[]): Promise<void> {
  chain = chain.then(() => doSync(tasks)).catch(() => {});
  return chain;
}

async function doSync(tasks: Task[]): Promise<void> {
  if (Platform.OS !== 'android') return;
  let mod: typeof import('@notifee/react-native');
  try { mod = await import('@notifee/react-native'); } catch { return; }
  const notifee = mod.default;
  const { AndroidImportance, AndroidCategory, AndroidVisibility, AuthorizationStatus, TriggerType } = mod;

  const planned = planTaskReminders(tasks);
  const wanted = new Set(planned.map((p) => p.id));
  for (const id of await notifee.getTriggerNotificationIds()) {
    if (id.startsWith(TASK_REMINDER_PREFIX) && !wanted.has(id)) await notifee.cancelTriggerNotification(id);
  }
  if (planned.length === 0) return;
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) return;
  await notifee.createChannel({ id: CHANNEL_ID, name: 'Zadania — przypomnienia', importance: AndroidImportance.HIGH, sound: 'default', vibration: true });
  const alarms = planned.filter((p) => p.alarm);
  const { hasAlarmActivity, setAlarmPayload, ALARM_ACTIVITY } = await import('./lockScreen');
  const nativeAlarm = alarms.length > 0 && hasAlarmActivity();
  if (alarms.length > 0) {
    await notifee.createChannel({
      id: ALARM_CHANNEL_ID, name: 'Zadania — alarm na pełny ekran', importance: AndroidImportance.HIGH,
      ...(nativeAlarm ? { vibration: false } : { sound: 'default', vibration: true }),
      visibility: AndroidVisibility.PUBLIC,
    });
    // Natywny ekran alarmu czyta JEDEN zapisany opis (tytuł, kolor, id) — ustawiamy go dla
    // najbliższego alarmu. Kolejne dostają swój opis przy następnej synchronizacji (każda zmiana
    // zadań i każde otwarcie appki), patrz NEXT_STEPS.
    if (nativeAlarm) {
      const next = alarms[0];
      setAlarmPayload({ title: next.title, body: next.body, color: ALARM_COLOR, sound: true, vibrate: true, notifId: next.id });
    }
  }
  for (const p of planned) {
    const actions = [
      { title: 'Zrobione', pressAction: { id: TASK_DONE_ACTION, launchActivity: 'default' } },
      // Bez launchActivity — obsługa w tle (snoozeTaskReminder), appka się nie otwiera.
      { title: 'Za godzinę', pressAction: { id: TASK_SNOOZE_ACTION } },
    ];
    const android: Record<string, unknown> = p.alarm
      ? {
        channelId: ALARM_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        category: AndroidCategory.ALARM,
        color: ALARM_COLOR,
        ongoing: true,
        actions,
        ...(nativeAlarm
          ? { fullScreenAction: { id: 'default', launchActivity: ALARM_ACTIVITY }, pressAction: { id: 'default', launchActivity: ALARM_ACTIVITY } }
          : { fullScreenAction: { id: 'default', launchActivity: 'default' }, pressAction: { id: 'default', launchActivity: 'default' }, loopSound: true }),
      }
      : { channelId: CHANNEL_ID, pressAction: { id: 'default', launchActivity: 'default' }, actions };
    await notifee.createTriggerNotification(
      {
        id: p.id, title: p.title, body: p.body,
        data: { route: 'tasks', taskId: p.taskId },
        android: android as any,
      },
      { type: TriggerType.TIMESTAMP, timestamp: p.fireAt, alarmManager: { allowWhileIdle: true } },
    );
  }
}

/**
 * "Za godzinę" (2026-11-14): przypomnienie wraca za 60 min. Działa też w tle i przy
 * zamkniętej appce (rejestracja w index.js → services/notifeeBackground.ts).
 */
export async function snoozeTaskReminder(taskId: string, notificationId?: string): Promise<void> {
  const st = useCalendarStore;
  if (!st.persist.hasHydrated()) await st.persist.rehydrate();
  const task = st.getState().tasks.find((t) => t.id === taskId);
  try {
    const notifee = (await import('@notifee/react-native')).default;
    if (notificationId) await notifee.cancelDisplayedNotification(notificationId);
  } catch {}
  if (!task || task.status === 'done' || task.status === 'deleted') return;
  st.getState().updateTask(taskId, { ...snoozeFields(new Date()), updatedAt: new Date().toISOString() });
  await syncTaskReminders(st.getState().tasks);
}
