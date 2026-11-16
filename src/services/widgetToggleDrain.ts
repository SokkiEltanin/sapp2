import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useCalendarStore } from '@/store/calendarStore';
import { syncTasksWidget } from './widgetSync';
import { applyWearSteps } from '@/utils/wearSteps';

// Odhaczenia z widgetu (2026-11-13): natywny provider przy tapie w kółko dopisuje
// id do widget_toggle_queue.json i od razu chowa wiersz; TU, przy otwarciu appki,
// zadanie dostaje status 'done' w prawdziwym store'ze (ten sam zapis co tap w
// liście Zadań), potem widget dostaje świeży snapshot.
const FILE = `${FileSystem.documentDirectory ?? ''}widget_toggle_queue.json`;
// Kroki odhaczone na zegarku (2026-11-16, plugins/withWearSync.js → "/sapp2/step").
const STEP_FILE = `${FileSystem.documentDirectory ?? ''}wear_step_queue.json`;

async function drainSteps(): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(STEP_FILE);
  if (!info.exists) return false;
  const raw = await FileSystem.readAsStringAsync(STEP_FILE);
  await FileSystem.writeAsStringAsync(STEP_FILE, '[]').catch(() => {});
  let msgs: unknown = [];
  try { msgs = JSON.parse(raw); } catch { return false; }
  if (!Array.isArray(msgs) || !msgs.length) return false;
  const st = useCalendarStore.getState();
  const changes = applyWearSteps(st.tasks, msgs);
  for (const [id, subtasks] of changes) st.updateTask(id, { subtasks });
  return changes.size > 0;
}

let running = false;

export async function drainWidgetToggleQueue(): Promise<void> {
  if (Platform.OS !== 'android' || running || !FileSystem.documentDirectory) return;
  running = true;
  try {
    // Najpierw kroki z zegarka (niezależnie od kolejki odhaczeń).
    if (await drainSteps().catch(() => false)) syncTasksWidget(useCalendarStore.getState().tasks).catch(() => {});
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return;
    const raw = await FileSystem.readAsStringAsync(FILE);
    await FileSystem.writeAsStringAsync(FILE, '[]').catch(() => {});
    let ids: unknown = [];
    try { ids = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(ids) || ids.length === 0) return;
    const st = useCalendarStore.getState();
    const now = new Date().toISOString();
    for (const id of ids) {
      const t = st.tasks.find((x) => x.id === String(id));
      if (t && t.status === 'pending') st.updateTask(t.id, { status: 'done', updatedAt: now });
    }
    syncTasksWidget(useCalendarStore.getState().tasks).catch(() => {});
  } catch {
  } finally {
    running = false;
  }
}
