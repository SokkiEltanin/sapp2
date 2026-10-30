import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Circle, CheckCircle2, Trash2 } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import type { Task } from '@/types/calendar';

// Wiersz zadania — kosz z LEWEJ (tap = usuń od razu, bez potwierdzenia — świadomie
// proste, zgodnie z CLAUDE.md "nie dodawaj walidacji/fallbacków dla scenariuszy
// które nie muszą tu być"), tytuł + opcjonalne tagi (neutralne szare chipy — brak
// koloru w modelu `Task.tags`, kolorowe tagi z Dashboardu to mock-dane z osobnym
// polem `color`, nie port tego samego typu), checkbox z PRAWEJ (tap = oznacz
// ukończone, znika z listy, patrz app/(tabs)/tasks.tsx: sekcje filtrują
// `status === 'pending'`). Kolejność odwrócona 2026-10-30 na wyraźną prośbę usera:
// "odznaczenie po prawej a usuń po lewej" (wcześniej było odwrotnie).
export default function TaskRow({
  task,
  isLast,
  onToggleDone,
  onDelete,
}: {
  task: Task;
  isLast?: boolean;
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const s = makeS();
  return (
    <View style={[s.row, !isLast && s.rowDivider]}>
      <TouchableOpacity onPress={() => onDelete(task.id)} hitSlop={8}>
        <Trash2 size={16} color={colors.text.muted} />
      </TouchableOpacity>
      <View style={s.content}>
        <Text style={s.title} numberOfLines={2}>{task.title}</Text>
        {task.tags.length > 0 && (
          <View style={s.tags}>
            {task.tags.map((tag) => (
              <View key={tag} style={s.tagChip}>
                <Text style={s.tagLabel}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <TouchableOpacity onPress={() => onToggleDone(task.id)} hitSlop={8}>
        {task.status === 'done'
          ? <CheckCircle2 size={20} color={colors.text.bright} />
          : <Circle size={20} color={colors.text.muted} />}
      </TouchableOpacity>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: c.border.subtle },
  content: { flex: 1, gap: 4 },
  title: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tagChip: { backgroundColor: c.chart.muted, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  tagLabel: { fontSize: 9.5, fontFamily: 'Inter_900Black', color: '#FFFFFF' },
}));
