import { NativeModules, Platform } from 'react-native';
import { useScreenTimeStore, useAppIconsStore } from '@/store/screenTimeStore';
import { daysToFetch, fromRaw, type RawScreenDay } from '@/utils/screenTime';
import { logError } from './errorLog';

// Czas z telefonem (2026-11-22): moduł natywny UsageStats (plugins/withUsageStats.js).
// Stary APK / web = brak modułu → `available()` false, kafel pokazuje instrukcję.
const M = () => (Platform.OS === 'android' ? NativeModules.UsageStats : undefined);

export const screenTimeAvailable = () => !!M()?.getDays;

export function hasScreenAccess(): boolean {
  try { return !!M()?.hasAccess?.(); } catch { return false; }
}

export function openScreenAccess(): void {
  try { M()?.openAccessSettings?.(); } catch { /* brak modułu */ }
}

let last = 0;
let running = false;

/** Odczyt dziś + brakujących/niepełnych dni z ostatniego tygodnia. `force` = bez limitu 60 s. */
export async function refreshScreenTime(force = false): Promise<void> {
  const m = M();
  if (!m?.getDays || running) return;
  if (!force && Date.now() - last < 60_000) return;
  const st = useScreenTimeStore.getState();
  const access = hasScreenAccess();
  if (st.access !== access) st.setAccess(access);
  if (!access) return;
  running = true;
  last = Date.now();
  try {
    const now = new Date();
    const starts = daysToFetch(useScreenTimeStore.getState().days, now, 7);
    const windows = starts.map((s) => [s, new Date(new Date(s).getFullYear(), new Date(s).getMonth(), new Date(s).getDate() + 1).getTime()]);
    const raw: RawScreenDay[] = JSON.parse(await m.getDays(JSON.stringify(windows)));
    const t = Date.now();
    const days = raw.map((r) => fromRaw(r, t)).filter((d) => d.total > 0 || d.unlocks > 0 || d.screenOns > 0);
    if (days.length) useScreenTimeStore.getState().addDays(days);
    // Ikony brakujących appek (tylko z czołówki — reszta listy ma inicjał).
    const have = useAppIconsStore.getState().icons;
    const need = [...new Set(days.flatMap((d) => d.apps.slice(0, 15).map((a) => a.p)))].filter((p) => !have[p]);
    if (need.length && m.getIcons) {
      const icons = JSON.parse(await m.getIcons(JSON.stringify(need.slice(0, 40))));
      if (icons && typeof icons === 'object') useAppIconsStore.getState().addIcons(icons);
    }
  } catch (e) {
    logError('czas z telefonem', e);
  } finally {
    running = false;
  }
}
