import { useEffect } from 'react';
import { useCalendarStore } from '@/store/calendarStore';
import { syncTaskReminders } from '@/services/taskReminders';
import { useHydrated, type Persisted } from './useReplaceReminderSync';

// Przypomnienia o zadaniach zgodne z listą (2026-11-14) — po hydracji (wcześniej
// lista jest pusta i sync skasowałby wszystkie) i przy każdej zmianie zadań
// (dodanie, odhaczenie, zmiana godziny, synchronizacja z komputera).
export function useTaskReminderSync() {
  const tasks = useCalendarStore((st) => st.tasks);
  const ready = useHydrated(useCalendarStore as unknown as Persisted);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => syncTaskReminders(tasks), 800);
    return () => clearTimeout(t);
  }, [ready, tasks]);
}
