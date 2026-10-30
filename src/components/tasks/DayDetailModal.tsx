import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import type { CalendarEvent } from '@/types/calendar';
import EventCard from './EventCard';

// Szczegóły dnia — na żądanie (2026-10-30, user podesłał Samsung Calendar jako
// referencję: "dopiero po kliknięciu w dzień niech się otwiera jak tam"). Wcześniej
// kafelki wydarzeń wybranego dnia siedziały NA STAŁE pod kalendarzem w tasks.tsx —
// user to odrzucił ("za dużo miejsca... zadania pod spodem tylko bo one są ważne").
// Teraz: modal, otwierany tylko tapnięciem dnia w WeekMonthCalendar, zamykany tapem
// w tło albo X. Kafelki = ten sam `EventCard` co poprzednio (sama lokalizacja się
// zmieniła, nie wygląd).
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <View style={s.header}>
            <Text style={s.headerTitle}>{DAY_FULL[d.getDay()]}, {d.getDate()} {MONTH_SHORT[d.getMonth()]}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={18} color={colors.text.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
            {events.length === 0 ? (
              <Text style={s.empty}>Brak wydarzeń tego dnia.</Text>
            ) : (
              events.map((ev) => <EventCard key={ev.id} event={ev} />)
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing[4] },
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[4], maxHeight: '70%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.primary },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: 0 },
  empty: { fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', paddingVertical: spacing[4] },
}));
