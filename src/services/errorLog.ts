import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { pushEntry, errorText, type ErrorEntry } from '@/utils/errorLog';

// Dziennik błędów — Ustawienia → Diagnostyka → "Dziennik błędów" (kopiowalny).
// Łapie: nieobsłużone wyjątki JS, odrzucone obietnice bez catch, console.error (poza
// dev), crash renderu (ErrorBoundary w app/_layout.tsx), błędy synchronizacji, oraz
// wszystko, co kod zgłosi przez `logError(gdzie, e)`.
const KEY = 'error-log-v1';

export const useErrorLog = create<{ entries: ErrorEntry[] }>(() => ({ entries: [] }));

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    AsyncStorage.setItem(KEY, JSON.stringify(useErrorLog.getState().entries)).catch(() => {});
  }, 500);
}

export function logError(where: string, e: unknown): void {
  try {
    const { msg, stack } = errorText(e);
    useErrorLog.setState((s) => ({ entries: pushEntry(s.entries, { t: Date.now(), where, msg, stack }) }));
    save();
  } catch { /* dziennik nigdy nie może sam wywalić appki */ }
}

export function clearErrorLog(): void {
  useErrorLog.setState({ entries: [] });
  AsyncStorage.removeItem(KEY).catch(() => {});
}

let installed = false;
export function installErrorLog(): void {
  if (installed) return;
  installed = true;
  AsyncStorage.getItem(KEY).then((raw) => {
    if (!raw) return;
    const saved = JSON.parse(raw) as ErrorEntry[];
    // Wpisy złapane przed wczytaniem zostają na górze.
    useErrorLog.setState((s) => ({ entries: [...s.entries, ...saved].slice(0, 100) }));
  }).catch(() => {});

  const g = globalThis as any;
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (ev) => logError('wyjątek', ev.error ?? ev.message));
      window.addEventListener('unhandledrejection', (ev) => logError('obietnica', ev.reason));
    }
  } else {
    const EU = g.ErrorUtils;
    if (EU?.getGlobalHandler) {
      const prev = EU.getGlobalHandler();
      EU.setGlobalHandler((err: unknown, isFatal?: boolean) => {
        logError(isFatal ? 'crash' : 'wyjątek', err);
        // Zapis od razu — przy crashu timer może nie zdążyć.
        AsyncStorage.setItem(KEY, JSON.stringify(useErrorLog.getState().entries)).catch(() => {});
        prev?.(err, isFatal);
      });
    }
    if (!__DEV__) g.HermesInternal?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id: number, err: unknown) => logError('obietnica', err),
    });
  }
  if (!__DEV__) {
    const orig = console.error;
    console.error = (...args: unknown[]) => {
      logError('console', args.length === 1 ? args[0] : args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
      orig(...args);
    };
  }
}
