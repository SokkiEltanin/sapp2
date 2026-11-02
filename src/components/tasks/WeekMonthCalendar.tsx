import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { ymd, todayISO } from '@/utils/date';
import { eventCoversDay, type CalendarEvent } from '@/types/calendar';
import MonthViewModal from './MonthViewModal';

// Kalendarz Zadań — dwa tryby: TYDZIEŃ (domyślny, zawsze bieżący tydzień Pon-Nd,
// inline) i MIESIĄC (bottom-sheet popup, patrz MonthViewModal.tsx). Przełącznik w
// nagłówku karty tylko OTWIERA popup miesiąca — tydzień zostaje jedynym inline
// widokiem w karcie, miesiąc nigdy nie renderuje się ściśnięty.
//
// Widok tygodnia PRZEROBIONY (2026-10-30, user podesłał screenshoty Samsung Calendar:
// "jak w samsung calendar taki tygodniowy... teraz za dużo miejsca jak kilka eventów
// będzie zajmować") — zamiast kółka z numerem dnia + jedna kropka "ma wydarzenie",
// każda kolumna dnia pokazuje WŁASNE wydarzenia jako małe kolorowe "chipy" (do
// `MAX_CHIPS_PER_DAY`, reszta jako "+N") — widać WSZYSTKIE 7 dni naraz na pierwszy
// rzut oka, bez wchodzenia w żaden dzień. Tap w kolumnę (gdziekolwiek, nie tylko w
// numer) → `onOpenDay` (rodzic otwiera modal ze szczegółami, patrz
// DayDetailModal.tsx — user: "dopiero po kliknięciu w dzień niech się otwiera jak
// tam [Samsung]") — kalendarz sam NIE renderuje już listy wydarzeń pod spodem, to
// zwalnia miejsce dla sekcji Zadań, które user explicite nazwał ważniejszymi
// ("a tak to zadania pod spodem tylko bo one są ważne").
//
// Widok miesiąca PRZENIESIONY do popupu, teraz `AppBottomSheet` (2026-11-01, user:
// "kalendarz w trybie rozłożonym niech też ma takie kafelki jak tygodniowy widok,
// może być nawet na cały ekran"; 2026-11-02: przebudowany z pełnoekranowego `Modal`
// na bottom-sheet, patrz MonthViewModal.tsx) — ciasna siatka 6×7 wewnątrz małej
// karty nie miała miejsca na chipy wydarzeń, tylko kropkę; sheet daje go
// wystarczająco (78% wysokości ekranu, scroll wewnątrz gdy trzeba).
const DAY_LABELS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];
const MAX_CHIPS_PER_DAY = 3;

function getWeekDays(base: Date): Date[] {
  const dow = base.getDay(); // 0=Nd..6=Sob
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function WeekMonthCalendar({
  events,
  selectedDate,
  onSelectDate,
  onOpenDay,
}: {
  events: CalendarEvent[];
  selectedDate: string;
  onSelectDate: (dateYMD: string) => void;
  onOpenDay: (dateYMD: string) => void;
}) {
  const s = makeS();
  const [monthOpen, setMonthOpen] = useState(false);
  const today = todayISO();

  const weekDays = useMemo(() => getWeekDays(new Date()), []);

  // Grupowanie wydarzeń tygodnia po dniu, JEDEN przebieg (nie 7× filter wewnątrz
  // renderu kolumn) — posortowane: bez godziny/all-day najpierw, potem rosnąco.
  const weekEventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const d of weekDays) {
      const key = ymd(d);
      const dayEvents = events
        .filter((e) => eventCoversDay(e, key))
        .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
      map.set(key, dayEvents);
    }
    return map;
  }, [weekDays, events]);

  const selectDay = (dateYMD: string) => {
    onSelectDate(dateYMD);
    onOpenDay(dateYMD);
  };

  return (
    <View style={s.card}>
      <TouchableOpacity style={s.header} onPress={() => setMonthOpen(true)} activeOpacity={0.7}>
        <Text style={s.headerLabel}>Ten tydzień</Text>
        <ChevronDown size={16} color={colors.text.muted} />
      </TouchableOpacity>

      <View style={s.weekGrid}>
        {weekDays.map((d) => {
          const dateYMD = ymd(d);
          const isToday = dateYMD === today;
          const isSelected = !isToday && dateYMD === selectedDate;
          const dayEvents = weekEventsByDay.get(dateYMD) ?? [];
          const overflow = dayEvents.length - MAX_CHIPS_PER_DAY;
          return (
            <TouchableOpacity
              key={dateYMD}
              style={s.dayCol}
              onPress={() => selectDay(dateYMD)}
              activeOpacity={0.7}
            >
              <Text style={s.dayLabel}>{DAY_LABELS[(d.getDay() + 6) % 7]}</Text>
              <View style={[s.dayNumWrap, isToday && s.cellToday, isSelected && s.cellSelected]}>
                <Text style={[s.dayNum, s.weekDayNum, isToday && s.dayNumToday]}>{d.getDate()}</Text>
              </View>
              <View style={s.chips}>
                {dayEvents.slice(0, MAX_CHIPS_PER_DAY).map((ev) => (
                  <View key={ev.id} style={[s.chip, { backgroundColor: ev.color ?? colors.chart.muted }]}>
                    <Text style={s.chipLabel} numberOfLines={2}>{ev.title}</Text>
                  </View>
                ))}
                {overflow > 0 && <Text style={s.moreLabel}>+{overflow}</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <MonthViewModal
        visible={monthOpen}
        events={events}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        onOpenDay={onOpenDay}
        onClose={() => setMonthOpen(false)}
      />
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[3], marginBottom: spacing[4],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  headerLabel: { flex: 1, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Kolumna na dzień: etykieta, numer (badge), stos chipów wydarzeń.
  weekGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 3 },
  dayCol: { flex: 1, alignItems: 'center', gap: 3 },
  dayLabel: { fontSize: 9.5, fontFamily: 'Inter_500Medium', color: c.text.muted, textTransform: 'uppercase' },
  dayNumWrap: { width: 24, height: 24, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  weekDayNum: { fontSize: 11.5 },
  chips: { width: '100%', gap: 2 },
  chip: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 3, minHeight: 26, justifyContent: 'center' },
  chipLabel: { fontSize: 8.5, fontFamily: 'Inter_700Bold', color: '#FFFFFF', lineHeight: 10 },
  moreLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', color: c.text.muted, textAlign: 'center' },

  cellToday: { backgroundColor: c.text.bright },
  cellSelected: { borderWidth: 1, borderColor: c.text.secondary },
  dayNum: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  dayNumToday: { color: c.bg.primary },
}));
