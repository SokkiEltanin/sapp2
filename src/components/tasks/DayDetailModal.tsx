import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { openEventEditor, openNewEvent } from '@/services/eventEditor';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import type { CalendarEvent } from '@/types/calendar';
import { haptic } from '@/utils/haptics';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import EventCard from './EventCard';

// Szczegóły dnia — na żądanie (2026-10-30, user podesłał Samsung Calendar jako
// referencję: "dopiero po kliknięciu w dzień niech się otwiera jak tam"). Wcześniej
// kafelki wydarzeń wybranego dnia siedziały NA STAŁE pod kalendarzem w tasks.tsx —
// user to odrzucił ("za dużo miejsca... zadania pod spodem tylko bo one są ważne").
// Otwierany tylko tapnięciem dnia w WeekMonthCalendar. Kafelki = ten sam
// `EventCard` co poprzednio (sama lokalizacja się zmieniła, nie wygląd).
//
// Przebudowany na `AppBottomSheet` (2026-11-02, kontynuacja migracji popupów z
// Faza 3.6/MoodModal — user: "dawaj" po "miało być 1do1... wszystko ten sam styl").
// Prosty przypadek: `header` = tytuł dnia + X, `children` = scrollowalna lista
// `EventCard`ów, bez `footer` (nic tu nie da się "zapisać").
const DAY_FULL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const MONTH_SHORT = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

export default function DayDetailModal({
  visible,
  dateYMD,
  events,
  onClose,
}: {
  visible: boolean;
  dateYMD: string;
  events: CalendarEvent[];
  onClose: () => void;
}) {
  const s = makeS();
  const d = new Date(`${dateYMD}T00:00:00`);

  const header = (
    <View style={s.header}>
      <Text style={s.headerTitle}>{DAY_FULL[d.getDay()]}, {d.getDate()} {MONTH_SHORT[d.getMonth()]}</Text>
      <TouchableOpacity onPress={() => { haptic.tap(); onClose(); }} hitSlop={8}>
        <X size={18} color={colors.text.muted} />
      </TouchableOpacity>
    </View>
  );

  return (
    <AppBottomSheet visible={visible} onClose={onClose} header={header}>
      {events.length === 0 ? (
        <Text style={s.empty}>Brak wydarzeń tego dnia.</Text>
      ) : (
        // Stuknięcie = formularz wydarzenia (edycja, też Google — 2026-11-15).
        events.map((ev) => <EventCard key={ev.id} event={ev} onPress={() => { haptic.tap(); onClose(); setTimeout(() => openEventEditor(ev), 250); }} />)
      )}
      <TouchableOpacity style={s.addBtn} onPress={() => { haptic.tap(); onClose(); setTimeout(() => openNewEvent(dateYMD), 250); }} activeOpacity={0.8}>
        <Plus size={15} color={colors.text.primary} />
        <Text style={s.addLabel}>Dodaj wydarzenie</Text>
      </TouchableOpacity>
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: spacing[3], borderBottomWidth: 1, borderBottomColor: c.border.default,
  },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.primary },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, borderStyle: 'dashed', marginTop: spacing[1] },
  addLabel: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  empty: { fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', paddingVertical: spacing[4] },
}));
