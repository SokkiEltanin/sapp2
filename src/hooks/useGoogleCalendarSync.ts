import { useEffect } from 'react';
import { useCalendarStore } from '@/store/calendarStore';
import { googleCalendarService } from '@/services/googleCalendarService';

// Wzorzec 1:1 z `useHealthSync.ts` (dedup `inFlight` + throttle) — wydzielone z
// `app/(tabs)/tasks.tsx`'s inline `useEffect` (2026-11-08, user: "jak wchodzę do
// apki to kalendarz sie nie ładuje na dashbordzie a powinien... tylko rozsądnie
// bez lagów") — TYLKO `tasks.tsx` wołał `googleCalendarService.fetchEvents()`,
// więc `gcalEvents` w Dashboardzie było czymkolwiek zostało w store z ostatniej
// sesji (albo puste) dopóki user nie odwiedził Zadań. `fetchEvents()` sam w
// sobie jest bezpiecznym no-opem dla niepołączonych kont (`refreshToken()`
// łapie błąd braku sesji Google i zwraca `null` → `[]`), więc hook woła go bez
// osobnego sprawdzania "czy połączone". Throttle (5 min, jak w health) —
// "rozsądnie bez lagów": każde wejście na Dashboard/Zadania odświeża, ale nie
// częściej niż raz na 5 min nawet przy szybkim przełączaniu zakładek.
const THROTTLE_MS = 5 * 60_000;
let lastSyncedAt = 0;
let inFlight: Promise<void> | null = null;

async function syncNow(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    if (Date.now() - lastSyncedAt < THROTTLE_MS) return;
    const fetched = await googleCalendarService.fetchEvents();
    useCalendarStore.getState().setGcalEvents(fetched);
    lastSyncedAt = Date.now();
  })().finally(() => { inFlight = null; });
  return inFlight;
}

export function useGoogleCalendarSync(): void {
  useEffect(() => { syncNow().catch(() => {}); }, []);
}
