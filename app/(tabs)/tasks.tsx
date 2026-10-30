import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, radius, themedStyles } from '@/theme';
import { useCalendarStore } from '@/store/calendarStore';
import { todayISO } from '@/utils/date';
import type { Task } from '@/types/calendar';
import WeekMonthCalendar from '@/components/tasks/WeekMonthCalendar';
import TaskRow from '@/components/tasks/TaskRow';
import AddTaskCard from '@/components/tasks/AddTaskCard';

// Faza 1b (2026-10-30, user: "Kalendarza tez nie ogarnąłeś... w zakladce nie widac
// niczego ani zadan ani kalendarza podpiętego") — REALNE UI podpięte pod `calendarStore`
// (warstwa danych z Fazy 1a, już przetestowana w Ustawieniach → Diagnostyka → "Sync
// kalendarza"), nie szkielet/zaślepka. Offline-first: CRUD leci TYLKO przez
// `useCalendarStore` (AsyncStorage, persystuje między uruchomieniami appki) — ŚWIADOMIE
// bez auto-synchronizacji do Firestore/Google Calendar przy każdej akcji z tego ekranu
// (to osobny, już istniejący, ręczny test w Diagnostyce; pełen dwukierunkowy sync przy
// każdym CRUD to oddzielny kawałek pracy, nie "burdel pod przyszłość" dorzucony na
// szybko — patrz NEXT_STEPS.md).
//
// Kategoryzacja TERAZ/TERMINOWE/BEZTERMINOWE — jedno pole `deadline` napędza wszystko
// (patrz AddTaskCard.tsx): `deadline <= dziś` → TERAZ (aktywne/zaległe), `deadline` w
// przyszłości → TERMINOWE, brak `deadline` → BEZTERMINOWE. `status: 'done'` znika z
// listy (checkbox w TaskRow) — brak osobnej sekcji "ukończone" na razie, jeśli user
// zechce historię ukończonych zadań to osobna, świadoma decyzja, nie zgadywanie teraz.
const SECTIONS = [
  { key: 'teraz', title: 'Teraz', hint: 'Brak aktywnych zadań na dziś.' },
  { key: 'terminowe', title: 'Terminowe', hint: 'Brak zadań z terminem.' },
  { key: 'bezterminowe', title: 'Bezterminowe', hint: 'Brak zadań bez terminu.' },
] as const;

function genId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export default function TasksScreen() {
  const s = makeS();
  const tasks = useCalendarStore((st) => st.tasks);
  const events = useCalendarStore((st) => st.events);
  const gcalEvents = useCalendarStore((st) => st.gcalEvents);
  const selectedDate = useCalendarStore((st) => st.selectedDate);
  const setSelectedDate = useCalendarStore((st) => st.setSelectedDate);
  const addTask = useCalendarStore((st) => st.addTask);
  const updateTask = useCalendarStore((st) => st.updateTask);
  const deleteTask = useCalendarStore((st) => st.deleteTask);

  const today = todayISO();
  const allEvents = useMemo(() => [...events, ...gcalEvents], [events, gcalEvents]);

  const buckets = useMemo(() => {
    const pending = tasks.filter((t) => t.status === 'pending');
    const teraz: Task[] = [];
    const terminowe: Task[] = [];
    const bezterminowe: Task[] = [];
    for (const t of pending) {
      const deadline = t.deadline?.slice(0, 10);
      if (deadline && deadline <= today) teraz.push(t);
      else if (deadline) terminowe.push(t);
      else bezterminowe.push(t);
    }
    terminowe.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));
    teraz.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    bezterminowe.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { teraz, terminowe, bezterminowe };
  }, [tasks, today]);

  const handleAdd = (input: { title: string; tags: string[]; deadline?: string }) => {
    const now = new Date().toISOString();
    addTask({
      id: genId(),
      title: input.title,
      tags: input.tags,
      deadline: input.deadline,
      status: 'pending',
      priority: 'normal',
      createdAt: now,
      updatedAt: now,
    });
  };

  const handleToggleDone = (id: string) => {
    updateTask(id, { status: 'done', updatedAt: new Date().toISOString() });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Zadania</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <WeekMonthCalendar events={allEvents} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        <AddTaskCard onAdd={handleAdd} />

        {SECTIONS.map((section) => {
          const list = buckets[section.key];
          return (
            <View key={section.key} style={s.section}>
              <Text style={s.sectionTitle}>
                {section.title}{list.length > 0 ? ` (${list.length})` : ''}
              </Text>
              <View style={s.card}>
                {list.length === 0 ? (
                  <Text style={s.empty}>{section.hint}</Text>
                ) : (
                  list.map((t, i) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      isLast={i === list.length - 1}
                      onToggleDone={handleToggleDone}
                      onDelete={deleteTask}
                    />
                  ))
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  title: { fontSize: 22, fontFamily: 'Inter_900Black', color: c.text.primary },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] },
  section: { marginBottom: spacing[4] },
  sectionTitle: {
    fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2],
  },
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    overflow: 'hidden',
  },
  empty: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, padding: spacing[4], textAlign: 'center' },
}));
