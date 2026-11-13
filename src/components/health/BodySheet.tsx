import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Footprints, Trash2 } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useHealthStore } from '@/store/healthStore';
import { todayISO } from '@/utils/date';
import { haptic } from '@/utils/haptics';

// Kroki i ciało (2026-11-13, user: "po kliknięciu w kafelek z krokami... na górze
// kroki, niżej waga, będzie można wprowadzić, i ewentualnie inne z zegarka rzeczy,
// ale drugorzędne"). Waga: ręczne wpisy (healthStore.manualWeights) + ostatni
// odczyt z Health Connect — pokazujemy nowszy.
const WD = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const pl = (n: number, d = 0) => n.toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d });

export default function BodySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const today = useHealthStore((st) => st.today);
  const history = useHealthStore((st) => st.history);
  const manual = useHealthStore((st) => st.manualWeights);
  const addWeight = useHealthStore((st) => st.addWeight);
  const removeWeight = useHealthStore((st) => st.removeWeight);
  const [kg, setKg] = useState('');

  const week = useMemo(() => {
    const out: { key: string; label: string; steps: number | null }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const k = keyOf(d);
      const snap = k === today?.date ? today : history[k];
      out.push({ key: k, label: WD[d.getDay()], steps: snap?.steps ?? null });
    }
    return out;
  }, [history, today]);
  const withSteps = week.filter((w) => w.steps != null) as { key: string; label: string; steps: number }[];
  const avgSteps = withSteps.length ? Math.round(withSteps.reduce((a, w) => a + w.steps, 0) / withSteps.length) : null;
  const maxSteps = Math.max(1, ...withSteps.map((w) => w.steps));

  const sortedManual = [...manual].sort((a, b) => b.at.localeCompare(a.at));
  const lastManual = sortedManual[0] ?? null;
  // Ręczna waga z dziś/później wygrywa z odczytem z zegarka (ten ma tylko wartość, bez daty).
  const weight = lastManual ? lastManual.kg : today?.weightKg ?? null;
  const monthAgo = keyOf(new Date(Date.now() - 30 * 86400000));
  const older = sortedManual.find((w) => w.date <= monthAgo);
  const trend = weight != null && older ? Math.round((weight - older.kg) * 10) / 10 : null;

  const kgVal = parseFloat(kg.replace(',', '.'));
  const canAdd = kgVal > 20 && kgVal < 400;
  const submit = () => {
    if (!canAdd) return;
    haptic.success();
    addWeight(Math.round(kgVal * 10) / 10, todayISO());
    setKg('');
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose}>
      <View style={s.head}>
        <Footprints size={15} color={colors.text.secondary} />
        <Text style={s.title}>Kroki i ciało</Text>
      </View>

      <Text style={s.big}>{today?.steps != null ? pl(today.steps) : '—'}</Text>
      <Text style={s.sub}>kroków dziś{avgSteps != null ? ` · średnio ${pl(avgSteps)} / dzień w tym tygodniu` : ''}</Text>
      <View style={s.weekRow}>
        {week.map((w, i) => (
          <View key={w.key} style={s.weekCol}>
            <View style={s.weekBox}>
              {w.steps != null ? (
                <View style={[s.weekBar, { height: `${Math.max(4, (w.steps / maxSteps) * 100)}%` }, i === 6 && s.weekBarToday]} />
              ) : <View style={s.weekNone} />}
            </View>
            <Text style={[s.weekDay, i === 6 && { color: colors.text.primary }]}>{w.label}</Text>
          </View>
        ))}
      </View>

      <Text style={s.section}>Waga</Text>
      <View style={s.weightRow}>
        <Text style={s.weightVal}>{weight != null ? `${pl(weight, 1)} kg` : '—'}</Text>
        {trend != null && <Text style={[s.trend, { color: trend > 0 ? colors.accent.orange : colors.accent.green }]}>{trend > 0 ? '+' : ''}{pl(trend, 1)} kg / 30 dni</Text>}
      </View>
      <View style={s.inputRow}>
        <TextInput value={kg} onChangeText={setKg} style={s.input} placeholder="dzisiejsza waga, np. 78,4" placeholderTextColor={colors.text.muted}
          keyboardType="decimal-pad" onSubmitEditing={submit} returnKeyType="done" />
        <TouchableOpacity style={[s.addBtn, !canAdd && { opacity: 0.4 }]} onPress={submit} disabled={!canAdd} activeOpacity={0.8}>
          <Text style={s.addLabel}>Zapisz</Text>
        </TouchableOpacity>
      </View>
      {sortedManual.slice(0, 4).map((w) => (
        <View key={w.at} style={s.histRow}>
          <Text style={s.histDate}>{w.date.split('-').reverse().slice(0, 2).join('.')}</Text>
          <Text style={s.histVal}>{pl(w.kg, 1)} kg</Text>
          <TouchableOpacity onPress={() => { haptic.tap(); removeWeight(w.at); }} hitSlop={8}>
            <Trash2 size={13} color={colors.text.muted} />
          </TouchableOpacity>
        </View>
      ))}

      <Text style={s.section}>Z zegarka</Text>
      <View style={s.grid}>
        <View style={s.cell}><Text style={s.val}>{today?.restingHeartRate != null ? `${today.restingHeartRate}` : '—'}</Text><Text style={s.key}>tętno spoczynkowe</Text></View>
        <View style={s.cell}><Text style={s.val}>{today?.hydrationMl != null ? `${pl(today.hydrationMl / 1000, 1)} l` : '—'}</Text><Text style={s.key}>wypita woda</Text></View>
      </View>
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  big: { fontSize: 40, lineHeight: 46, fontFamily: 'Inter_900Black', color: c.text.primary, letterSpacing: -1.2, marginTop: spacing[3] },
  sub: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  weekRow: { flexDirection: 'row', gap: 6, height: 80, marginTop: spacing[3] },
  weekCol: { flex: 1, alignItems: 'center', gap: 4 },
  weekBox: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  weekBar: { width: '70%', borderRadius: 4, backgroundColor: c.text.muted },
  weekBarToday: { backgroundColor: c.text.bright },
  weekNone: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.border.default },
  weekDay: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  section: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[5], marginBottom: spacing[2] },
  weightRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[3] },
  weightVal: { fontSize: 24, fontFamily: 'Inter_900Black', color: c.text.primary },
  trend: { fontSize: 12, fontFamily: 'Inter_800ExtraBold' },
  inputRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  input: { flex: 1, borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  addBtn: { paddingHorizontal: spacing[4], borderRadius: radius.md, backgroundColor: c.text.bright, justifyContent: 'center' },
  addLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border.default },
  histDate: { width: 48, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  histVal: { flex: 1, fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  grid: { flexDirection: 'row' },
  cell: { flex: 1 },
  val: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  key: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 },
}));
