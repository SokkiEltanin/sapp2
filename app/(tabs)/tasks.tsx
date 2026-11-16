import { router, useLocalSearchParams } from 'expo-router';
import { offerUndo } from '@/services/undo';
import { useEffect, useMemo, useRef, useState } from 'react';
import LazyMount from '@/components/design/LazyMount';
import { View, Text, StyleSheet, TouchableOpacity, type TextInput } from 'react-native';
import { Plus, Search, CheckCheck, Flame, History } from 'lucide-react-native';
import TaskHistorySheet from '@/components/tasks/TaskHistorySheet';
import TaskSearchSheet from '@/components/tasks/TaskSearchSheet';
import { spacing, radius, themedStyles } from '@/theme';
import { colors } from '@/theme/colors';
import { Screen, Row, Tile, FitList } from '@/ui/layout';
import { C, T, R } from '@/ui/theme';
import { haptic } from '@/utils/haptics';
import Segmented from '@/components/design/Segmented';
import { useCalendarStore } from '@/store/calendarStore';
import { todayISO } from '@/utils/date';
import { eventCoversDay, type Task } from '@/types/calendar';
import { useGoogleCalendarSync } from '@/hooks/useGoogleCalendarSync';
import WeekMonthCalendar from '@/components/tasks/WeekMonthCalendar';
import TaskRow from '@/components/tasks/TaskRow';
import { tagColorMap } from '@/utils/taskTags';
import TaskDetailSheet from '@/components/tasks/TaskDetailSheet';
import { useTaskDraftStore } from '@/store/taskDraftStore';
import { doneStats, cheer } from '@/utils/taskProgress';
import type { Subtask } from '@/types/calendar';
import AddTaskCard from '@/components/tasks/AddTaskCard';
import { useQuickAdd, takeQuickAdd } from '@/services/quickAdd';
import DayDetailModal from '@/components/tasks/DayDetailModal';
import AppBottomSheet from '@/components/design/AppBottomSheet';

// Faza 3.10 (design/rn kit) — Zadania przebudowane na kitu's `src/ui/layout.tsx`
// prymitywy (Screen/Row/Tile/FitList), ten sam powód co pozostałe 3 ekrany
// (ARCHITECTURE.md §"Faza 3.10"). Układ: WeekStrip(4, padding 6) → lista
// zadań(4, fill) + Segmented + "+" inline (NIE floating FAB — spec pokazuje
// przycisk PRZY segmencie, w tej samej karcie co lista).
//
// Kafel "agenda wybranego dnia" (glance max 3 wydarzeń pod WeekStrip, był w
// design/app-design.html's `#tasks` jako środkowy rząd) USUNIĘTY na wyraźną
// prośbę usera (2026-11-02, "wywal kafelek wydarzeń pod kalendarzem") —
// dublował `DayDetailModal` (tap na dzień w WeekStrip wciąż go otwiera, pełna
// lista wydarzeń tego dnia) bez dodawania niczego nowego. Odstępstwo od
// mockupu świadome, na wyraźne życzenie, nie przeoczenie.
//
// Nagłówek: od 2026-11-16 licznik zrobionych dziś + seria dni zamiast zakresu tygodnia.
//
// `WeekMonthCalendar.tsx`/`TaskRow.tsx` BEZ ZMIAN — już matchują spec koncepcyjnie
// (patrz komentarz w WeekMonthCalendar.tsx), tylko nowy `Tile`/`FitList` dookoła.

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

  const [composerOpen, setComposerOpen] = useState(false);
  // Skrót Z na komputerze (services/quickAdd.ts).
  const quickAdd = useQuickAdd((st) => st.pending);
  useEffect(() => { if (takeQuickAdd('task')) setComposerOpen(true); }, [quickAdd]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // Wynik wyszukiwania w całej appce → edycja tego zadania.
  const { task: taskParam } = useLocalSearchParams<{ task?: string }>();
  useEffect(() => {
    if (!taskParam) return;
    const t = useCalendarStore.getState().tasks.find((x) => x.id === taskParam);
    if (t) setDetailId(t.id);
    router.setParams({ task: undefined } as any);
  }, [taskParam]);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [segment, setSegment] = useState<'wszystkie' | 'teraz' | 'bezterminowe'>('wszystkie');
  const titleRef = useRef<TextInput>(null);
  // Cofnięcie "ukończ" (2026-11-11) — stuknięcie w kółko od razu chowało
  // zadanie z listy BEZ żadnej drogi powrotu (ukończone nie są nigdzie
  // pokazywane), więc przypadkowe stuknięcie gubiło zadanie. Pasek "Cofnij"
  // przez kilka sekund.
  const [justDone, setJustDone] = useState<Task | null>(null);
  const [cheerText, setCheerText] = useState('');
  // Szczegóły zadania (2026-11-16): tap na kafelek / wynik szukania / widget.
  // Edycja i usuwanie z okna szczegółów otwierają się DOPIERO po jego zamknięciu
  // (dwa sheety naraz = puste okno, ten sam bug co 2026-11-11).
  const [detailId, setDetailId] = useState<string | null>(null);
  const afterDetail = useRef<{ kind: 'edit' | 'delete'; task: Task } | null>(null);
  const stats = useMemo(() => doneStats(tasks), [tasks]);
  const hasDraft = useTaskDraftStore((st) => !!st.drafts.new);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Kosz starszy niż 30 dni → na stałe (raz przy wejściu).
  useEffect(() => { useCalendarStore.getState().purgeDeleted(); }, []);
  useEffect(() => {
    if (!justDone) return;
    const t = setTimeout(() => setJustDone(null), 5000);
    return () => clearTimeout(t);
  }, [justDone]);

  // Tagi posortowane po częstości użycia — szybki wybór w formularzu.
  const knownTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) if (t.status !== 'deleted') for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [tasks]);

  // 2026-11-08: wydzielone do `useGoogleCalendarSync` (patrz tam) — Dashboard
  // teraz wola ten sam hook, więc "kalendarz nie ładuje się na dashbordzie"
  // (user) jest naprawione bez dublowania fetcha w dwóch miejscach.
  useGoogleCalendarSync();

  const today = todayISO();
  const allEvents = useMemo(() => [...events, ...gcalEvents], [events, gcalEvents]);
  const tagColors = useMemo(() => tagColorMap(allEvents), [allEvents]);

  const detailDateEvents = useMemo(
    () => (detailDate
      ? allEvents
        .filter((e) => eventCoversDay(e, detailDate))
        .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
      : []),
    [allEvents, detailDate],
  );

  // Zakładki: Wszystkie/Teraz/Bezterminowe (2026-11-02, user: "zróbmy WSZYSTKIE,
  // TERAZ, BEZTERMINOWE zakładki bo inaczej bez sensu" — "Terminowe" jako osobna
  // zakładka odpadło, bo "Wszystkie" już je pokazuje). "Wszystkie" = każde pending
  // zadanie, posortowane: najbliższy termin pierwszy, potem bezterminowe (najnowsze
  // najpierw). "Teraz" = termin dziś lub wcześniej (zaległe + dzisiejsze).
  // "Bezterminowe" = bez terminu w ogóle.
  const buckets = useMemo(() => {
    const pending = tasks.filter((t) => t.status === 'pending');
    const teraz: Task[] = [];
    const bezterminowe: Task[] = [];
    for (const t of pending) {
      const deadline = t.deadline?.slice(0, 10);
      if (deadline && deadline <= today) teraz.push(t);
      else if (!deadline) bezterminowe.push(t);
    }
    teraz.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    bezterminowe.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const wszystkie = [...pending].sort((a, b) => {
      const da = a.deadline?.slice(0, 10);
      const db = b.deadline?.slice(0, 10);
      if (da && db) return da.localeCompare(db);
      if (da && !db) return -1;
      if (!da && db) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return { wszystkie, teraz, bezterminowe };
  }, [tasks, today]);

  const activeList = buckets[segment];

  const handleSaveTask = (input: { title: string; tags: string[]; deadline?: string; subtasks?: Subtask[] }) => {
    const now = new Date().toISOString();
    if (editingTask) {
      updateTask(editingTask.id, { title: input.title, tags: input.tags, deadline: input.deadline, subtasks: input.subtasks, updatedAt: now });
    } else {
      addTask({
        id: genId(),
        title: input.title,
        tags: input.tags,
        deadline: input.deadline,
        subtasks: input.subtasks,
        status: 'pending',
        priority: 'normal',
        createdAt: now,
        updatedAt: now,
      });
    }
  };
  const closeComposer = () => { setComposerOpen(false); setEditingTask(null); };

  const handleToggleDone = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    updateTask(id, { status: 'done', updatedAt: new Date().toISOString() });
    if (task) { setJustDone(task); setCheerText(cheer(doneStats(useCalendarStore.getState().tasks))); }
  };
  const undoDone = () => {
    if (!justDone) return;
    haptic.tap();
    updateTask(justDone.id, { status: 'pending', updatedAt: new Date().toISOString() });
    setJustDone(null);
  };

  return (
    <Screen title="Zadania" right={
      // Motywacja (2026-11-16): ile dziś odhaczone + seria dni z rzędu.
      <View style={s.stats}>
        <TouchableOpacity onPress={() => { haptic.tap(); setHistoryOpen(true); }} hitSlop={8} style={s.histBtn} accessibilityLabel="Historia zadań (zrobione i kosz)">
          <History size={15} color={C.txt} />
        </TouchableOpacity>
        <CheckCheck size={13} color={stats.today ? C.hi : C.mut} />
        <Text style={[s.statTxt, stats.today > 0 && { color: C.hi }]}>{stats.today} dziś</Text>
        {stats.streak > 0 && <>
          <Flame size={13} color={colors.accent.orange} />
          <Text style={[s.statTxt, { color: colors.accent.orange }]}>{stats.streak} {stats.streak === 1 ? 'dzień' : 'dni'}</Text>
        </>}
      </View>
    }>
      <Row>
        <Tile span={4} style={s.weekTile}>
          <WeekMonthCalendar
            events={allEvents}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onOpenDay={setDetailDate}
          />
        </Tile>
      </Row>

      <Row flex={1}>
        <Tile span={4} style={s.listTile}>
          <FitList
            data={activeList}
            minRowH={62}
            maxRowH={66}
            renderItem={(t, i) => (
              <TaskRow
                key={t.id}
                task={t}
                isLast={i === activeList.length - 1}
                onToggleDone={handleToggleDone}
                onRequestDelete={setDeletingTask}
                onEdit={(t) => setDetailId(t.id)}
                tagColors={tagColors}
              />
            )}
            emptyText="Pusto"
          />
          {justDone && (
            <View style={s.undoBar}>
              <Text style={s.undoText} numberOfLines={1}>{cheerText || `Ukończono: ${justDone.title}`}</Text>
              <TouchableOpacity onPress={undoDone} hitSlop={8} activeOpacity={0.7}>
                <Text style={s.undoBtn}>Cofnij</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={s.bottomRow}>
            <Segmented
              options={[
                { key: 'wszystkie', label: 'Wszystkie', count: buckets.wszystkie.length },
                { key: 'teraz', label: 'Teraz', count: buckets.teraz.length },
                { key: 'bezterminowe', label: 'Bez terminu', count: buckets.bezterminowe.length },
              ]}
              activeKey={segment}
              onChange={(k) => setSegment(k as typeof segment)}
            />
            <TouchableOpacity style={s.searchBtn} onPress={() => { haptic.tap(); setSearchOpen(true); }} activeOpacity={0.8} accessibilityLabel="Szukaj zadań">
              <Search size={16} color={C.txt} />
            </TouchableOpacity>
            <TouchableOpacity style={s.addBtn} onPress={() => { haptic.tap(); setComposerOpen(true); }} activeOpacity={0.8}
              accessibilityLabel={hasDraft ? 'Dokończ szkic zadania' : 'Nowe zadanie'}>
              <Plus size={18} color={C.bg} />
              {/* Niedokończony szkic (store/taskDraftStore.ts) — kropka na "+". */}
              {hasDraft && <View style={s.draftDot} />}
            </TouchableOpacity>
          </View>
        </Tile>
      </Row>

      <LazyMount visible={searchOpen}>
        <TaskSearchSheet visible={searchOpen} onClose={() => setSearchOpen(false)} knownTags={knownTags}
          onEdit={(t) => { setSearchOpen(false); setDetailId(t.id); }} />
      </LazyMount>

      <AppBottomSheet visible={composerOpen || !!editingTask} onClose={closeComposer} initialFocusRef={titleRef}>
        <AddTaskCard
          editingTask={editingTask}
          onSave={handleSaveTask}
          onClose={closeComposer}
          titleRef={titleRef}
          knownTags={knownTags}
        />
      </AppBottomSheet>

      {/* Potwierdzenie usunięcia (2026-11-08, user: "dodac... potwierdzenie
          usunięcia taskow") — mały, nie-scrollowalny sheet zamiast natywnego
          `Alert.alert` (jedyny `Alert` w appce był tymczasową diagnostyką
          bottom-sheeta, usuniętą — appka konsekwentnie NIE używa natywnego
          chrome tam gdzie to widoczna, częsta interakcja, tylko tam gdzie
          oszczędza realną złożoność, jak natywny date/time picker wyżej). */}
      <AppBottomSheet visible={!!deletingTask} onClose={() => setDeletingTask(null)} scrollable={false}>
        {deletingTask && (
          <View style={s.confirmBody}>
            <Text style={s.confirmTitle}>Usunąć zadanie?</Text>
            <Text style={s.confirmText} numberOfLines={2}>{deletingTask.title}</Text>
            <View style={s.confirmActions}>
              <TouchableOpacity style={s.confirmCancel} onPress={() => { haptic.tap(); setDeletingTask(null); }} activeOpacity={0.7}>
                <Text style={s.confirmCancelLabel}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.confirmDelete}
                onPress={() => {
                  // Do kosza, nie na zawsze (2026-11-16) — Historia zadań → Kosz → Przywróć.
                  haptic.warn();
                  const t = deletingTask;
                  updateTask(t.id, { status: 'deleted' });
                  offerUndo(`Do kosza: ${t.title}`, () => updateTask(t.id, { status: t.status === 'deleted' ? 'pending' : t.status }));
                  setDeletingTask(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={s.confirmDeleteLabel}>Usuń</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </AppBottomSheet>

      <TaskDetailSheet
        taskId={detailId}
        tagColors={tagColors}
        onClose={() => setDetailId(null)}
        onClosed={() => {
          const a = afterDetail.current;
          afterDetail.current = null;
          if (a?.kind === 'edit') setEditingTask(a.task);
          else if (a?.kind === 'delete') setDeletingTask(a.task);
        }}
        onEdit={(t) => { afterDetail.current = { kind: 'edit', task: t }; setDetailId(null); }}
        onDelete={(t) => { afterDetail.current = { kind: 'delete', task: t }; setDetailId(null); }}
        onDone={(t) => { handleToggleDone(t.id); setDetailId(null); }}
      />

      <LazyMount visible={historyOpen}>
        <TaskHistorySheet visible={historyOpen} onClose={() => setHistoryOpen(false)} />
      </LazyMount>
      <LazyMount visible={!!detailDate}>
        <DayDetailModal
          visible={!!detailDate}
          dateYMD={detailDate ?? today}
          events={detailDateEvents}
          onClose={() => setDetailDate(null)}
        />
      </LazyMount>
    </Screen>
  );
}

function genId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const makeS = themedStyles((c) => StyleSheet.create({
  weekTile: { padding: 6 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  histBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.in2, marginRight: 6 },
  statTxt: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: C.mut, marginRight: 4 },
  listTile: { gap: spacing[2] },
  bottomRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  undoBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: c.bg.elevated, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  undoText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.secondary },
  undoBtn: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.text.bright },
  searchBtn: {
    width: 48, height: 48, borderRadius: R.btn, borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  draftDot: { position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent.orange, borderWidth: 1.5, borderColor: C.txt },
  addBtn: {
    width: 48, height: 48, borderRadius: R.btn, backgroundColor: C.hi,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  confirmBody: { gap: spacing[2], paddingVertical: spacing[1] },
  confirmTitle: { fontSize: 18, fontFamily: 'Inter_800ExtraBold', color: c.text.bright },
  confirmText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.secondary },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[2] },
  confirmCancel: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  confirmCancelLabel: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  confirmDelete: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.md, backgroundColor: colors.accent.red },
  confirmDeleteLabel: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: '#fff' },
}));
