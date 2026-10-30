import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { useCalendarStore } from '@/store/calendarStore';
import { todayISO } from '@/utils/date';
import { eventCoversDay, type Task } from '@/types/calendar';
import { googleCalendarService } from '@/services/googleCalendarService';
import WeekMonthCalendar from '@/components/tasks/WeekMonthCalendar';
import TaskRow from '@/components/tasks/TaskRow';
import AddTaskCard from '@/components/tasks/AddTaskCard';
import EventCard from '@/components/tasks/EventCard';

const DAY_FULL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const MONTH_SHORT = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

function fmtDay(dateYMD: string): string {
  const d = new Date(`${dateYMD}T00:00:00`);
  return `${DAY_FULL[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

// Faza 1b (2026-10-30, user: "Kalendarza tez nie ogarnąłeś... w zakladce nie widac
// niczego ani zadan ani kalendarza podpiętego") — REALNE UI podpięte pod `calendarStore`
// (warstwa danych z Fazy 1a, już przetestowana w Ustawieniach → Diagnostyka → "Sync
// kalendarza"), nie szkielet/zaślepka. Zadania (CRUD) — offline-first, leci TYLKO przez
// `useCalendarStore` (AsyncStorage, persystuje między uruchomieniami appki) — ŚWIADOMIE
// bez auto-synchronizacji ZAPISÓW do Firestore/Google Calendar przy każdej akcji z tego
// ekranu (pełen dwukierunkowy sync przy każdym CRUD to oddzielny kawałek pracy — patrz
// NEXT_STEPS.md). Kalendarz (widok) — ODCZYT z Google Calendar JEST automatyczny (patrz
// `useEffect`/`fetchEvents` niżej, dodane 2026-10-30 po tym jak user zauważył brak
// eventów) — to jednokierunkowe pociąganie do wyświetlenia, nie pełny sync zapisu.
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
  const setGcalEvents = useCalendarStore((st) => st.setGcalEvents);
  const addTask = useCalendarStore((st) => st.addTask);
  const updateTask = useCalendarStore((st) => st.updateTask);
  const deleteTask = useCalendarStore((st) => st.deleteTask);

  const [composerOpen, setComposerOpen] = useState(false);

  // Pociąganie realnych wydarzeń z Google Calendar (2026-10-30, user: "nie widzę
  // żadnych eventow w kalendarzu zaciagnietych z googla jak wcześniej w sapp") — brakowało
  // tego w ogóle, `gcalEvents` w `calendarStore` nigdy nie było wypełniane poza ręcznym
  // testem w Diagnostyce (który od razu kasuje swój event). Login appki
  // (`src/services/googleAuth.ts`) już prosi o scope `calendar.events`, więc token do
  // odczytu powinien być dostępny bez dodatkowego logowania. Cichy fallback do pustej
  // listy gdy brak tokenu (np. appka nigdy nie miała świeżej natywnej sesji Google) —
  // `googleCalendarService.fetchEvents` już to obsługuje, nic dodatkowego tu nie trzeba.
  // `gcalEvents` CELOWO nie jest trwałe w AsyncStorage (`calendarStore` partialize) —
  // zawsze świeże przy wejściu na ekran, nie przy starcie appki (Dashboard jeszcze nie
  // czyta prawdziwych eventów).
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

  // Kafelki wydarzeń dla zaznaczonego dnia (2026-10-30, user: "pamiętasz jak był
  // zrobiony kalendarz w sap... jak wyglądały kafelki eventów? To tak chce tutaj") —
  // port wyglądu `EventCard` z `sapp`'s `eventRow`, posortowane: wydarzenia bez
  // konkretnej godziny (`startTime` puste → '') najpierw, potem rosnąco po czasie,
  // tak samo jak sapp's `MonthModal`.
  const selectedDateEvents = useMemo(
    () => allEvents
      .filter((e) => eventCoversDay(e, selectedDate))
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')),
    [allEvents, selectedDate],
  );

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

        <View style={s.section}>
          <Text style={s.sectionTitle}>
            {selectedDate === today ? 'Dzisiaj' : fmtDay(selectedDate)}
          </Text>
          {selectedDateEvents.length === 0 ? (
            <View style={s.card}>
              <Text style={s.empty}>Brak wydarzeń tego dnia.</Text>
            </View>
          ) : (
            selectedDateEvents.map((ev) => <EventCard key={ev.id} event={ev} />)
          )}
        </View>

        <AddTaskCard visible={composerOpen} onAdd={handleAdd} onClose={() => setComposerOpen(false)} />

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

      {/* FAB zamiast pełnoszerokościowego przycisku "+ Nowe zadanie" w scrollu
          (2026-10-30, user: "zależy nam na przestrzeni... chcę mieć zamiast tam
          przycisk w prawym nad navbarem") — pływa nad zawartością w rogu ekranu, nie
          zajmuje stałego miejsca na liście. `bottom`/`right` liczone względem TEGO
          ekranu (SafeAreaView), NIE całego okna — TabBar w app/(tabs)/_layout.tsx
          jest osobnym, sąsiednim elementem flex pod `<Tabs>`, więc "dół ekranu" tutaj
          już kończy się TUŻ NAD navbarem, bez potrzeby doliczania jego wysokości. */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => setComposerOpen((v) => !v)}
        activeOpacity={0.8}
        accessibilityLabel={composerOpen ? 'Zamknij dodawanie zadania' : 'Nowe zadanie'}
      >
        {composerOpen
          ? <X size={22} color={colors.bg.primary} />
          : <Plus size={22} color={colors.bg.primary} />}
      </TouchableOpacity>
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
  fab: {
    position: 'absolute', right: spacing[4], bottom: spacing[4],
    width: 52, height: 52, borderRadius: radius.full, backgroundColor: c.text.bright,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 6,
  },
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    overflow: 'hidden',
  },
  empty: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, padding: spacing[4], textAlign: 'center' },
}));
