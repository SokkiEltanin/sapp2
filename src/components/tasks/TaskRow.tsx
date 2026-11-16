import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Trash2, Check, Clock, AlertCircle } from 'lucide-react-native';
import { tagColor } from '@/utils/taskTags';
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
// 2026-11-16 (user: "tag #UR dziwnie wygląda... wizualne kafelki, bardziej
// wyróżniające się"): każde zadanie to osobny kafelek — pasek z lewej w kolorze
// tagu (kolor z kalendarza, utils/taskTags.ts), tytuł, pod nim termin z ikoną
// (zaległy czerwony, dziś pomarańczowy) i tagi jako kolorowe pigułki; zaległe
// zadanie dostaje czerwoną obwódkę. Kosz z lewej, odhaczenie z prawej — bez zmian.
export default function TaskRow({
  task,
  onToggleDone,
  onRequestDelete,
  onEdit,
  tagColors,
}: {
  task: Task;
  isLast?: boolean;
  onToggleDone: (id: string) => void;
  onRequestDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  tagColors?: Map<string, string>;
}) {
  const s = makeS();
  const due = task.deadline ? deadlineLabel(task.deadline) : null;
  const today = !!due && !due.overdue && due.text.startsWith('Dziś');
  const accent = task.tags.length ? tagColor(task.tags[0], tagColors) : due?.overdue ? colors.accent.red : colors.border.default;
  const done = task.status === 'done';
  return (
    <View style={[s.card, due?.overdue && s.cardOverdue, done && { opacity: 0.5 }]}>
      <View style={[s.bar, { backgroundColor: accent }]} />
      <TouchableOpacity onPress={() => { haptic.tap(); onRequestDelete(task); }} hitSlop={8} accessibilityLabel="Usuń zadanie">
        <Trash2 size={15} color={colors.text.muted} />
      </TouchableOpacity>
      <TouchableOpacity style={s.content} onPress={() => { haptic.tap(); onEdit(task); }} activeOpacity={0.7}>
        <Text style={[s.title, done && s.titleDone]} numberOfLines={1}>{task.title}</Text>
        {(due || task.tags.length > 0) && (
          <View style={s.meta}>
            {due && (
              <View style={[s.due, due.overdue ? s.dueOver : today ? s.dueToday : null]}>
                {due.overdue ? <AlertCircle size={10} color={colors.accent.red} /> : <Clock size={10} color={today ? colors.accent.orange : colors.text.secondary} />}
                <Text style={[s.dueTxt, due.overdue ? { color: colors.accent.red } : today ? { color: colors.accent.orange } : null]} numberOfLines={1}>{due.text}</Text>
              </View>
            )}
            {task.tags.map((tag) => {
              const c = tagColor(tag, tagColors);
              return (
                <View key={tag} style={[s.tag, { backgroundColor: c + '26', borderColor: c + '55' }]}>
                  <Text style={[s.tagTxt, { color: c }]} numberOfLines={1}>{tag.replace(/^#/, '')}</Text>
                </View>
              );
            })}
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { haptic.success(); onToggleDone(task.id); }} hitSlop={8} style={[s.check, done && s.checkOn]} accessibilityLabel={done ? 'Przywróć zadanie' : 'Oznacz jako zrobione'}>
        {done ? <Check size={16} color={colors.bg.primary} /> : null}
      </TouchableOpacity>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  card: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: c.ui.in2, borderRadius: radius.lg, paddingLeft: spacing[4], paddingRight: spacing[3],
    borderWidth: 1, borderColor: 'transparent', overflow: 'hidden',
  },
  cardOverdue: { borderColor: c.accent.red + '66' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  content: { flex: 1, gap: 5, justifyContent: 'center' },
  title: { fontSize: 14.5, fontFamily: 'Inter_800ExtraBold', color: c.text.bright },
  titleDone: { textDecorationLine: 'line-through', color: c.text.muted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
  due: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full, backgroundColor: c.bg.primary },
  dueOver: { backgroundColor: c.accent.red + '22' },
  dueToday: { backgroundColor: c.accent.orange + '22' },
  dueTxt: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  tag: { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: radius.full, borderWidth: 1 },
  tagTxt: { fontSize: 10.5, fontFamily: 'Inter_900Black', letterSpacing: 0.3 },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: c.text.muted, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
}));
