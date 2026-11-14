import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import * as Updates from 'expo-updates';
import { apkFromRelease, type ApkInfo } from '@/utils/appVersion';

// Aktualizacje (2026-11-14, user: "możemy zrobić szybkie update przez tego OTA??" +
// plan "appka ma sobie poradzić sama"). Dwie drogi:
// 1. OTA (expo-updates / EAS Update) — sama zmiana JS. Pobierana w tle, banner
//    "Aktualizacja gotowa · Uruchom ponownie". Publikuje build.yml (job `ota`), gdy
//    repo ma sekret EXPO_TOKEN — patrz MAINTENANCE.md → "Aktualizacje".
// 2. Nowy APK na GitHub Releases (zmiana natywna: uprawnienia, widgety, moduły) —
//    tag `build-N` > nasz EXPO_PUBLIC_BUILD_NUMBER → banner "Nowy APK · Pobierz".
//    Build CI publikuje release TYLKO przy zmianie natywnej (fingerprint), więc po OTA
//    numer z bundla jest wyższy niż ostatni release — brak fałszywego "pobierz".

export const RELEASES_API = 'https://api.github.com/repos/SokkiEltanin/sapp2/releases/latest';
const MIN_GAP_MS = 30 * 60 * 1000;

type UpdateState = {
  otaReady: boolean;
  apk: ApkInfo | null;
  dismissed: boolean;
  checking: boolean;
  lastCheck: number;
  lastError: string | null;
};

export const useAppUpdateStore = create<UpdateState>(() => ({
  otaReady: false, apk: null, dismissed: false, checking: false, lastCheck: 0, lastError: null,
}));

export function currentBuild(): number | null {
  const n = Number(process.env.EXPO_PUBLIC_BUILD_NUMBER);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function checkOta(): Promise<boolean> {
  if (Platform.OS === 'web' || __DEV__ || !Updates.isEnabled) return false;
  const res = await Updates.checkForUpdateAsync();
  if (!res.isAvailable) return false;
  const f = await Updates.fetchUpdateAsync();
  return !!f.isNew;
}

async function checkApk(): Promise<ApkInfo | null> {
  if (Platform.OS === 'web') return null;
  const r = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return apkFromRelease(await r.json(), currentBuild());
}

/** Sprawdź obie drogi. `force` pomija 30-min odstęp (przycisk w Ustawieniach). */
export async function checkForAppUpdate(force = false): Promise<void> {
  const st = useAppUpdateStore.getState();
  if (st.checking || (!force && Date.now() - st.lastCheck < MIN_GAP_MS)) return;
  useAppUpdateStore.setState({ checking: true, lastCheck: Date.now(), lastError: null });
  const errs: string[] = [];
  const [ota, apk] = await Promise.all([
    checkOta().catch((e) => { errs.push(`OTA: ${String(e?.message ?? e)}`); return false; }),
    checkApk().catch((e) => { errs.push(`APK: ${String(e?.message ?? e)}`); return null; }),
  ]);
  useAppUpdateStore.setState((s) => ({
    checking: false,
    otaReady: s.otaReady || ota,
    apk,
    dismissed: force ? false : s.dismissed,
    lastError: errs.length ? errs.join(' · ') : null,
  }));
}

export function applyOtaUpdate(): void {
  Updates.reloadAsync().catch(() => {});
}

/** Opis aktualnie działającej paczki JS — do Diagnostyki. */
export function runningUpdateLabel(): string {
  if (Platform.OS === 'web') return 'web';
  if (!Updates.isEnabled) return 'OTA wyłączone (brak updates.url w APK)';
  if (Updates.isEmbeddedLaunch) return 'wbudowana w APK';
  const d = Updates.createdAt;
  return `OTA ${d ? d.toISOString().slice(0, 16).replace('T', ' ') : ''}`.trim();
}

/** Start przy uruchomieniu + przy powrocie do appki (co najmniej co 30 min). */
export function startAppUpdateChecks(): () => void {
  const t = setTimeout(() => { checkForAppUpdate(); }, 8000);
  const sub = AppState.addEventListener('change', (s) => { if (s === 'active') checkForAppUpdate(); });
  return () => { clearTimeout(t); sub.remove(); };
}
