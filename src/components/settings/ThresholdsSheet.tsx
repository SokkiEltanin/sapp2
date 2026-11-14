import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Minus, Plus, RotateCcw } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useThresholdsStore } from '@/store/thresholdsStore';
import { DEFAULT_THRESHOLDS, type Thresholds } from '@/utils/thresholds';
import { haptic } from '@/utils/haptics';

// Progi i przypomnienia (2026-11-14) — liczby, które wcześniej były zaszyte w kodzie.
type Row = { key: keyof Thresholds; label: string; hint: string; step: number; fmt: (v: number) => string };
const ROWS: Row[] = [
  { key: 'fuelMin', label: 'Paliwo od kwoty', hint: 'zakup na stacji poniżej tej kwoty to nie tankowanie (kawa, batonik) — appka nie pyta o litry', step: 5, fmt: (v) => `${v} zł` },
  { key: 'budgetWarnPct', label: 'Ostrzeżenie budżetu', hint: 'od ilu procent limitu budżet robi się pomarańczowy i przychodzi powiadomienie', step: 5, fmt: (v) => `${v}%` },
  { key: 'reminderHour', label: 'Godzina przypomnień', hint: 'o której przychodzą przypomnienia o stałych opłatach i wymianach', step: 1, fmt: (v) => `${v}:00` },
];

export default function ThresholdsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const t = useThresholdsStore((st) => st.t);
  const set = useThresholdsStore((st) => st.set);
  const changed = ROWS.some((r) => t[r.key] !== DEFAULT_THRESHOLDS[r.key]);

  return (
    <AppBottomSheet visible={visible} onClose={onClose} header={<Text style={s.title}>Progi i przypomnienia</Text>}>
      {ROWS.map((r) => (
        <View key={r.key} style={s.row}>
          <View style={s.rowHead}>
            <Text style={s.label}>{r.label}</Text>
            <View style={s.stepper}>
              <TouchableOpacity style={s.btn} onPress={() => { haptic.tap(); set({ [r.key]: t[r.key] - r.step }); }} accessibilityLabel={`${r.label}: mniej`}>
                <Minus size={15} color={colors.text.secondary} />
              </TouchableOpacity>
              <Text style={s.val}>{r.fmt(t[r.key])}</Text>
              <TouchableOpacity style={s.btn} onPress={() => { haptic.tap(); set({ [r.key]: t[r.key] + r.step }); }} accessibilityLabel={`${r.label}: więcej`}>
                <Plus size={15} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={s.hint}>{r.hint}{t[r.key] !== DEFAULT_THRESHOLDS[r.key] ? ` · domyślnie ${r.fmt(DEFAULT_THRESHOLDS[r.key])}` : ''}</Text>
        </View>
      ))}
      {changed && (
        <TouchableOpacity style={s.reset} onPress={() => { haptic.tap(); set(DEFAULT_THRESHOLDS); }}>
          <RotateCcw size={13} color={colors.text.muted} />
          <Text style={s.resetLabel}>Przywróć domyślne</Text>
        </TouchableOpacity>
      )}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, paddingBottom: spacing[2] },
  row: { paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: c.ui.line },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  label: { flexShrink: 1, fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  btn: { width: 34, height: 32, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  val: { minWidth: 58, textAlign: 'center', fontSize: 15, fontFamily: 'Inter_900Black', color: c.text.primary },
  hint: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 4, lineHeight: 16 },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center', marginTop: spacing[3], padding: spacing[2] },
  resetLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted },
}));
