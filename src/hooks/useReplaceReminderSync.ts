import { useEffect, useState } from 'react';
import { useReplacementsStore } from '@/store/replacementsStore';
import { syncReplaceReminders } from '@/services/replaceReminders';

// Przypomnienia o wymianach zgodne z listą (2026-11-13) — po hydracji (wcześniej
// lista jest pusta i sync skasowałby wszystko) i przy każdej zmianie. Przy
// starcie appki dokłada też przypomnienie "po terminie", gdy pierwsze minęło.
export function useReplaceReminderSync() {
  const items = useReplacementsStore((st) => st.items);
  const [hydrated, setHydrated] = useState(() => useReplacementsStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    return useReplacementsStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => syncReplaceReminders(items), 800);
    return () => clearTimeout(t);
  }, [hydrated, items]);
}
