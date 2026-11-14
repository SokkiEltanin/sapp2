import { useEffect } from 'react';
import { AppState } from 'react-native';
import { autoBackupIfDue } from '@/services/cloudBackup';
import { autoLocalBackupIfDue } from '@/services/localBackup';
import { logError } from '@/services/errorLog';

// Automatyczna kopia w chmurze (2026-11-11) — przy starcie (z opóźnieniem, żeby
// nie dociążać pierwszych sekund appki i dać store'om się zhydrować) i przy
// zejściu appki w tło (typowy moment "skończyłem coś wpisywać"). Sam
// `autoBackupIfDue` pilnuje progu 6h i włącznika z Ustawień.
export function useAutoBackup(loggedIn: boolean) {
  useEffect(() => {
    if (!loggedIn) return;
    const t = setTimeout(() => { autoBackupIfDue(); }, 20000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') autoBackupIfDue();
    });
    return () => { clearTimeout(t); sub.remove(); };
  }, [loggedIn]);

  // Kopia do pliku (2026-11-14): co 7 dni do folderu wybranego w Ustawieniach → Dane.
  // Nie wymaga logowania ani internetu.
  useEffect(() => {
    const run = () => { autoLocalBackupIfDue().catch((e) => logError('kopia do pliku (auto)', e)); };
    const t = setTimeout(run, 30000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'background') run(); });
    return () => { clearTimeout(t); sub.remove(); };
  }, []);
}
