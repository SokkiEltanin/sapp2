import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { refreshScreenTime, screenTimeAvailable } from '@/services/screenTime';

// Czas z telefonem (2026-11-22): odczyt przy starcie, po powrocie do appki (np. z ekranu
// systemowego, gdzie user właśnie dał dostęp — wtedy bez limitu) i co 5 min na wierzchu.
export function useScreenTimeSync() {
  useEffect(() => {
    if (Platform.OS !== 'android' || !screenTimeAvailable()) return;
    const start = setTimeout(() => { refreshScreenTime(true); }, 2500);
    const every = setInterval(() => { if (AppState.currentState === 'active') refreshScreenTime(); }, 5 * 60_000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshScreenTime(true); });
    return () => { clearTimeout(start); clearInterval(every); sub.remove(); };
  }, []);
}
