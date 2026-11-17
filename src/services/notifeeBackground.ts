import { TASK_SNOOZE_ACTION } from '@/utils/taskReminders';

// Zdarzenia powiadomień w tle (2026-11-14). Notifee przy zamkniętej appce uruchamia
// sam JS (bez ekranów) — handler musi być zarejestrowany przy ładowaniu paczki,
// stąd index.js. Po starcie ekranów hooks/useNotifeeAlertLaunch.ts rejestruje swój
// (z nawigacją) i woła tu `handleBackgroundAction` dla akcji, które nie otwierają appki.
type Detail = { pressAction?: { id?: string }; notification?: { id?: string; data?: Record<string, unknown> } };

/** true = obsłużone (akcja bez otwierania appki). */
export async function handleBackgroundAction(detail: Detail): Promise<boolean> {
  const id = detail.pressAction?.id;
  const data = detail.notification?.data;
  if (id === 'test-yes' || id === 'test-no') {
    const { answerTest } = await import('./notifyTests');
    return answerTest(id, detail.notification?.id);
  }
  if (id === TASK_SNOOZE_ACTION && typeof data?.taskId === 'string') {
    const { snoozeTaskReminder } = await import('./taskReminders');
    await snoozeTaskReminder(data.taskId, detail.notification?.id);
    return true;
  }
  return false;
}

export function registerNotifeeBackground(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@notifee/react-native');
    const notifee = mod.default;
    const { EventType } = mod;
    notifee.onBackgroundEvent(async ({ type, detail }: { type: number; detail: Detail }) => {
      if (type === EventType.ACTION_PRESS) await handleBackgroundAction(detail);
    });
  } catch {
    // brak modułu natywnego (Expo Go) — nic
  }
}
