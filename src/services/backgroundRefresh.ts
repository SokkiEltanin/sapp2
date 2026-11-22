import { AppState, Platform } from 'react-native';
import { logError } from './errorLog';

// Odświeżanie w tle (2026-11-22): system (WorkManager przez expo-background-task) co ~N minut
// budzi sam JS, bez ekranów. Robimy to, co zwykle dzieje się po otwarciu appki: czas z telefonem,
// kolejki z widgetu/zegarka (w tym humor z zegarka → przypomnienie 21:00 się kasuje), świeże dane
// dla zegarka, bateria, krótka synchronizacja z chmurą (komputer widzi aktualne dane).
// Gdy appka jest na wierzchu — nic (wszystko i tak działa na żywo). Interwał: store/backgroundStore.ts.
export const BG_TASK = 'soen-background-refresh';

async function hydrate(stores: { persist?: { hasHydrated: () => boolean; rehydrate: () => Promise<void> | void } }[]) {
  await Promise.all(stores.map(async (s) => { if (s.persist && !s.persist.hasHydrated()) await s.persist.rehydrate(); }));
}

export async function runBackgroundRefresh(): Promise<boolean> {
  if (AppState.currentState === 'active') return true;
  const [{ useScreenTimeStore }, { useCalendarStore }, { useMoodStore }, { useWorkStore }, { useExpensesStore }, { useMoodReminderStore }, { useDeviceBatteryStore }, { useBackgroundStore }] = await Promise.all([
    import('@/store/screenTimeStore'), import('@/store/calendarStore'), import('@/store/moodStore'), import('@/store/workStore'),
    import('@/store/expensesStore'), import('@/store/moodReminderStore'), import('@/store/deviceBatteryStore'), import('@/store/backgroundStore'),
  ]);
  await hydrate([useScreenTimeStore, useCalendarStore, useMoodStore, useWorkStore, useExpensesStore, useMoodReminderStore, useDeviceBatteryStore, useBackgroundStore] as any);
  let ok = true;
  const step = async (name: string, fn: () => Promise<unknown> | unknown) => { try { await fn(); } catch (e) { ok = false; logError(`tło: ${name}`, e); } };

  await step('kolejki', async () => (await import('./widgetToggleDrain')).drainWidgetToggleQueue());
  await step('humor', async () => (await import('./moodReminders')).syncMoodReminders());
  await step('czas z telefonem', async () => (await import('./screenTime')).refreshScreenTime(true));
  await step('bateria', async () => {
    const Battery = await import('expo-battery');
    const [lvl, st] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync()]);
    const w = await (await import('./watchBattery')).readWatchBattery();
    if (lvl >= 0) useDeviceBatteryStore.getState().report({ level: Math.round(lvl * 100), charging: st === Battery.BatteryState.CHARGING || st === Battery.BatteryState.FULL }, w);
    const logs = await (await import('./watchBattery')).readBatteryLogs();
    useDeviceBatteryStore.getState().setLogs(logs.phone, logs.watch);
  });
  await step('zegarek', async () => {
    const c = useCalendarStore.getState();
    (await import('./wearSync')).syncWear(c.tasks, [...c.events, ...c.gcalEvents], {
      employers: useWorkStore.getState().employers, expenses: useExpensesStore.getState().expenses, mood: useMoodStore.getState().entries,
    });
  });
  // Chmura: krótki przebieg synchronizacji (tylko zalogowany), potem stop — żeby komputer miał świeże dane.
  await step('chmura', async () => {
    const { auth } = await import('@/firebase');
    const { onAuthStateChanged } = await import('firebase/auth');
    // w tle logowanie odtwarza się z pamięci asynchronicznie — czekamy na pierwszy stan (max 5 s)
    const user = await new Promise<any>((res) => {
      const t = setTimeout(() => res(auth.currentUser), 5000);
      const u = onAuthStateChanged(auth, (x) => { clearTimeout(t); u(); res(x); });
    });
    const uid = user?.uid;
    if (!uid) return;
    const cs = await import('./cloudSync');
    await cs.startCloudSync(uid);
    await new Promise((r) => setTimeout(r, 12_000));
    if (AppState.currentState !== 'active') cs.stopCloudSync();
  });
  useBackgroundStore.getState().markRun(ok);
  return ok;
}

/** Rejestracja zadania — wywoływane z index.js przy ładowaniu paczki (także w tle). */
export function defineBackgroundTask(): void {
  if (Platform.OS !== 'android') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TaskManager = require('expo-task-manager');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BackgroundTaskResult } = require('expo-background-task');
    if (TaskManager.isTaskDefined?.(BG_TASK)) return;
    TaskManager.defineTask(BG_TASK, async () => {
      try { return (await runBackgroundRefresh()) ? BackgroundTaskResult.Success : BackgroundTaskResult.Failed; } catch { return BackgroundTaskResult.Failed; }
    });
  } catch { /* stary APK bez modułu */ }
}

/** Włącz/wyłącz zgodnie z ustawieniem (0 = wyłączone). */
export async function applyBackgroundSchedule(minutes: number): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const BT = await import('expo-background-task');
    const TaskManager = await import('expo-task-manager');
    const registered = await TaskManager.isTaskRegisteredAsync(BG_TASK);
    if (registered) await BT.unregisterTaskAsync(BG_TASK);
    if (minutes > 0) await BT.registerTaskAsync(BG_TASK, { minimumInterval: Math.max(15, minutes) });
  } catch (e) { logError('tło: harmonogram', e); }
}
