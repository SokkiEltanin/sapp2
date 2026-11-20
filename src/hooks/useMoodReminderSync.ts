import { useEffect } from 'react';
import { useMoodStore } from '@/store/moodStore';
import { useMoodReminderStore } from '@/store/moodReminderStore';
import { syncMoodReminders } from '@/services/moodReminders';
import { useHydrated, type Persisted } from './useReplaceReminderSync';

// Przypomnienia o humorze zgodne z wpisami i ustawieniem (2026-11-18): po hydracji obu
// store'ów i przy każdej zmianie (wpis kasuje dzisiejsze przypomnienie).
export function useMoodReminderSync() {
  const entries = useMoodStore((st) => st.entries);
  const enabled = useMoodReminderStore((st) => st.enabled);
  const hour = useMoodReminderStore((st) => st.hour);
  const minute = useMoodReminderStore((st) => st.minute);
  const a = useHydrated(useMoodStore as unknown as Persisted);
  const b = useHydrated(useMoodReminderStore as unknown as Persisted);
  useEffect(() => {
    if (!a || !b) return;
    const t = setTimeout(() => { syncMoodReminders(); }, 1000);
    return () => clearTimeout(t);
  }, [a, b, entries, enabled, hour, minute]);
}
