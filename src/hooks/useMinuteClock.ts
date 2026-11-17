import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

// "Teraz" odświeżane co pełną minutę + od razu po powrocie do appki (2026-11-17, user:
// "event skończył się o 9:45, a jest do tej pory, już po 18"). Dashboard liczył `now` raz
// na dzień (useMemo po dacie), więc "Teraz" i "Najbliższe eventy" stały na porannym
// stanie. setInterval nie chodzi, gdy appka jest w tle (Android) / karta ukryta (web) —
// dlatego dodatkowo AppState 'active' i visibilitychange.
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      setNow(new Date());
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 50); // równo z pełną minutą
    };
    tick();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') tick(); });
    const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') tick(); };
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return now;
}
