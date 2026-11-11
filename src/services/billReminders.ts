import { Platform } from 'react-native';
import type { Subscription } from '@/types/subscriptions';
import { planBillReminders, BILL_REMINDER_PREFIX } from '@/utils/billReminders';

// Realne przypomnienia o Stałych opłatach (2026-11-11) — plan z
// `utils/billReminders.ts` zamieniony na natywne triggery notifee. Ten sam
// mechanizm co sprawdzony na urządzeniu test alertu w Ustawieniach
// (`TriggerType.TIMESTAMP` + `alarmManager.allowWhileIdle` → AlarmManager,
// przeżywa zamknięcie appki). Zwykłe powiadomienie (NIE pełnoekranowe jak
// tamten test) — to przypomnienie, nie alarm.
//
// Wołane przy każdej zmianie listy subskrypcji (hook w app/_layout.tsx):
// planuje następne przypomnienie dla każdej subskrypcji i KASUJE te, które już
// nie powinny istnieć (subskrypcja usunięta/wyłączona/przypomnienie "Brak").
// Ten sam `id` = zastąpienie, więc wielokrotne wołanie jest bezpieczne.
const CHANNEL_ID = 'bill-reminders-v1';
let chain: Promise<void> = Promise.resolve();

export function syncBillReminders(subs: Subscription[]): Promise<void> {
  // Szeregowo — kilka zmian store'u pod rząd nie może się przeplatać
  // (anuluj-starych vs zaplanuj-nowych z dwóch wywołań naraz).
  chain = chain.then(() => doSync(subs)).catch(() => {});
  return chain;
}

async function doSync(subs: Subscription[]): Promise<void> {
  if (Platform.OS !== 'android') return;
  let notifeeModule: typeof import('@notifee/react-native');
  try {
    notifeeModule = await import('@notifee/react-native');
  } catch {
    return; // Expo Go / brak natywnego modułu
  }
  const notifee = notifeeModule.default;
  const { AndroidImportance, AuthorizationStatus, TriggerType } = notifeeModule;

  const planned = planBillReminders(subs);
  const wanted = new Set(planned.map((p) => p.id));

  const existing = await notifee.getTriggerNotificationIds();
  for (const id of existing) {
    if (id.startsWith(BILL_REMINDER_PREFIX) && !wanted.has(id)) await notifee.cancelTriggerNotification(id);
  }
  if (planned.length === 0) return;

  // O zgodę pytamy TYLKO gdy user faktycznie ustawił jakieś przypomnienie.
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) return;

  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Stałe opłaty — przypomnienia',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });

  for (const p of planned) {
    await notifee.createTriggerNotification(
      {
        id: p.id,
        title: p.title,
        body: p.body,
        data: { route: 'subscriptions' },
        android: { channelId: CHANNEL_ID, pressAction: { id: 'default', launchActivity: 'default' } },
      },
      { type: TriggerType.TIMESTAMP, timestamp: p.fireAt, alarmManager: { allowWhileIdle: true } },
    );
  }
}
