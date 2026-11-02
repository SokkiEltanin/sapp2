import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Plus } from 'lucide-react-native';
import { spacing, themedStyles } from '@/theme';
import { Screen, Row, Tile, FitList } from '@/ui/layout';
import { C, T, R } from '@/ui/theme';
import { haptic } from '@/utils/haptics';
import Segmented from '@/components/design/Segmented';
import { useCalendarStore } from '@/store/calendarStore';
import { todayISO } from '@/utils/date';
import { eventCoversDay, type Task } from '@/types/calendar';
import { googleCalendarService } from '@/services/googleCalendarService';
import WeekMonthCalendar from '@/components/tasks/WeekMonthCalendar';
import TaskRow from '@/components/tasks/TaskRow';
import AddTaskCard from '@/components/tasks/AddTaskCard';
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
// Nowość tej rundy: nagłówek dostał zakres tygodnia ("1 – 7 LIS", `weekRangeLabel`
// niżej) — brakowało go względem mockupu, `WeekMonthCalendar` liczy TEN SAM
// poniedziałek-niedziela zawsze z `new Date()` (nie nawigowalny), więc etykieta
// może to policzyć niezależnie bez propsów.
//
// `WeekMonthCalendar.tsx`/`TaskRow.tsx` BEZ ZMIAN — już matchują spec koncepcyjnie
// (patrz komentarz w WeekMonthCalendar.tsx), tylko nowy `Tile`/`FitList` dookoła.
const MONTHS_ABBR = ['STY', 'LUT', 'MAR', 'KWI', 'MAJ', 'CZE', 'LIP', 'SIE', 'WRZ', 'PAŹ', 'LIS', 'GRU'];
function weekRangeLabel(base: Date): string {
  const dow = base.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()} – ${sunday.getDate()} ${MONTHS_ABBR[sunday.getMonth()]}`;
  }
  return `${monday.getDate()} ${MONTHS_ABBR[monday.getMonth()]} – ${sunday.getDate()} ${MONTHS_ABBR[sunday.getMonth()]}`;
}

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
  const [segment, setSegment] = useState<'wszystkie' | 'teraz' | 'bezterminowe'>('wszystkie');

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
    <Screen title="Zadania" right={<Text style={T.small}>{weekRangeLabel(new Date())}</Text>}>
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
            minRowH={56}
            maxRowH={56}
            renderItem={(t, i) => (
              <TaskRow key={t.id} task={t} isLast={i === activeList.length - 1} onToggleDone={handleToggleDone} onDelete={deleteTask} />
            )}
            emptyText="Pusto"
          />
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
            <TouchableOpacity style={s.addBtn} onPress={() => { haptic.tap(); setComposerOpen(true); }} activeOpacity={0.8}>
              <Plus size={18} color={C.bg} />
            </TouchableOpacity>
          </View>
        </Tile>
      </Row>

      <AppBottomSheet visible={composerOpen} onClose={() => setComposerOpen(false)}>
        <AddTaskCard onAdd={handleAdd} onClose={() => setComposerOpen(false)} />
      </AppBottomSheet>

      <DayDetailModal
        visible={!!detailDate}
        dateYMD={detailDate ?? today}
        events={detailDateEvents}
        onClose={() => setDetailDate(null)}
      />
    </Screen>
  );
}

function genId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const makeS = themedStyles(() => StyleSheet.create({
  weekTile: { padding: 6 },
  listTile: { gap: spacing[2] },
  bottomRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  addBtn: {
    width: 48, height: 48, borderRadius: R.btn, backgroundColor: C.hi,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
}));
