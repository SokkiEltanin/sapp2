import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useWeatherStore, type WeatherLocation } from '@/store/weatherStore';
import { fetchWeather } from '@/services/weather';

// Odświeżanie pogody (2026-11-13): przy wejściu na ekran i powrocie appki z tła,
// gdy dane starsze niż 30 min. Lokalizacja: 'gps' = bieżąca pozycja (uprawnienie
// pytane RAZ, przy pierwszym użyciu); odmowa → `gpsDenied`, kafel prosi o
// wpisanie miasta w szczegółach pogody. expo-location ładowane dynamicznie.
const STALE_MS = 30 * 60 * 1000;

async function resolveGps(): Promise<WeatherLocation | 'denied' | null> {
  const Location = await import('expo-location');
  let perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== 'granted' && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return 'denied';
  const pos = (await Location.getLastKnownPositionAsync({ maxAge: 60 * 60 * 1000 }))
    ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  if (!pos) return null;
  let name = 'Twoja lokalizacja';
  try {
    const [g] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    name = g?.city || g?.subregion || g?.district || name;
  } catch { /* nazwa opcjonalna */ }
  return { mode: 'gps', name, lat: pos.coords.latitude, lon: pos.coords.longitude };
}

export async function refreshWeather(force = false): Promise<void> {
  const st = useWeatherStore.getState();
  if (st.loading) return;
  if (!force && st.data && Date.now() - st.data.fetchedAt < STALE_MS) return;
  st.setLoading(true);
  try {
    let loc = st.location;
    if (!loc || loc.mode === 'gps') {
      if (st.gpsDenied && !force && !loc) return;
      const g = await resolveGps().catch(() => null);
      if (g === 'denied') { st.setGpsDenied(true); if (!loc) return; }
      else if (g) { st.setGpsDenied(false); loc = g; useWeatherStore.setState({ location: g }); }
    }
    if (!loc) return;
    const data = await fetchWeather(loc.lat, loc.lon, loc.name);
    useWeatherStore.getState().setData(data);
  } catch (e: any) {
    useWeatherStore.getState().setError(e?.name === 'AbortError' ? 'Brak odpowiedzi serwera pogody' : 'Nie udało się pobrać pogody');
  } finally {
    useWeatherStore.getState().setLoading(false);
  }
}

export function useWeather() {
  const data = useWeatherStore((s) => s.data);
  const location = useWeatherStore((s) => s.location);
  useEffect(() => {
    refreshWeather();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshWeather(); });
    return () => sub.remove();
  }, [location?.lat, location?.lon]);
  const refresh = useCallback(() => refreshWeather(true), []);
  return { data, location, refresh };
}
