import { useEffect } from 'react';
import { useHealthStore } from '@/store/healthStore';
import { ensureHealthConnect, readHealthDay } from '@/services/healthConnectService';

const THROTTLE_MS = 5 * 60_000; // 5 min — odśwież na focus ekranu, ale nie częściej

let inFlight: Promise<void> | null = null;

async function syncNow(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const { connected, lastSyncedAt, setToday } = useHealthStore.getState();
    if (!connected) return;
    if (lastSyncedAt && Date.now() - new Date(lastSyncedAt).getTime() < THROTTLE_MS) return;
    // `ensureHealthConnect()` tu NIE pokaże dialogu — zgoda już przyznana z
    // wcześniejszego "Połącz" w Ustawieniach, to tylko potwierdza że dalej jest
    // ważna (sprawdza `getGrantedPermissions()` przed ewentualnym promptem).
    const res = await ensureHealthConnect();
    if (!res.ok) return;
    const snap = await readHealthDay(new Date());
    setToday(snap);
  })().finally(() => { inFlight = null; });
  return inFlight;
}

// Odświeża cache Health Connect przy montowaniu ekranu (Dashboard/Daily) — cichy
// no-op jeśli `connected===false` (user nigdy nie połączył) albo ostatnia
// synchronizacja była mniej niż `THROTTLE_MS` temu. Nie zwraca danych — czytaj
// `useHealthStore((st) => st.today)` osobno, ten hook tylko odświeża w tle.
export function useHealthSync(): void {
  useEffect(() => { syncNow().catch(() => {}); }, []);
}
