import { useEffect } from 'react';
import { useBackgroundStore } from '@/store/backgroundStore';
import { applyBackgroundSchedule } from '@/services/backgroundRefresh';
import { useHydrated, type Persisted } from './useReplaceReminderSync';

// Harmonogram odświeżania w tle zgodny z ustawieniem (2026-11-22) — po wczytaniu i przy zmianie.
export function useBackgroundSchedule() {
  const interval = useBackgroundStore((st) => st.interval);
  const ready = useHydrated(useBackgroundStore as unknown as Persisted);
  useEffect(() => { if (ready) applyBackgroundSchedule(interval); }, [ready, interval]);
}
