import { Platform } from 'react-native';
import { create } from 'zustand';

// Instalacja wersji na komputer jednym kliknięciem (2026-11-14) — Ustawienia →
// Ogólne → "Zainstaluj na komputerze". Chrome/Edge wysyłają `beforeinstallprompt`,
// gdy strona spełnia warunki PWA (manifest + service worker, scripts/pwa-postbuild.js);
// zdarzenie zapamiętujemy przy starcie i odpalamy okno instalacji z przycisku.
type State = { canInstall: boolean; installed: boolean };
export const usePwaInstall = create<State>(() => ({ canInstall: false, installed: false }));
let deferred: { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null = null;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const standalone = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  usePwaInstall.setState({ installed: standalone });
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferred = e as unknown as typeof deferred;
    usePwaInstall.setState({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    usePwaInstall.setState({ canInstall: false, installed: true });
  });
}

/** Opis do wiersza w Ustawieniach (null = nie pokazuj: telefon). */
export function pwaInstallLabel(s: State): string | null {
  if (Platform.OS !== 'web') return null;
  if (s.installed) return 'zainstalowana — działa jak zwykły program';
  if (s.canInstall) return 'stuknij — skrót na pulpicie i w menu Start, osobne okno';
  return 'w Chrome/Edge: ikona „Zainstaluj” w pasku adresu (albo menu ⋮ → Zainstaluj)';
}

export async function promptPwaInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  usePwaInstall.setState({ canInstall: false });
  return outcome === 'accepted';
}
