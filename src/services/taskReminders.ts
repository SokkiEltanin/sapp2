import { Platform } from 'react-native';
import type { Task } from '@/types/calendar';
import { planTaskReminders, TASK_REMINDER_PREFIX, TASK_DONE_ACTION } from '@/utils/taskReminders';

// Przypomnienia o zadaniach z godziną (2026-11-14) — plan z utils/taskReminders.ts →
// natywne triggery notifee (ten sam mechanizm co services/replaceReminders.ts).
// Wołane przy każdej zmianie zadań (hooks/useTaskReminderSync.ts). Przycisk
// "Zrobione" obsługuje hooks/useNotifeeAlertLaunch.ts.
const CHANNEL_ID = 'task-reminders-v1';
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
  const { AndroidImportance, AuthorizationStatus, TriggerType } = mod;

  const planned = planTaskReminders(tasks);
  const wanted = new Set(planned.map((p) => p.id));
  for (const id of await notifee.getTriggerNotificationIds()) {
    if (id.startsWith(TASK_REMINDER_PREFIX) && !wanted.has(id)) await notifee.cancelTriggerNotification(id);
  }
  if (planned.length === 0) return;
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) return;
  await notifee.createChannel({ id: CHANNEL_ID, name: 'Zadania — przypomnienia', importance: AndroidImportance.HIGH, sound: 'default', vibration: true });
  for (const p of planned) {
    await notifee.createTriggerNotification(
      {
        id: p.id, title: p.title, body: p.body,
        data: { route: 'tasks', taskId: p.taskId },
        android: {
          channelId: CHANNEL_ID,
          pressAction: { id: 'default', launchActivity: 'default' },
          actions: [{ title: 'Zrobione', pressAction: { id: TASK_DONE_ACTION, launchActivity: 'default' } }],
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: p.fireAt, alarmManager: { allowWhileIdle: true } },
    );
  }
}
