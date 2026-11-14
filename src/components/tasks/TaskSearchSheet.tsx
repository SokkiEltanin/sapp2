import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Search, RotateCcw, Check } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useCalendarStore } from '@/store/calendarStore';
import { filterTasks, EMPTY_TASK_FILTER, taskFilterCount, type TaskFilter, type TaskDueFilter, type TaskStatusFilter } from '@/utils/taskFilter';
import { deadlineLabel } from '@/utils/taskDeadline';
import { todayISO } from '@/utils/date';
import { plural } from '@/utils/plural';
import type { Task } from '@/types/calendar';
import { haptic } from '@/utils/haptics';

// Szukanie i filtry zadań (2026-11-14) — tekst, status (też ZROBIONE, wcześniej
// niewidoczne nigdzie), termin, tag. Stuknięcie = edycja; zrobione można przywrócić.
const STATUS: [TaskStatusFilter, string][] = [['pending', 'Do zrobienia'], ['done', 'Zrobione'], ['all', 'Wszystkie']];
const DUE: [TaskDueFilter, string][] = [['any', 'Każdy termin'], ['overdue', 'Zaległe'], ['today', 'Dziś'], ['week', '7 dni'], ['none', 'Bez terminu']];
const LIMIT = 60;

export default function TaskSearchSheet({ visible, onClose, onEdit, knownTags }: {
  visible: boolean; onClose: () => void; onEdit: (t: Task) => void; knownTags: string[];
}) {
  const s = makeS();
  const tasks = useCalendarStore((st) => st.tasks);
  const [f, setF] = useState<TaskFilter>(EMPTY_TASK_FILTER);
  useEffect(() => { if (visible) setF(EMPTY_TASK_FILTER); }, [visible]);

  const today = todayISO();
  const list = useMemo(() => (visible ? filterTasks(tasks, f, today) : []), [visible, tasks, f, today]);
  const set = (p: Partial<TaskFilter>) => { haptic.tap(); setF((x) => ({ ...x, ...p })); };
  const restore = (t: Task) => { haptic.success(); useCalendarStore.getState().updateTask(t.id, { status: 'pending', updatedAt: new Date().toISOString() }); };

  const chip = (on: boolean, label: string, onPress: () => void, key: string) => (
    <TouchableOpacity key={key} style={[s.chip, on && s.chipOn]} onPress={onPress}>
      <Text style={[s.chipLabel, on && s.chipLabelOn]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.92} header={
      <View>
        <Text style={s.title}>Szukaj zadań</Text>
        <View style={s.searchRow}>
          <Search size={15} color={colors.text.muted} />
          <TextInput value={f.q} onChangeText={(q) => setF((x) => ({ ...x, q }))} style={s.input} placeholder="tytuł, opis albo tag" placeholderTextColor={colors.text.muted} autoCorrect={false} />
        </View>
      </View>
    }>
      <View style={s.chips}>{STATUS.map(([k, l]) => chip(f.status === k, l, () => set({ status: k }), k))}</View>
      <View style={s.chips}>{DUE.map(([k, l]) => chip(f.due === k, l, () => set({ due: k }), k))}</View>
      {knownTags.length > 0 && (
        <View style={s.chips}>{knownTags.slice(0, 12).map((t) => chip(f.tag === t, `#${t}`, () => set({ tag: f.tag === t ? null : t }), t))}</View>
      )}

      <View style={s.summary}>
        <Text style={s.count}>{list.length} {plural(list.length, 'zadanie', 'zadania', 'zadań')}</Text>
        {taskFilterCount(f) > 0 && (
          <TouchableOpacity onPress={() => set(EMPTY_TASK_FILTER)} hitSlop={8}><Text style={s.reset}>wyczyść</Text></TouchableOpacity>
        )}
      </View>

      {list.length === 0 ? <Text style={s.empty}>Nic nie pasuje.</Text> : list.slice(0, LIMIT).map((t) => {
        const done = t.status === 'done';
        const dl = t.deadline ? deadlineLabel(t.deadline) : null;
        return (
          <TouchableOpacity key={t.id} style={s.row} activeOpacity={0.7} onPress={() => { haptic.tap(); onEdit(t); }}>
            {done ? <Check size={15} color={colors.accent.green} /> : <View style={s.ring} />}
            <View style={s.rowMain}>
              <Text style={[s.rowTitle, done && s.rowDone]} numberOfLines={1}>{t.title}</Text>
              <Text style={[s.rowMeta, dl?.overdue && !done && s.overdue]} numberOfLines={1}>
                {[dl ? dl.text : 'bez terminu', ...t.tags.map((x) => `#${x}`)].join(' · ')}
              </Text>
            </View>
            {done && (
              <TouchableOpacity onPress={() => restore(t)} hitSlop={8} style={s.restore} accessibilityLabel="Przywróć do zrobienia">
                <RotateCcw size={14} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      })}
      {list.length > LIMIT && <Text style={s.empty}>…i {list.length - LIMIT} więcej — zawęź filtry.</Text>}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, paddingBottom: spacing[2] },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3], marginBottom: spacing[2] },
  input: { flex: 1, minWidth: 0, paddingVertical: 9, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing[2] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  chipOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  chipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  chipLabelOn: { color: c.bg.primary },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[1], marginBottom: spacing[1] },
  count: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  reset: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.muted, textDecorationLine: 'underline' },
  empty: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.text.muted, paddingVertical: spacing[3], textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.ui.line },
  ring: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, borderColor: c.text.muted },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  rowDone: { color: c.text.muted, textDecorationLine: 'line-through' },
  rowMeta: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 1 },
  overdue: { color: c.accent.red },
  restore: { padding: 4 },
}));
