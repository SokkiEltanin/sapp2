import { Platform } from 'react-native';

// Testy powiadomień od zera (2026-11-17, user: "w ustawieniach są zdublowane, odpalają
// się 2 razy, nadal nie działa wybudzenie — zrób od zera: ZWYKŁE / ZWYKŁE TAK-NIE /
// FULL SCREEN WIBRACJA / FULL SCREEN WIBRACJA I DŹWIĘK / FULL SCREEN WAKE UP, każdy
// innym kolorem"). Każdy test = JEDNO powiadomienie (stare testy wysyłały dodatkowo
// "natychmiastowe" diagnostyczne → dwa alarmy). Ekran: app/notify-test.tsx; alarm
// pełnoekranowy otwiera app/alert-test.tsx (z `test` w danych → kolor, wake lock).
//
// Kanały Androida są NIEZMIENNE po utworzeniu — każda zmiana dźwięku/wibracji = nowe id.
export type NotifyTestKey = 'basic' | 'basicActions' | 'fsVibe' | 'fsSound' | 'fsWake';

export const NOTIFY_TESTS: { k: NotifyTestKey; label: string; desc: string; color: string; fullScreen: boolean }[] = [
  { k: 'basic', label: 'Zwykłe', desc: 'baner z dźwiękiem, bez pełnego ekranu', color: '#60A5FA', fullScreen: false },
  { k: 'basicActions', label: 'Zwykłe TAK / NIE', desc: 'baner z przyciskami — odpowiedź przyjdzie jako drugie powiadomienie', color: '#A78BFA', fullScreen: false },
  { k: 'fsVibe', label: 'Pełny ekran · wibracja', desc: 'ekran alarmu nad blokadą, sama wibracja (bez dźwięku)', color: '#FB923C', fullScreen: true },
  { k: 'fsSound', label: 'Pełny ekran · wibracja + dźwięk', desc: 'ekran alarmu, dźwięk w pętli i wibracja', color: '#EF4444', fullScreen: true },
  { k: 'fsWake', label: 'Pełny ekran · wybudzenie', desc: 'jak budzik: wybudza zgaszony ekran (zablokuj i odłóż telefon)', color: '#22C55E', fullScreen: true },
];
export const testMeta = (k: string) => NOTIFY_TESTS.find((t) => t.k === k);

const CH = {
  basic: 'test-basic-v1',
  fsVibe: 'test-fs-vibe-v1',
  fsSound: 'test-fs-sound-v1',
} as const;

export interface NotifyStatus {
  permission: boolean | null;
  exactAlarm: boolean | null;
  batteryOptimized: boolean | null;
  fullScreen: boolean | null;
}

async function notifeeMod() {
  return import('@notifee/react-native');
}

export async function notifyStatus(): Promise<NotifyStatus> {
  const out: NotifyStatus = { permission: null, exactAlarm: null, batteryOptimized: null, fullScreen: null };
  if (Platform.OS !== 'android') return out; // komputer: testy i zgody tylko na telefonie
  try {
    const m = await notifeeMod();
    const s = await m.default.getNotificationSettings();
    out.permission = s.authorizationStatus >= m.AuthorizationStatus.AUTHORIZED;
    out.exactAlarm = s.android?.alarm == null ? null : s.android.alarm === m.AndroidNotificationSetting.ENABLED;
    out.batteryOptimized = await m.default.isBatteryOptimizationEnabled();
  } catch { /* brak notifee (web/Expo Go) */ }
  const { canUseFullScreenIntent } = await import('./lockScreen');
  out.fullScreen = await canUseFullScreenIntent();
  return out;
}

export async function fixStatus(what: keyof NotifyStatus): Promise<void> {
  const m = await notifeeMod();
  if (what === 'permission') await m.default.requestPermission();
  else if (what === 'exactAlarm') await m.default.openAlarmPermissionSettings();
  else if (what === 'batteryOptimized') await m.default.openBatteryOptimizationSettings();
  else if (what === 'fullScreen') (await import('./lockScreen')).openFullScreenIntentSettings();
}

async function channels() {
  const m = await notifeeMod();
  const n = m.default;
  const { AndroidImportance } = m;
  await n.createChannel({ id: CH.basic, name: 'Test: zwykłe', importance: AndroidImportance.HIGH, sound: 'default', vibration: true });
  // bez `sound` = kanał bez dźwięku (notifee: domyślnie cisza), tylko wibracja
  await n.createChannel({ id: CH.fsVibe, name: 'Test: pełny ekran (wibracja)', importance: AndroidImportance.HIGH, vibration: true, vibrationPattern: [300, 600, 300, 600], bypassDnd: true });
  await n.createChannel({ id: CH.fsSound, name: 'Test: pełny ekran (dźwięk)', importance: AndroidImportance.HIGH, sound: 'default', vibration: true, vibrationPattern: [300, 600, 300, 600], bypassDnd: true });
}

/** Wysyła JEDNO powiadomienie testu (od razu albo za `delayMs` przez AlarmManager). */
export async function runNotifyTest(k: NotifyTestKey, delayMs: number): Promise<string> {
  const m = await notifeeMod();
  const n = m.default;
  const { AndroidImportance, AndroidCategory, AndroidVisibility, TriggerType } = m;
  const perm = await n.requestPermission();
  if (perm.authorizationStatus < m.AuthorizationStatus.AUTHORIZED) throw new Error('Brak zgody na powiadomienia');
  await channels();
  const meta = testMeta(k)!;
  const id = `notify-test-${k}`;
  const full = meta.fullScreen;
  const android: Record<string, unknown> = {
    channelId: k === 'basic' || k === 'basicActions' ? CH.basic : k === 'fsVibe' ? CH.fsVibe : CH.fsSound,
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    color: meta.color,
    pressAction: { id: 'default' },
  };
  if (k === 'basicActions') android.actions = [{ title: 'NIE', pressAction: { id: 'test-no' } }, { title: 'TAK', pressAction: { id: 'test-yes' } }];
  if (full) {
    android.category = k === 'fsWake' ? AndroidCategory.ALARM : AndroidCategory.CALL;
    android.fullScreenAction = { id: 'default', launchActivity: 'default' };
    android.ongoing = true;
    if (k !== 'fsVibe') { android.sound = 'default'; android.loopSound = true; }
  }
  const notification = {
    id,
    title: meta.label,
    body: full ? 'Test alarmu — stuknij, jeśli ekran się nie otworzył sam.' : meta.desc,
    data: { test: k, ...(full ? { route: 'alert-test' } : {}) },
    android,
  };
  await n.cancelNotification(id).catch(() => {});
  if (delayMs <= 0) {
    await n.displayNotification(notification as any);
    return 'Wysłane teraz.';
  }
  await n.createTriggerNotification(notification as any, {
    type: TriggerType.TIMESTAMP,
    timestamp: Date.now() + delayMs,
    alarmManager: { allowWhileIdle: true },
  });
  return `Zaplanowane za ${delayMs >= 60000 ? `${Math.round(delayMs / 60000)} min` : `${Math.round(delayMs / 1000)} s`}.`;
}

/** Odpowiedź z testu TAK/NIE — działa też przy zamkniętej appce (notifeeBackground). */
export async function answerTest(actionId: string, notifId?: string): Promise<boolean> {
  if (actionId !== 'test-yes' && actionId !== 'test-no') return false;
  const m = await notifeeMod();
  if (notifId) await m.default.cancelNotification(notifId).catch(() => {});
  await m.default.displayNotification({
    title: actionId === 'test-yes' ? 'Odpowiedź: TAK ✓' : 'Odpowiedź: NIE ✗',
    body: 'Przycisk w powiadomieniu działa.',
    android: { channelId: CH.basic, color: '#A78BFA' },
  });
  return true;
}

export async function cancelTestNotifications(): Promise<void> {
  try {
    const n = (await notifeeMod()).default;
    await Promise.all(NOTIFY_TESTS.map((t) => n.cancelNotification(`notify-test-${t.k}`).catch(() => {})));
  } catch { /* brak notifee */ }
}
