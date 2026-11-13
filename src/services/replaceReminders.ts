import { Platform } from 'react-native';
import type { ReplaceItem } from '@/types/replacements';
import { planReplaceReminders, REPLACE_REMINDER_PREFIX } from '@/utils/replaceReminders';

// Przypomnienia o wymianach (2026-11-13) — plan z utils/replaceReminders.ts →
// natywne triggery notifee (ten sam mechanizm co services/billReminders.ts).
// Wołane przy każdej zmianie listy (app/_layout.tsx): planuje i kasuje zbędne.
const CHANNEL_ID = 'replace-reminders-v1';
let chain: Promise<void> = Promise.resolve();

export function syncReplaceReminders(items: ReplaceItem[]): Promise<void> {
  chain = chain.then(() => doSync(items)).catch(() => {});
  return chain;
}

async function doSync(items: ReplaceItem[]): Promise<void> {
  if (Platform.OS !== 'android') return;
  let mod: typeof import('@notifee/react-native');
  try { mod = await import('@notifee/react-native'); } catch { return; }
  const notifee = mod.default;
  const { AndroidImportance, AuthorizationStatus, TriggerType } = mod;

  const planned = planReplaceReminders(items);
  const wanted = new Set(planned.map((p) => p.id));
  for (const id of await notifee.getTriggerNotificationIds()) {
    if (id.startsWith(REPLACE_REMINDER_PREFIX) && !wanted.has(id)) await notifee.cancelTriggerNotification(id);
  }
  if (planned.length === 0) return;
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) return;
  await notifee.createChannel({ id: CHANNEL_ID, name: 'Wymiany — przypomnienia', importance: AndroidImportance.DEFAULT, sound: 'default' });
  for (const p of planned) {
    await notifee.createTriggerNotification(
      {
        id: p.id, title: p.title, body: p.body,
        data: { route: 'replacements' },
        android: { channelId: CHANNEL_ID, pressAction: { id: 'default', launchActivity: 'default' } },
      },
      { type: TriggerType.TIMESTAMP, timestamp: p.fireAt, alarmManager: { allowWhileIdle: true } },
    );
  }
}
