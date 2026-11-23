import { useCalendarStore } from '@/store/calendarStore';
import { offerUndo } from '@/services/undo';
import { haptic } from '@/utils/haptics';

// Usuwanie starego tagu (2026-11-23, user: "przytrzymaj tag → usuń"). Tagi zadań nie mają
// osobnej listy — biorą się z zadań (app/(tabs)/tasks.tsx knownTags), więc "usuń tag" = zdjęcie
// go ze WSZYSTKICH zadań (też zrobionych i w koszu; same zadania zostają). Synchronizacja
// zadań zabiera zmianę na komputer. "Cofnij" przywraca dokładnie poprzednie tagi.
export function removeTaskTag(tag: string): void {
  const st = useCalendarStore.getState();
  const hit = st.tasks.filter((t) => t.tags.includes(tag));
  if (!hit.length) return;
  haptic.success();
  const before = new Map(hit.map((t) => [t.id, t.tags]));
  for (const t of hit) st.updateTask(t.id, { tags: t.tags.filter((x) => x !== tag) });
  offerUndo(`Usunięto tag #${tag} z ${hit.length} zad.`, () => {
    const s2 = useCalendarStore.getState();
    for (const [id, tags] of before) s2.updateTask(id, { tags });
  });
}
