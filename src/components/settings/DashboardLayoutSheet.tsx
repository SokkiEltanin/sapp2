import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronUp, ChevronDown, Eye, EyeOff, RotateCcw } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useDashboardLayoutStore } from '@/store/dashboardLayoutStore';
import { DASH_SECTIONS, DEFAULT_ORDER, normalizeOrder } from '@/utils/dashboardLayout';
import { haptic } from '@/utils/haptics';

// Układ Dashboardu (2026-11-14): kolejność rzędów (strzałki) i ukrywanie (oko).
export default function DashboardLayoutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const order = normalizeOrder(useDashboardLayoutStore((st) => st.order));
  const hidden = useDashboardLayoutStore((st) => st.hidden);
  const { move, toggle, reset } = useDashboardLayoutStore.getState();
  const changed = hidden.length > 0 || order.some((id, i) => id !== DEFAULT_ORDER[i]);

  return (
    <AppBottomSheet visible={visible} onClose={onClose} header={
      <View>
        <Text style={s.title}>Układ Dashboardu</Text>
        <Text style={s.sub}>Kolejność rzędów od góry. Ukryty rząd oddaje miejsce notatce i eventom.</Text>
      </View>
    }>
      {order.map((id, i) => {
        const meta = DASH_SECTIONS.find((x) => x.id === id)!;
        const off = hidden.includes(id);
        return (
          <View key={id} style={[s.row, off && s.rowOff]}>
            <Text style={s.idx}>{i + 1}</Text>
            <View style={s.main}>
              <Text style={s.label}>{meta.label}</Text>
              <Text style={s.hint} numberOfLines={1}>{off ? 'ukryty' : meta.hint}</Text>
            </View>
            <TouchableOpacity style={s.btn} onPress={() => { haptic.tap(); move(id, -1); }} disabled={i === 0} accessibilityLabel={`${meta.label}: wyżej`}>
              <ChevronUp size={17} color={i === 0 ? colors.text.muted : colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.btn} onPress={() => { haptic.tap(); move(id, 1); }} disabled={i === order.length - 1} accessibilityLabel={`${meta.label}: niżej`}>
              <ChevronDown size={17} color={i === order.length - 1 ? colors.text.muted : colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, !off && s.btnOn]} onPress={() => { haptic.tap(); toggle(id); }} accessibilityLabel={`${meta.label}: ${off ? 'pokaż' : 'ukryj'}`}>
              {off ? <EyeOff size={16} color={colors.text.muted} /> : <Eye size={16} color={colors.bg.primary} />}
            </TouchableOpacity>
          </View>
        );
      })}
      {changed && (
        <TouchableOpacity style={s.reset} onPress={() => { haptic.tap(); reset(); }}>
          <RotateCcw size={13} color={colors.text.muted} />
          <Text style={s.resetLabel}>Przywróć domyślny</Text>
        </TouchableOpacity>
      )}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  sub: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 2, paddingBottom: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.ui.line },
  rowOff: { opacity: 0.55 },
  idx: { width: 16, fontSize: 12, fontFamily: 'Inter_900Black', color: c.text.muted, textAlign: 'center' },
  main: { flex: 1, minWidth: 0 },
  label: { fontSize: 13.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  hint: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 1 },
  btn: { width: 34, height: 34, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  btnOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center', marginTop: spacing[3], padding: spacing[2] },
  resetLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted },
}));
