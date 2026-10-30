import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { ymd, todayISO } from '@/utils/date';
import { eventCoversDay, type CalendarEvent } from '@/types/calendar';

// Kalendarz Zadań — dwa tryby: TYDZIEŃ (domyślny, zawsze bieżący tydzień Pon-Nd) i
// MIESIĄC (pełna siatka, nawigacja strzałkami). Przełącznik = cały nagłówek karty.
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
// Widok miesiąca ZOSTAJE kompaktowy (kropka, nie chipy) — za mało miejsca w komórce
// 6-wierszowej siatki na cokolwiek więcej; tap też woła `onOpenDay`, dla spójności
// interakcji między oboma trybami.
const DAY_LABELS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];
const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];
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

function getMonthGrid(monthCursor: Date): (Date | null)[][] {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Pon=0..Nd=6
  const cells: (Date | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
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
  const [expanded, setExpanded] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const today = todayISO();

  const hasEvent = (d: Date) => events.some((e) => eventCoversDay(e, ymd(d)));

  const weekDays = useMemo(() => getWeekDays(new Date()), []);
  const monthWeeks = useMemo(() => getMonthGrid(monthCursor), [monthCursor]);
  const isCurrentMonth = monthCursor.getFullYear() === new Date().getFullYear()
    && monthCursor.getMonth() === new Date().getMonth();

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

  const shiftMonth = (delta: number) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const jumpToToday = () => {
    setMonthCursor(new Date());
    onSelectDate(today);
  };

  const selectDay = (dateYMD: string) => {
    onSelectDate(dateYMD);
    onOpenDay(dateYMD);
  };

  return (
    <View style={s.card}>
      <TouchableOpacity style={s.header} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
        <Text style={s.headerLabel}>
          {expanded ? `${MONTH_NAMES[monthCursor.getMonth()]} ${monthCursor.getFullYear()}` : 'Ten tydzień'}
        </Text>
        {expanded && (
          <View style={s.monthNav}>
            {!isCurrentMonth && (
              <TouchableOpacity onPress={jumpToToday} hitSlop={8} style={s.todayBtn}>
                <Text style={s.todayBtnLabel}>Dziś</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={8}>
              <ChevronLeft size={18} color={colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={8}>
              <ChevronRight size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        )}
        {expanded ? <ChevronUp size={16} color={colors.text.muted} /> : <ChevronDown size={16} color={colors.text.muted} />}
      </TouchableOpacity>

      {expanded ? (
        <View style={s.month}>
          <View style={s.weekRow}>
            {DAY_LABELS.map((l) => <Text key={l} style={s.weekLabel}>{l}</Text>)}
          </View>
          {monthWeeks.map((week, i) => (
            <View key={i} style={s.weekRow}>
              {week.map((d, j) => {
                if (!d) return <View key={j} style={s.monthCellSlot} />;
                const dateYMD = ymd(d);
                const isToday = dateYMD === today;
                const isSelected = !isToday && dateYMD === selectedDate;
                return (
                  <View key={j} style={s.monthCellSlot}>
                    <TouchableOpacity
                      style={[s.monthCell, isToday && s.cellToday, isSelected && s.cellSelected]}
                      onPress={() => selectDay(dateYMD)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.dayNum, isToday && s.dayNumToday]}>{d.getDate()}</Text>
                      {hasEvent(d) && <View style={[s.dot, isToday && s.dotToday]} />}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      ) : (
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
      )}
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
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  todayBtn: { paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.sm, backgroundColor: c.bg.elevated },
  todayBtnLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },

  weekRow: { flexDirection: 'row' },
  month: { gap: 2 },

  // Widok tygodnia — kolumna na dzień: etykieta, numer (badge), stos chipów wydarzeń.
  weekGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 3 },
  dayCol: { flex: 1, alignItems: 'center', gap: 3 },
  dayLabel: { fontSize: 9.5, fontFamily: 'Inter_500Medium', color: c.text.muted, textTransform: 'uppercase' },
  dayNumWrap: { width: 24, height: 24, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  weekDayNum: { fontSize: 11.5 },
  chips: { width: '100%', gap: 2 },
  chip: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 3, minHeight: 26, justifyContent: 'center' },
  chipLabel: { fontSize: 8.5, fontFamily: 'Inter_700Bold', color: '#FFFFFF', lineHeight: 10 },
  moreLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', color: c.text.muted, textAlign: 'center' },

  // Widok miesiąca — gęsta siatka, komórka wypełnia kolumnę.
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontFamily: 'Inter_500Medium', color: c.text.muted, textTransform: 'uppercase' },
  monthCellSlot: { flex: 1, aspectRatio: 1, padding: 1 },
  monthCell: { flex: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2 },

  cellToday: { backgroundColor: c.text.bright },
  cellSelected: { borderWidth: 1, borderColor: c.text.secondary },
  dayNum: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  dayNumToday: { color: c.bg.primary },
  dot: { width: 3, height: 3, borderRadius: 999, backgroundColor: c.text.secondary },
  dotToday: { backgroundColor: c.bg.primary },
}));
