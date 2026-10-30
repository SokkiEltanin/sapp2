import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import type { CalendarEvent } from '@/types/calendar';

// Kafelek wydarzenia — port wyglądu z `sapp` (src/app/(tabs)/calendar.tsx `eventRow`/
// `m.eventRow`, 1:1 layout), na wyraźną prośbę usera (2026-10-30: "pamiętasz jak był
// zrobiony kalendarz w sap... jak wyglądały kafelki eventów? To tak chce tutaj").
// Kolorowy pasek z lewej = `event.color` (z Google Calendar albo lokalnego eventu) —
// ŚWIADOMIE zostaje kolorowy mimo monochromatycznego redesignu Dashboardu: to
// funkcjonalny akcent per-wydarzenie (jak tag zadania), nie kategoria ekranu.
export default function EventCard({ event }: { event: CalendarEvent }) {
  const s = makeS();
  const hasTime = !!(event.startTime || event.endTime);
  return (
    <View style={s.row}>
      <View style={[s.colorBar, { backgroundColor: event.color ?? colors.text.secondary }]} />
      <View style={s.time}>
        {hasTime ? (
          <>
            <Text style={s.timeText} numberOfLines={1}>{event.startTime ?? ''}</Text>
            {event.endTime && <Text style={s.timeSub} numberOfLines={1}>{event.endTime}</Text>}
          </>
        ) : (
          <Text style={s.timeAllDay}>cały dzień</Text>
        )}
      </View>
      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>{event.title}</Text>
        {event.description ? <Text style={s.desc} numberOfLines={1}>{event.description}</Text> : null}
      </View>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.bg.card, borderRadius: radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: c.border.default, minHeight: 52, marginBottom: spacing[2],
  },
  colorBar: { width: 3, alignSelf: 'stretch' },
  time: { width: 56, alignItems: 'center', paddingVertical: spacing[3] },
  timeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  timeSub: { fontSize: 9.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 1 },
  timeAllDay: { fontSize: 9.5, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center' },
  body: { flex: 1, paddingVertical: spacing[3], paddingRight: spacing[3] },
  title: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  desc: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
}));
