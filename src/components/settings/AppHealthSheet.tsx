import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { healthSummary, type HealthRow } from '@/utils/appHealth';

// Stan appki (2026-11-14) — kropka (zielona / pomarańczowa / czerwona), co i co zrobić.
const DOT = { ok: colors.accent.green, warn: colors.accent.orange, bad: colors.accent.red };

export default function AppHealthSheet({ visible, onClose, rows }: { visible: boolean; onClose: () => void; rows: HealthRow[] }) {
  const s = makeS();
  return (
    <AppBottomSheet visible={visible} onClose={onClose} header={
      <View>
        <Text style={s.title}>Stan appki</Text>
        <Text style={s.sub}>{healthSummary(rows)}</Text>
      </View>
    }>
      {rows.map((r) => (
        <View key={r.key} style={s.row}>
          <View style={[s.dot, { backgroundColor: DOT[r.level] }]} />
          <View style={s.main}>
            <View style={s.head}>
              <Text style={s.label}>{r.label}</Text>
              <Text style={[s.detail, r.level !== 'ok' && { color: DOT[r.level] }]} numberOfLines={2}>{r.detail}</Text>
            </View>
            {r.fix && <Text style={s.fix}>→ {r.fix}</Text>}
          </View>
        </View>
      ))}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  sub: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted, marginTop: 2, paddingBottom: spacing[2] },
  row: { flexDirection: 'row', gap: spacing[3], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: c.ui.line },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  main: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] },
  label: { fontSize: 13.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  detail: { flexShrink: 1, textAlign: 'right', fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  fix: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 3 },
}));
