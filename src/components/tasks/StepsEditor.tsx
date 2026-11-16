import { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, Plus, X } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { haptic } from '@/utils/haptics';
import { newStep } from '@/utils/taskProgress';
import type { Subtask } from '@/types/calendar';

// Kroki / kamienie milowe zadania (2026-11-16) — ten sam edytor w formularzu
// nowego zadania (AddTaskCard) i w szczegółach (TaskDetailSheet). Kółko = zrobione,
// × = usuń, pole na dole dodaje krok (Enter dodaje i zostawia klawiaturę).
export default function StepsEditor({ steps, onChange, accent, placeholder = 'Dodaj krok, np. „Napisać wstęp”' }: {
  steps: Subtask[]; onChange: (steps: Subtask[]) => void; accent?: string; placeholder?: string;
}) {
  const s = makeS();
  const [text, setText] = useState('');
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
          <Text style={[s.title, st.done && s.titleDone, st.id === firstOpen && s.titleNext]} numberOfLines={2}>{st.title}</Text>
          <TouchableOpacity onPress={() => remove(st.id)} hitSlop={8} accessibilityLabel={`Usuń krok ${st.title}`}>
            <X size={14} color={colors.text.muted} />
          </TouchableOpacity>
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
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  input: { flex: 1, borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: 9, fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: c.text.primary },
  addBtn: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.text.bright },
}));
