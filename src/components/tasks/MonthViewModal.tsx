import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { ymd, todayISO } from '@/utils/date';
import { haptic } from '@/utils/haptics';
import { eventCoversDay, type CalendarEvent } from '@/types/calendar';
import AppBottomSheet from '@/components/design/AppBottomSheet';

// Widok miesiąca, DUŻY (user, 2026-11-01: "kalendarz w trybie rozłożonym niech też
// ma takie kafelki jak tygodniowy widok, może być nawet na cały ekran") — wcześniej
// widok miesiąca w `WeekMonthCalendar.tsx` był ciasną siatką z samą kropeczką "ma
// wydarzenie" (za mało miejsca w komórce 6-wierszowej siatki na cokolwiek więcej).
// Dużo miejsca daje miejsce na te same kolorowe chipy wydarzeń co widok tygodnia
// (`MAX_CHIPS_PER_DAY`, reszta jako "+N"), tylko mniej na komórkę (siatka 6×7
// zamiast 1×7).
//
// Przebudowany na `AppBottomSheet` (2026-11-02, kontynuacja migracji z Faza 3.6) —
// "może być nawet na cały ekran" z usera NIE oznaczało literalnie edge-to-edge,
// tylko "więcej miejsca niż ciasny mały kafel"; sheet przy `maxDynamicContentSize`
// 78% wysokości ekranu wciąż daje DUŻO miejsca na siatkę 6×7, ze scrollem WEWNĄTRZ
// gdy któryś miesiąc (6 tygodni) się nie zmieści. Nagłówek (tytuł+nawigacja) i
// etykiety dni tygodnia (Pon/Wt/...) jako `header` — NIEruchome, jak nagłówek
// tabeli; same tygodnie (siatka) jako scrollowalna treść.
const DAY_LABELS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];
const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];
const MAX_CHIPS_PER_CELL = 2;

// ZAWSZE 6 tygodni (42 komórki), nie "ile akurat trzeba" (2026-11-09, user:
// "kalendarz niech ma stałą wysokość najlepiej tę większą, bo tak między
// miesiącami skacze bez sensu") — miesiąc potrzebuje 4-6 wierszy w zależności
// od tego na jaki dzień tygodnia wypada 1. dzień (Grudzień 2026: 5, Listopad
// 2026: 6) i `AppBottomSheet`'s sheet ma DYNAMICZNĄ wysokość (rośnie/kurczy
// się do treści) — więc mniej wierszy = fizycznie niższy sheet, widoczny
// "skok" wysokości przy strzałce miesiąc-w-przód/wstecz. 6 wierszy (42
// komórki) to MAKSIMUM jakiego jakikolwiek miesiąc może potrzebować (6
// wiodących pustych + do 31 dni mieści się zawsze w 42), więc dopełnienie
// zawsze DO 42 (nie do najbliższej wielokrotności 7) daje stałą, zawsze-
// największą wysokość siatki niezależnie od miesiąca.
function getMonthGrid(monthCursor: Date): (Date | null)[][] {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length < 42) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function MonthViewModal({
  visible, events, selectedDate, onSelectDate, onOpenDay, onClose,
}: {
  visible: boolean;
  events: CalendarEvent[];
  selectedDate: string;
  onSelectDate: (dateYMD: string) => void;
  onOpenDay: (dateYMD: string) => void;
  onClose: () => void;
}) {
  const s = makeS();
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const today = todayISO();

  const monthWeeks = useMemo(() => getMonthGrid(monthCursor), [monthCursor]);
  const isCurrentMonth = monthCursor.getFullYear() === new Date().getFullYear()
    && monthCursor.getMonth() === new Date().getMonth();

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const week of monthWeeks) {
      for (const d of week) {
        if (!d) continue;
        const key = ymd(d);
        map.set(key, events
          .filter((e) => eventCoversDay(e, key))
          .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')));
      }
    }
    return map;
  }, [monthWeeks, events]);

  const shiftMonth = (delta: number) => { haptic.tap(); setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1)); };
  const jumpToToday = () => { haptic.tap(); setMonthCursor(new Date()); onSelectDate(today); };
  // NIE zamyka modala miesiąca (2026-11-01, user: "po kliknięciu w dzień... wywala
  // mi z powrotem do tyg[odnia]" — zamykanie tego popupu przy wyborze dnia
  // oznaczało że po zamknięciu `DayDetailModal` user widział z powrotem WIDOK
  // TYGODNIA pod spodem, bo to jedyny co zostawał zamontowany. Oba modale (ten i
  // `DayDetailModal`) są niezależnymi `Modal`-ami — mogą być widoczne naraz, jeden
  // na drugim — więc zostawiamy ten otwarty, user wraca do miesiąca po zamknięciu
  // szczegółów dnia, tak jak w tygodniu.
  const selectDay = (dateYMD: string) => { haptic.tap(); onSelectDate(dateYMD); onOpenDay(dateYMD); };

  const header = (
    <>
      <View style={s.header}>
        <Text style={s.title}>{MONTH_NAMES[monthCursor.getMonth()]} {monthCursor.getFullYear()}</Text>
        <View style={s.headerActions}>
          {!isCurrentMonth && (
            <TouchableOpacity onPress={jumpToToday} hitSlop={8} style={s.todayBtn}>
              <Text style={s.todayBtnLabel}>Dziś</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={8}>
            <ChevronLeft size={20} color={colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={8}>
            <ChevronRight size={20} color={colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { haptic.tap(); onClose(); }} hitSlop={8} style={s.closeBtn}>
            <X size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={s.weekLabelRow}>
        {DAY_LABELS.map((l) => <Text key={l} style={s.weekLabel}>{l}</Text>)}
      </View>
    </>
  );

  return (
    <AppBottomSheet visible={visible} onClose={onClose} header={header}>
      {monthWeeks.map((week, i) => (
        <View key={i} style={s.weekRow}>
          {week.map((d, j) => {
            if (!d) return <View key={j} style={s.cellSlot} />;
            const dateYMD = ymd(d);
            const isToday = dateYMD === today;
            const isSelected = !isToday && dateYMD === selectedDate;
            const dayEvents = eventsByDay.get(dateYMD) ?? [];
            const overflow = dayEvents.length - MAX_CHIPS_PER_CELL;
            return (
              <TouchableOpacity key={j} style={s.cellSlot} onPress={() => selectDay(dateYMD)} activeOpacity={0.7}>
                <View style={[s.cell, isToday && s.cellToday, isSelected && s.cellSelected]}>
                  <View style={[s.dayNumWrap, isToday && s.dayNumToday]}>
                    <Text style={[s.dayNum, isToday && s.dayNumTextToday]}>{d.getDate()}</Text>
                  </View>
                  <View style={s.chips}>
                    {dayEvents.slice(0, MAX_CHIPS_PER_CELL).map((ev) => (
                      <View key={ev.id} style={[s.chip, { backgroundColor: ev.color ?? colors.accent.blue }]}>
                        <Text style={s.chipLabel} numberOfLines={1}>{ev.title}</Text>
                      </View>
                    ))}
                    {overflow > 0 && <Text style={s.moreLabel}>+{overflow}</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: spacing[2],
  },
  title: { fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.primary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  todayBtn: { paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.sm, backgroundColor: c.bg.card },
  todayBtnLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  closeBtn: {
    width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },

  // Bez własnego `paddingHorizontal` (2026-11-02) — wyrównanie z siatką tygodni
  // niżej idzie teraz przez WSPÓLNY `paddingHorizontal` z `AppBottomSheet`'s
  // `header`/`body` wrapperów (oba spacing[4]), nie przez osobno przeliczany offset.
  weekLabelRow: { flexDirection: 'row' },
  // `text.secondary` zamiast `text.muted` (2026-11-01, user: "popraw kolory pod
  // nasz motyw bo sa chyba zbyt szarawiaste") — odrobinę więcej kontrastu na tle
  // czystej czerni, ten sam zabieg co `cellToday`/akcentowe chipy niżej.
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.secondary, textTransform: 'uppercase' },

  weekRow: { flexDirection: 'row' },
  cellSlot: { flex: 1, minHeight: 86, padding: 2 },
  cell: { flex: 1, borderRadius: radius.md, padding: 4, gap: 3 },
  // Subtelna, jaśniejsza obwódka dla "dziś" (zamiast tylko białego kółka na numerze
  // dnia, łatwo zgubionego przy przewijaniu) — user: "popraw kolory... zbyt
  // szarawiaste".
  cellToday: { borderWidth: 1, borderColor: c.text.bright + '55' },
  cellSelected: { backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default },
  dayNumWrap: { width: 20, height: 20, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  dayNumToday: { backgroundColor: c.text.bright },
  dayNum: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  dayNumTextToday: { color: c.bg.primary },
  chips: { gap: 2 },
  chip: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2, minHeight: 15, justifyContent: 'center' },
  chipLabel: { fontSize: 7.5, fontFamily: 'Inter_700Bold', color: '#FFFFFF', lineHeight: 9 },
  moreLabel: { fontSize: 8, fontFamily: 'Inter_700Bold', color: c.text.muted },
}));
