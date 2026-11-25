import { Platform } from 'react-native';
import { appHealth, type HealthInput } from '@/utils/appHealth';
import { guardianDecide, guardianText } from '@/utils/guardian';
import { useGuardianStore } from '@/store/guardianStore';
import { useSyncStatus } from './cloudSync';
import { getLastBackupAt, isAutoBackupEnabled } from './cloudBackup';
import { getLocalBackupInfo } from './localBackup';
import { useErrorLog } from './errorLog';
import { useAppUpdateStore } from './appUpdate';
import { useBankQueue } from '@/store/bankQueueStore';
import { useBackgroundStore } from '@/store/backgroundStore';
import { storageUsage } from './safeStorage';
import { logError } from './errorLog';

// Strażnik appki (2026-11-25, user: "samowystarczalna na długo"): przy starcie i powrocie do appki
// (najwyżej co 6 h) liczy Stan appki i jednym powiadomieniem mówi o tym, co stoi od ≥ 2 dni
// (bank nie łapie, kopia się nie robi, tło ubite, kończy się miejsce). Reguły: utils/guardian.ts.
const EVERY = 6 * 3_600_000;
const CHANNEL_ID = 'guardian';

export async function collectHealthInput(): Promise<HealthInput> {
  const sync = useSyncStatus.getState();
  const upd = useAppUpdateStore.getState();
  const bank = useBankQueue.getState();
  const bg = useBackgroundStore.getState();
  const web = Platform.OS === 'web';
  const [lastAt, auto, file, storage] = await Promise.all([
    getLastBackupAt().catch(() => null),
    isAutoBackupEnabled().catch(() => true),
    web ? Promise.resolve({ dir: null, lastAt: null }) : getLocalBackupInfo().catch(() => ({ dir: null, lastAt: null })),
    storageUsage().catch(() => undefined),
  ]);
  return {
    sync: { state: sync.state, lastAt: sync.lastAt, error: sync.error },
    cloudBackup: { auto, lastAt },
    fileBackup: file,
    errorTimes: useErrorLog.getState().entries.map((e) => e.t),
    update: { otaReady: upd.otaReady, apkBuild: upd.apk?.build ?? null, lastError: upd.lastError },
    bankPending: bank.pending.length,
    web,
    bank: { enabled: bank.enabled, times: bank.history.map((h) => h.at) },
    background: { interval: bg.interval, lastRun: bg.lastRun },
    storage,
  };
}

export async function runGuardian(force = false): Promise<void> {
  try {
    const st = useGuardianStore.getState();
    const now = Date.now();
    if (!force && now - st.lastCheck < EVERY) return;
    const rows = appHealth(await collectHealthInput(), now);
    const { notify, next } = guardianDecide(rows, st, now);
    useGuardianStore.getState().set({ ...next, lastCheck: now });
    if (!notify.length || Platform.OS !== 'android') return;
    const mod = await import('@notifee/react-native');
    const notifee = mod.default;
    const perm = await notifee.getNotificationSettings();
    if (perm.authorizationStatus < mod.AuthorizationStatus.AUTHORIZED) return;
    await notifee.createChannel({ id: CHANNEL_ID, name: 'Stan appki — ostrzeżenia', importance: mod.AndroidImportance.DEFAULT });
    const { title, body } = guardianText(notify);
    await notifee.displayNotification({
      id: 'guardian', title, body,
      data: { route: 'health' },
      android: { channelId: CHANNEL_ID, style: { type: mod.AndroidStyle.BIGTEXT, text: body }, pressAction: { id: 'default', launchActivity: 'default' } },
    });
  } catch (e) {
    logError('strażnik', e);
  }
}
