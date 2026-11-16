import { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, Pencil, Trash2, Clock, AlertCircle, Flag } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import StepsEditor from './StepsEditor';
import { useCalendarStore } from '@/store/calendarStore';
import { deadlineLabel } from '@/utils/taskDeadline';
import { taskProgress, progressLine } from '@/utils/taskProgress';
import { tagColor } from '@/utils/taskTags';
import { haptic } from '@/utils/haptics';
import type { Task } from '@/types/calendar';

// Szczegóły zadania (2026-11-16, user: "po kliknięciu w zadanie... kamienie milowe,
// że do ukończenia muszę jeszcze zrobić to i to"). Tap na kafelek w Zadaniach,
// wynik szukania i wiersz widgetu otwierają TO okno (edycja — przycisk "Edytuj").
// Na górze postęp (segment na krok) i co dalej; niżej kroki do odhaczania/dodawania.
export default function TaskDetailSheet({ taskId, onClose, onClosed, onEdit, onDelete, onDone, tagColors }: {
  taskId: string | null;
  onClose: () => void;
  onClosed?: () => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onDone: (t: Task) => void;
  tagColors?: Map<string, string>;
}) {
  const s = makeS();
  const live = useCalendarStore((st) => (taskId ? st.tasks.find((t) => t.id === taskId) ?? null : null));
  const updateTask = useCalendarStore((st) => st.updateTask);
  // Ostatnie zadanie zostaje w oknie na czas animacji zamykania (i onClosed).
  const last = useRef<Task | null>(null);
  if (live) last.current = live;
  const task = live ?? last.current;
  const visible = !!live;
  if (!task) return null;

  const p = taskProgress(task);
  const due = task.deadline ? deadlineLabel(task.deadline) : null;
  const today = !!due && !due.overdue && due.text.startsWith('Dziś');
  const accent = task.tags.length ? tagColor(task.tags[0], tagColors) : colors.text.bright;
  const allDone = p.total > 0 && p.done === p.total;
  const done = task.status === 'done';

  const footer = (
    <View style={s.footer}>
      <TouchableOpacity style={s.iconBtn} onPress={() => { haptic.tap(); onDelete(task); }} accessibilityLabel="Usuń zadanie">
        <Trash2 size={16} color={colors.accent.red} />
      </TouchableOpacity>
      <TouchableOpacity style={s.ghostBtn} onPress={() => { haptic.tap(); onEdit(task); }}>
        <Pencil size={14} color={colors.text.primary} />
        <Text style={s.ghostTxt}>Edytuj</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      {!done && (
        <TouchableOpacity style={[s.doneBtn, allDone && { backgroundColor: accent }]} onPress={() => { haptic.success(); onDone(task); }}>
          <Check size={16} color={colors.bg.primary} />
          <Text style={s.doneTxt}>Ukończ zadanie</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <AppBottomSheet visible={visible} onClose={onClose} onClosed={onClosed} maxHeightRatio={0.9} footer={footer}
      header={<Text style={s.title} numberOfLines={3}>{task.title}</Text>}>
      {(due || task.tags.length > 0) && (
        <View style={s.meta}>
          {due && (
            <View style={[s.pill, due.overdue ? s.pillOver : today ? s.pillToday : null]}>
              {due.overdue ? <AlertCircle size={12} color={colors.accent.red} /> : <Clock size={12} color={today ? colors.accent.orange : colors.text.secondary} />}
              <Text style={[s.pillTxt, due.overdue ? { color: colors.accent.red } : today ? { color: colors.accent.orange } : null]}>{due.text}</Text>
            </View>
          )}
          {task.tags.map((tag) => {
            const c = tagColor(tag, tagColors);
            return (
              <View key={tag} style={[s.pill, { backgroundColor: c + '26', borderColor: c + '55', borderWidth: 1 }]}>
                <Text style={[s.pillTxt, { color: c }]}>{tag}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Postęp: segment na każdy krok + co dalej. */}
      <View style={s.progressCard}>
        <View style={s.progressHead}>
          <Flag size={14} color={accent} />
          <Text style={s.progressLabel}>{p.total ? 'Kamienie milowe' : 'Bez kroków'}</Text>
          {p.total > 0 && <Text style={[s.progressNum, { color: allDone ? accent : colors.text.bright }]}>{p.done}/{p.total}</Text>}
        </View>
        {p.total > 0 && (
          <View style={s.segments}>
            {(task.subtasks ?? []).map((st) => (
              <View key={st.id} style={[s.segment, st.done && { backgroundColor: accent }]} />
            ))}
          </View>
        )}
        <Text style={[s.progressLine, allDone && { color: accent }]}>{done ? 'Zadanie ukończone.' : progressLine(p)}</Text>
      </View>

      <Text style={s.section}>Kroki</Text>
      <StepsEditor steps={task.subtasks ?? []} accent={accent}
        onChange={(subtasks) => updateTask(task.id, { subtasks })} />
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.bright, paddingBottom: spacing[2], lineHeight: 26 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing[3] },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: c.ui.in2 },
  pillOver: { backgroundColor: c.accent.red + '22' },
  pillToday: { backgroundColor: c.accent.orange + '22' },
  pillTxt: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  progressCard: { backgroundColor: c.ui.in, borderRadius: radius.lg, padding: spacing[4], gap: spacing[3] },
  progressHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressLabel: { flex: 1, fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  progressNum: { fontSize: 22, fontFamily: 'Inter_900Black', fontVariant: ['tabular-nums'] },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.ui.dim },
  progressLine: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary, lineHeight: 18 },
  section: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[4], marginBottom: spacing[1] },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  iconBtn: { width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: c.accent.red + '55', alignItems: 'center', justifyContent: 'center' },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  ghostTxt: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  doneBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[4], height: 42, borderRadius: radius.md, backgroundColor: c.text.bright },
  doneTxt: { fontSize: 13.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
}));
