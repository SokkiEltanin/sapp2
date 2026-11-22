import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Sparkles, Check } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useGoodThingsStore } from '@/store/goodThingsStore';
import { goodList, goodStreak, goodExample } from '@/utils/goodThings';
import { todayISO } from '@/utils/date';
import { haptic } from '@/utils/haptics';

// Jedna dobra rzecz z dnia (2026-11-22) — wpis dnia (domyślnie dziś; stuknięcie w starszy
// wpis = jego edycja) + ostatnie dobre rzeczy. Logika: utils/goodThings.ts.
const fmt = (d: string) => {
  const t = todayISO();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const ys = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  if (d === t) return 'dziś';
  if (d === ys) return 'wczoraj';
  return new Date(`${d}T12:00:00`).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function GoodThingSheet({ visible, onClose, date: initial }: { visible: boolean; onClose: () => void; date?: string | null }) {
  const s = makeS();
  const items = useGoodThingsStore((st) => st.items);
  const setForDate = useGoodThingsStore((st) => st.setForDate);
  const today = todayISO();
  const [date, setDate] = useState(initial || today);
  const [text, setText] = useState('');
  useEffect(() => {
    if (!visible) return;
    const d = initial || today;
    setDate(d);
    setText(items.find((g) => g.date === d)?.text ?? '');
  }, [visible, initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => goodList(items), [items]);
  const streak = goodStreak(items, today);

  const save = () => {
    haptic.success();
    setForDate(date, text);
    onClose();
  };
  const pick = (d: string) => { haptic.tap(); setDate(d); setText(items.find((g) => g.date === d)?.text ?? ''); };

  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.88}
      header={
        <View style={s.head}>
          <Sparkles size={18} color={colors.accent.orange} />
          <Text style={s.title}>Dobra rzecz {fmt(date)}</Text>
          {streak >= 2 && <Text style={s.streak}>{streak} dni z rzędu</Text>}
        </View>
      }
      footer={
        <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.8}>
          <Check size={16} color={colors.bg.primary} />
          <Text style={s.saveTxt}>{text.trim() ? 'Zapisz' : items.some((g) => g.date === date) ? 'Usuń wpis' : 'Zamknij'}</Text>
        </TouchableOpacity>
      }>
      <Text style={s.hint}>Jedna rzecz, która dziś była dobra — nawet mała. Zapisywanie ich codziennie pomaga zauważać dobre chwile i obniża stres.</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={`np. ${goodExample(date)}`}
        placeholderTextColor={colors.text.muted}
        style={s.input}
        multiline
        maxLength={240}
        autoFocus={visible}
        textAlignVertical="top"
      />
      {list.length > 0 && (
        <View style={s.listCard}>
          <Text style={s.listTitle}>Twoje dobre rzeczy · {list.length}</Text>
          {list.slice(0, 14).map((g) => (
            <TouchableOpacity key={g.id} style={[s.row, g.date === date && s.rowOn]} onPress={() => pick(g.date)} activeOpacity={0.7}>
              <Text style={s.rowDate}>{fmt(g.date)}</Text>
              <Text style={s.rowTxt} numberOfLines={2}>{g.text}</Text>
            </TouchableOpacity>
          ))}
          {list.length > 14 && <Text style={s.more}>Starsze znajdziesz w wyszukiwarce (lupa) i w statystykach humoru.</Text>}
        </View>
      )}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingBottom: spacing[2] },
  title: { flex: 1, fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.bright },
  streak: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.accent.orange },
  hint: { fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_500Medium', color: c.text.muted, marginBottom: spacing[2] },
  input: {
    fontSize: 15, lineHeight: 21, fontFamily: 'Inter_600SemiBold', color: c.text.primary, minHeight: 90,
    backgroundColor: c.ui.in, borderRadius: radius.lg, padding: spacing[3],
  },
  listCard: { backgroundColor: c.ui.in, borderRadius: radius.lg, padding: spacing[3], marginTop: spacing[3], gap: 2 },
  listTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing[1] },
  row: { flexDirection: 'row', gap: spacing[3], paddingVertical: 7, paddingHorizontal: 6, borderRadius: radius.md },
  rowOn: { backgroundColor: c.ui.in2 },
  rowDate: { width: 74, fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, paddingTop: 1 },
  rowTxt: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_600SemiBold', color: c.text.primary },
  more: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[1] },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.text.bright, borderRadius: radius.lg, paddingVertical: 13 },
  saveTxt: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.bg.primary },
}));
