import { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, Plus, X, ChevronUp, ChevronDown } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { haptic } from '@/utils/haptics';
import { newStep } from '@/utils/taskProgress';
import type { Subtask } from '@/types/calendar';

// Kroki / kamienie milowe zadania (2026-11-16) — ten sam edytor w formularzu
// nowego zadania (AddTaskCard) i w szczegółach (TaskDetailSheet). Kółko = zrobione,
// × = usuń, pole na dole dodaje krok (Enter dodaje i zostawia klawiaturę).
// 2026-11-22, user: "edytować kamienie milowe albo zmieniać ich kolejność": stuknięcie w
// treść kroku = edycja tekstu + strzałki wyżej/niżej; ✓ albo Enter kończy (tekst zapisuje się
// też przy wyjściu z pola).
export default function StepsEditor({ steps, onChange, accent, placeholder = 'Dodaj krok, np. „Napisać wstęp”', editable = true }: {
  steps: Subtask[]; onChange: (steps: Subtask[]) => void; accent?: string; placeholder?: string; editable?: boolean;
}) {
  const s = makeS();
  const [text, setText] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const withDraft = (list: Subtask[]) => {
    const t = draft.trim();
    return editId && t ? list.map((x) => (x.id === editId && x.title !== t ? { ...x, title: t } : x)) : list;
  };
  const commit = () => { const next = withDraft(steps); if (next !== steps && next.some((x, i) => x !== steps[i])) onChange(next); };
  const startEdit = (st: Subtask) => {
    if (!editable) return;
    haptic.tap();
    if (editId && editId !== st.id) commit();
    setEditId(st.id); setDraft(st.title);
  };
  const finish = () => { commit(); setEditId(null); };
  const move = (id: string, dir: -1 | 1) => {
    const list = withDraft(steps);
    const i = list.findIndex((x) => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    haptic.tap();
    const next = list.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const input = useRef<TextInput>(null);
  const tint = accent ?? colors.text.bright;

  const add = () => {
    const t = text.trim();
    if (!t) return;
    haptic.tap();
    onChange([...steps, newStep(t)]);
    setText('');
    setTimeout(() => input.current?.focus(), 0);
  };
  const toggle = (id: string) => {
    const next = steps.map((x) => (x.id === id ? { ...x, done: !x.done } : x));
    const nowAll = next.length > 0 && next.every((x) => x.done);
    if (nowAll) haptic.success(); else haptic.medium();
    onChange(next);
  };
  const remove = (id: string) => { haptic.tap(); onChange(steps.filter((x) => x.id !== id)); };
  const firstOpen = steps.find((x) => !x.done)?.id;

  return (
    <View style={s.wrap}>
      {steps.map((st, i) => (
        <View key={st.id} style={s.row}>
          {/* Linia łącząca kroki — oś "drogi do celu". */}
          {i < steps.length - 1 && <View style={[s.line, st.done && { backgroundColor: tint }]} />}
          <TouchableOpacity onPress={() => toggle(st.id)} hitSlop={6} style={[s.dot, st.done && { backgroundColor: tint, borderColor: tint }, st.id === firstOpen && { borderColor: tint }]}
            accessibilityLabel={st.done ? `Odznacz: ${st.title}` : `Zrobione: ${st.title}`}>
            {st.done ? <Check size={13} color={colors.bg.primary} /> : <Text style={[s.num, st.id === firstOpen && { color: tint }]}>{i + 1}</Text>}
          </TouchableOpacity>
          {editId === st.id ? (
            <>
              <TextInput value={draft} onChangeText={setDraft} autoFocus style={s.editInput} onBlur={commit}
                onSubmitEditing={finish} returnKeyType="done" submitBehavior="blurAndSubmit" multiline={false} />
              <TouchableOpacity onPress={() => move(st.id, -1)} disabled={i === 0} hitSlop={6} style={[s.miniBtn, i === 0 && s.miniOff]} accessibilityLabel="Krok wyżej">
                <ChevronUp size={16} color={colors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => move(st.id, 1)} disabled={i === steps.length - 1} hitSlop={6} style={[s.miniBtn, i === steps.length - 1 && s.miniOff]} accessibilityLabel="Krok niżej">
                <ChevronDown size={16} color={colors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={finish} hitSlop={6} style={[s.miniBtn, s.miniOk]} accessibilityLabel="Zapisz krok">
                <Check size={15} color={colors.bg.primary} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text onPress={editable ? () => startEdit(st) : undefined} suppressHighlighting
                style={[s.title, st.done && s.titleDone, st.id === firstOpen && s.titleNext]} numberOfLines={2}>{st.title}</Text>
              <TouchableOpacity onPress={() => remove(st.id)} hitSlop={8} accessibilityLabel={`Usuń krok ${st.title}`}>
                <X size={14} color={colors.text.muted} />
              </TouchableOpacity>
            </>
          )}
        </View>
      ))}
      <View style={s.addRow}>
        <TextInput ref={input} value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor={colors.text.muted}
          style={s.input} returnKeyType="done" onSubmitEditing={add} submitBehavior="submit" />
        <TouchableOpacity onPress={add} disabled={!text.trim()} style={[s.addBtn, !text.trim() && { opacity: 0.35 }]} accessibilityLabel="Dodaj krok">
          <Plus size={16} color={colors.bg.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  wrap: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 7, position: 'relative' },
  line: { position: 'absolute', left: 12, top: 33, height: 16, width: 2, backgroundColor: c.border.default, borderRadius: 1 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 11, fontFamily: 'Inter_900Black', color: c.text.muted },
  title: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  titleDone: { color: c.text.muted, textDecorationLine: 'line-through' },
  titleNext: { color: c.text.bright, fontFamily: 'Inter_800ExtraBold' },
  editInput: { flex: 1, minWidth: 0, marginRight: -4, borderWidth: 1, borderColor: c.text.secondary, borderRadius: radius.md, paddingHorizontal: spacing[2], paddingVertical: 6, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.bright },
  miniBtn: { width: 28, height: 30, marginLeft: -4, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  miniOff: { opacity: 0.3 },
  miniOk: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  input: { flex: 1, borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: 9, fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: c.text.primary },
  addBtn: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.text.bright },
}));
