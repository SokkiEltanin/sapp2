import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useCalendarStore } from '@/store/calendarStore';
import { useDayPlanStore } from '@/store/dayPlanStore';
import { knownEventTags } from '@/utils/dayPlan';
import { haptic } from '@/utils/haptics';

// Wybór tagów do "Planu dnia" (2026-11-13) — tagi z kalendarza (±60 dni) z
// liczbą wydarzeń; zadania zaplanowane na dzień są w planie zawsze.
export default function DayPlanTagsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const events = useCalendarStore((st) => st.events);
  const gcal = useCalendarStore((st) => st.gcalEvents);
  const tags = useDayPlanStore((st) => st.tags);
  const setTags = useDayPlanStore((st) => st.setTags);
  const known = useMemo(() => knownEventTags([...events, ...gcal]), [events, gcal]);
  const sel = new Set((tags ?? []).map((t) => t.toLowerCase()));

  const toggle = (tag: string) => {
    haptic.tap();
    const cur = (tags ?? []).filter((t) => t.toLowerCase() !== tag.toLowerCase());
    setTags(sel.has(tag.toLowerCase()) ? cur : [...cur, tag]);
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose}>
      <Text style={s.title}>Plan dnia — co pokazywać</Text>
      <Text style={s.hint}>Tagi z tytułów wydarzeń, np. [UR], [JD]. Zadania zaplanowane na dany dzień są zawsze.</Text>
      <TouchableOpacity style={[s.row, tags === null && s.rowOn]} onPress={() => { haptic.tap(); setTags(null); }} activeOpacity={0.8}>
        <Text style={[s.rowLabel, tags === null && s.rowLabelOn]}>Wszystkie wydarzenia</Text>
        {tags === null && <Check size={15} color={colors.bg.primary} />}
      </TouchableOpacity>
      {known.length === 0 && <Text style={s.hint}>W kalendarzu nie ma jeszcze wydarzeń z tagiem w nawiasach.</Text>}
      {known.map((k) => {
        const on = sel.has(k.tag.toLowerCase());
        return (
          <TouchableOpacity key={k.tag} style={[s.row, on && s.rowOn]} onPress={() => toggle(k.tag)} activeOpacity={0.8}>
            <Text style={[s.rowLabel, on && s.rowLabelOn]}>[{k.tag}]</Text>
            <Text style={[s.count, on && s.rowLabelOn]}>{k.count} wydarzeń</Text>
            {on && <Check size={15} color={colors.bg.primary} />}
          </TouchableOpacity>
        );
      })}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  hint: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 4, marginBottom: spacing[2], lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[3], paddingVertical: spacing[3], borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated, marginTop: spacing[2] },
  rowOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  rowLabel: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  rowLabelOn: { color: c.bg.primary },
  count: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
}));
