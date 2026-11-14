import { useEffect, useState } from 'react';
import { useReplacementsStore } from '@/store/replacementsStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { syncReplaceReminders } from '@/services/replaceReminders';
import { useThresholdsStore } from '@/store/thresholdsStore';
import { carMaintItems, carReminderItems } from '@/utils/replacements';

export type Persisted = { persist: { hasHydrated: () => boolean; onFinishHydration: (cb: () => void) => () => void } };
export function useHydrated(store: Persisted): boolean {
  const [h, setH] = useState(() => store.persist.hasHydrated());
  useEffect(() => {
    if (h) return;
    if (store.persist.hasHydrated()) { setH(true); return; }
    return store.persist.onFinishHydration(() => setH(true));
  }, [h, store]);
  return h;
}

// Przypomnienia o wymianach zgodne z listą (2026-11-13) — po hydracji OBU
// store'ów (wcześniej listy są puste i sync skasowałby wszystko) i przy każdej
// zmianie. Serwis pojazdów z interwałem też przypomina (tydzień przed) — to te
// same Wymiany (user: "olej do wymienienia za tydzień"). Przy starcie appki
// dokłada też przypomnienie "po terminie", gdy pierwsze minęło.
export function useReplaceReminderSync() {
  const items = useReplacementsStore((st) => st.items);
  const vehicles = useVehiclesStore((st) => st.vehicles);
  // Oba hooki zawsze wołane (bez && — kolejność hooków musi być stała).
  const repReady = useHydrated(useReplacementsStore as unknown as Persisted);
  const vehReady = useHydrated(useVehiclesStore as unknown as Persisted);
  const ready = repReady && vehReady;
  const reminderHour = useThresholdsStore((st) => st.t.reminderHour);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => syncReplaceReminders([...items, ...carReminderItems(carMaintItems(vehicles))]), 800);
    return () => clearTimeout(t);
  }, [ready, items, vehicles, reminderHour]);
}
