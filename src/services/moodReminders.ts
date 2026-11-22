import { Platform } from 'react-native';
import { planMoodReminders, MOOD_REMINDER_PREFIX, MOOD_QUICK, MOOD_QUICK_PREFIX } from '@/utils/moodReminder';
import { useMoodStore } from '@/store/moodStore';
import { useMoodReminderStore } from '@/store/moodReminderStore';

// Wieczorne przypomnienie o humorze (2026-11-18, user: "zachęcić do wpisu, jak nie został
// wpisany danego dnia"). Na 7 dni do przodu, tylko dni bez wpisu — wpis kasuje dzisiejsze
// (hooks/useMoodReminderSync.ts przelicza po każdej zmianie). Przyciski Słabo/OK/Dobrze
// zapisują humor w tle, bez otwierania appki (services/notifeeBackground.ts).
const CHANNEL_ID = 'mood-reminders-v1';
let chain: Promise<void> = Promise.resolve();

export function syncMoodReminders(): Promise<void> {
  chain = chain.then(doSync).catch(() => {});
  return chain;
}

async function doSync(): Promise<void> {
  if (Platform.OS !== 'android') return;
  let mod: typeof import('@notifee/react-native');
  try { mod = await import('@notifee/react-native'); } catch { return; }
  const notifee = mod.default;
  const { AndroidImportance, AuthorizationStatus, TriggerType } = mod;
  const cfg = useMoodReminderStore.getState();
  const planned = planMoodReminders(useMoodStore.getState().entries, new Date(), cfg);
  const wanted = new Set(planned.map((p) => p.id));
  for (const id of await notifee.getTriggerNotificationIds()) {
    if (id.startsWith(MOOD_REMINDER_PREFIX) && !wanted.has(id)) await notifee.cancelTriggerNotification(id);
  }
  if (!planned.length) return;
  const st = await notifee.getNotificationSettings();
  if (st.authorizationStatus < AuthorizationStatus.AUTHORIZED) return;
  await notifee.createChannel({ id: CHANNEL_ID, name: 'Humor — wieczorne przypomnienie', importance: AndroidImportance.DEFAULT, sound: 'default' });
  for (const p of planned) {
    await notifee.createTriggerNotification(
      {
        id: p.id, title: 'Jak minął dzień?', body: p.body,
        data: { route: 'daily', moodDate: p.date },
        android: {
          channelId: CHANNEL_ID,
          color: '#A3E635',
          pressAction: { id: 'default', launchActivity: 'default' },
          // bez launchActivity → zapis w tle, appka się nie otwiera
          actions: MOOD_QUICK.map((q) => ({ title: q.label, pressAction: { id: MOOD_QUICK_PREFIX + q.level } })),
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: p.fireAt, alarmManager: { allowWhileIdle: true } },
    );
  }
}

/** Przycisk w powiadomieniu → wpis humoru (energia średnia). Działa przy zamkniętej appce. */
export async function quickMoodFromNotification(actionId: string, notificationId?: string): Promise<boolean> {
  if (!actionId.startsWith(MOOD_QUICK_PREFIX)) return false;
  const level = Number(actionId.slice(MOOD_QUICK_PREFIX.length));
  if (!(level >= 1 && level <= 5)) return false;
  const st = useMoodStore;
  if (!st.persist.hasHydrated()) await st.persist.rehydrate();
  addQuickMood(level);
  try {
    const notifee = (await import('@notifee/react-native')).default;
    if (notificationId) await notifee.cancelDisplayedNotification(notificationId);
  } catch { /* brak modułu */ }
  await syncMoodReminders();
  return true;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Szybki wpis: humor `level` (1–5), energia średnia, bez tagów — kafel Daily i powiadomienie. */
export function addQuickMood(level: number): void {
  const now = new Date();
  const t = now.toISOString();
  useMoodStore.getState().addEntry({ id: `mood_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`, date: ymd(now), mood: level, energy: 3, tags: [], createdAt: t, updatedAt: t });
}

/** Powiadomienie o humorze się pokazało: jeśli humor z dziś już jest (np. z zegarka) — schowaj je. */
export async function dropMoodReminderIfLogged(notificationId: string): Promise<void> {
  const st = useMoodStore;
  if (!st.persist.hasHydrated()) await st.persist.rehydrate();
  try { await (await import('./widgetToggleDrain')).drainWidgetToggleQueue(); } catch { /* kolejka opcjonalna */ }
  const today = ymd(new Date());
  if (!st.getState().entries.some((e) => e.date === today)) return;
  try {
    const notifee = (await import('@notifee/react-native')).default;
    await notifee.cancelDisplayedNotification(notificationId);
  } catch { /* brak modułu */ }
  await syncMoodReminders();
}
