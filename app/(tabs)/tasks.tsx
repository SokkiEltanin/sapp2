import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import Tile from '@/components/design/Tile';
import Row from '@/components/design/Row';
import Segmented from '@/components/design/Segmented';
import FitList from '@/components/design/FitList';
import { useCalendarStore } from '@/store/calendarStore';
import { todayISO } from '@/utils/date';
import { eventCoversDay, type Task } from '@/types/calendar';
import { googleCalendarService } from '@/services/googleCalendarService';
import WeekMonthCalendar from '@/components/tasks/WeekMonthCalendar';
import TaskRow from '@/components/tasks/TaskRow';
import AddTaskCard from '@/components/tasks/AddTaskCard';
import DayDetailModal from '@/components/tasks/DayDetailModal';
import AppBottomSheet from '@/components/design/AppBottomSheet';

// Faza 3.5 (2026-11-01, "dawaj skończ wszystko") — Zadania przebudowane na nowy
// grid, układ z design/app-design.html's `#tasks` (4 kolumny, `grid-template-rows:
// auto auto 1fr`): WeekStrip → agenda wybranego dnia → lista zadań (JEDEN
// aktywny segment na raz, `Segmented` Teraz/Terminowe/Bez terminu, + przycisk
// inline, NIE floating FAB jak wcześniej — spec pokazuje przycisk "+" PRZY
// segmencie, w tej samej karcie co lista, nie pływający w rogu).
//
// `WeekMonthCalendar.tsx`/`TaskRow.tsx` BEZ ZMIAN — już matchują spec koncepcyjnie
// (7-kolumnowy tydzień z chipami wydarzeń = dokładnie `WeekStrip`; miesiąc-popup to
// realna, poza-spec funkcja zachowana jak "Produkty" w Finansach).
//
// Kompozytor "+" (2026-11-02, kontynuacja migracji popupów z Faza 3.6) — `AddTaskCard`
// (wcześniej inline w scrollu, potem opakowany w plain `Modal`+ręczny backdrop)
// teraz w `AppBottomSheet` — `DayDetailModal.tsx` też przebudowany na to samo, patrz
// tam.
export default function TasksScreen() {
  const s = makeS();
  const tasks = useCalendarStore((st) => st.tasks);
  const events = useCalendarStore((st) => st.events);
  const gcalEvents = useCalendarStore((st) => st.gcalEvents);
  const selectedDate = useCalendarStore((st) => st.selectedDate);
  const setSelectedDate = useCalendarStore((st) => st.setSelectedDate);
  const setGcalEvents = useCalendarStore((st) => st.setGcalEvents);
  const addTask = useCalendarStore((st) => st.addTask);
  const updateTask = useCalendarStore((st) => st.updateTask);
  const deleteTask = useCalendarStore((st) => st.deleteTask);

  const [composerOpen, setComposerOpen] = useState(false);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [segment, setSegment] = useState<'teraz' | 'terminowe' | 'bezterminowe'>('teraz');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fetched = await googleCalendarService.fetchEvents();
      if (!cancelled) setGcalEvents(fetched);
    })();
    return () => { cancelled = true; };
  }, [setGcalEvents]);

  const today = todayISO();
  const allEvents = useMemo(() => [...events, ...gcalEvents], [events, gcalEvents]);

  const detailDateEvents = useMemo(
    () => (detailDate
      ? allEvents
        .filter((e) => eventCoversDay(e, detailDate))
        .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
      : []),
    [allEvents, detailDate],
  );

  // Agenda inline (glance, max 3) dla dnia WYBRANEGO w WeekStrip — tap na wiersz
  // albo na cały kafel otwiera `DayDetailModal` z pełną listą (ten sam podział
  // "podgląd na ekranie / pełny popup" co Dashboard robi dla Jedzenia.
  const agendaDate = selectedDate || today;
  const agendaEvents = useMemo(
    () => allEvents
      .filter((e) => eventCoversDay(e, agendaDate))
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')),
    [allEvents, agendaDate],
  );
  const agendaDateObj = new Date(`${agendaDate}T00:00:00`);
  const agendaLabel = agendaDateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

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

  const activeList = buckets[segment];

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

      <View style={s.content}>
        {/* Rząd 1 (auto): WeekStrip — komponent bez zmian */}
        <WeekMonthCalendar
          events={allEvents}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onOpenDay={setDetailDate}
        />

        {/* Rząd 2 (auto): agenda wybranego dnia, glance max 3 */}
        <Tile style={s.agendaTile} variant="static">
          <TouchableOpacity style={s.capRow} onPress={() => setDetailDate(agendaDate)} activeOpacity={0.6}>
            <Text style={s.capLabel} numberOfLines={1}>{agendaLabel.toUpperCase()}</Text>
            <Text style={s.capUnit}>{agendaEvents.length} wydarz.</Text>
          </TouchableOpacity>
          {agendaEvents.length === 0 ? (
            <Text style={s.emptyInline}>Wolne</Text>
          ) : (
            agendaEvents.slice(0, 3).map((ev) => (
              <Row
                key={ev.id}
                height={36}
                onPress={() => setDetailDate(agendaDate)}
                left={<View style={[s.bar4, { backgroundColor: ev.color ?? colors.chart.muted }]} />}
                label={ev.title}
                right={ev.startTime ? <Text style={s.agendaTime}>{ev.startTime}</Text> : undefined}
              />
            ))
          )}
        </Tile>

        {/* Rząd 3 (flex): lista zadań (jeden segment) + Segmented + "+" */}
        <Tile style={[s.listTile, s.rowFlex1]} variant="static">
          <FitList
            data={activeList}
            itemHeight={56}
            gap={spacing[1]}
            keyExtractor={(t) => t.id}
            empty={<Text style={s.emptyInline}>Pusto</Text>}
            renderItem={(t) => (
              <TaskRow key={t.id} task={t} isLast onToggleDone={handleToggleDone} onDelete={deleteTask} />
            )}
          />
          <View style={s.bottomRow}>
            <Segmented
              options={[
                { key: 'teraz', label: 'Teraz', count: buckets.teraz.length },
                { key: 'terminowe', label: 'Terminowe', count: buckets.terminowe.length },
                { key: 'bezterminowe', label: 'Bez terminu', count: buckets.bezterminowe.length },
              ]}
              activeKey={segment}
              onChange={(k) => setSegment(k as typeof segment)}
            />
            <TouchableOpacity style={s.addBtn} onPress={() => setComposerOpen(true)} activeOpacity={0.8}>
              <Plus size={18} color={colors.bg.primary} />
            </TouchableOpacity>
          </View>
        </Tile>
      </View>

      <AppBottomSheet visible={composerOpen} onClose={() => setComposerOpen(false)}>
        <AddTaskCard onAdd={handleAdd} onClose={() => setComposerOpen(false)} />
      </AppBottomSheet>

      <DayDetailModal
        visible={!!detailDate}
        dateYMD={detailDate ?? today}
        events={detailDateEvents}
        onClose={() => setDetailDate(null)}
      />
    </SafeAreaView>
  );
}

function genId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  title: { fontSize: 22, fontFamily: 'Inter_900Black', letterSpacing: -0.5, color: c.text.bright },
  content: { flex: 1, paddingHorizontal: spacing[3], gap: spacing[2] },
  rowFlex1: { flex: 1 },

  capRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, color: c.text.primary, flex: 1, marginRight: spacing[2] },
  capUnit: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.text.muted },

  agendaTile: { gap: spacing[1] },
  emptyInline: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', paddingVertical: spacing[2] },
  bar4: { width: 3, height: 14, borderRadius: 2, flexShrink: 0 },
  agendaTime: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.bright },

  listTile: { gap: spacing[2] },
  bottomRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  addBtn: {
    width: 48, height: 48, borderRadius: radius.btn, backgroundColor: c.text.bright,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
}));
