import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Circle, CheckCircle2, Trash2 } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { haptic } from '@/utils/haptics';
import { deadlineLabel } from '@/utils/taskDeadline';
import type { Task } from '@/types/calendar';

// Wiersz zadania — kosz z LEWEJ (tap = ZAPYTAJ o potwierdzenie, patrz
// `onRequestDelete`/tasks.tsx's confirm sheet — 2026-11-08, user: "dodac...
// potwierdzenie usunięcia taskow"; PRZED tą zmianą usuwało od razu, bez
// potwierdzenia, co dla przypadkowego stuknięcia jest nieodwracalne), tytuł +
// opcjonalne tagi (neutralne szare chipy — brak koloru w modelu `Task.tags`,
// kolorowe tagi z Dashboardu to mock-dane z osobnym polem `color`, nie port
// tego samego typu) — TAP na całą treść otwiera edycję (`onEdit`, też
// 2026-11-08, user: "dodac edycje... taskow" — wcześniej jedyną akcją na
// istniejącym zadaniu było usuń/odznacz, zero sposobu poprawić literówkę czy
// zmienić termin), checkbox z PRAWEJ (tap = oznacz ukończone, znika z listy,
// patrz app/(tabs)/tasks.tsx: sekcje filtrują `status === 'pending'`).
// Kolejność kosz/checkbox odwrócona 2026-10-30 na wyraźną prośbę usera:
// "odznaczenie po prawej a usuń po lewej" (wcześniej było odwrotnie).
export default function TaskRow({
  task,
  isLast,
  onToggleDone,
  onRequestDelete,
  onEdit,
}: {
  task: Task;
  isLast?: boolean;
  onToggleDone: (id: string) => void;
  onRequestDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
}) {
  const s = makeS();
  // Termin widoczny na wierszu (2026-11-11) — lista była sortowana po terminie,
  // ale sam termin nigdzie się nie pokazywał; zaległy na czerwono.
  const due = task.deadline ? deadlineLabel(task.deadline) : null;
  return (
    <View style={[s.row, !isLast && s.rowDivider]}>
      <TouchableOpacity onPress={() => { haptic.tap(); onRequestDelete(task); }} hitSlop={8}>
        <Trash2 size={16} color={colors.text.muted} />
      </TouchableOpacity>
      <TouchableOpacity style={s.content} onPress={() => { haptic.tap(); onEdit(task); }} activeOpacity={0.7}>
        <Text style={s.title} numberOfLines={2}>{task.title}</Text>
        {(due || task.tags.length > 0) && (
          <View style={s.tags}>
            {due && <Text style={[s.dueLabel, due.overdue && s.dueOverdue]}>{due.text}</Text>}
            {task.tags.map((tag) => (
              <View key={tag} style={s.tagChip}>
                <Text style={s.tagLabel}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { haptic.success(); onToggleDone(task.id); }} hitSlop={8}>
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
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  dueLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  dueOverdue: { color: c.accent.red },
  tagChip: { backgroundColor: c.chart.muted, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  tagLabel: { fontSize: 9.5, fontFamily: 'Inter_900Black', color: '#FFFFFF' },
}));
