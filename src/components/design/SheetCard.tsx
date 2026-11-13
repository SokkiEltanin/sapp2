import type { ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { spacing, radius, themedStyles } from '@/theme';

// Karta wewnątrz sheeta szczegółów (2026-11-13, user: "podziel to na kafelki,
// osobne"): każdy temat (teraz, 24 h, 7 dni, powietrze, fazy snu…) w osobnym
// kafelku zamiast jednej długiej ściany. `right` = legenda/skrót w nagłówku.
export function SheetCard({ title, right, children, style }: { title?: string; right?: ReactNode; children: ReactNode; style?: ViewStyle }) {
  const s = makeS();
  return (
    <View style={[s.card, style]}>
      {(title || right) && (
        <View style={s.head}>
          {title ? <Text style={s.title}>{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

// Legenda: kolorowy znacznik + podpis, w rzędzie.
export function Legend({ items }: { items: { color: string; label: string; line?: boolean }[] }) {
  const s = makeS();
  return (
    <View style={s.legend}>
      {items.map((it) => (
        <View key={it.label} style={s.legItem}>
          <View style={[it.line ? s.legLine : s.legSq, { backgroundColor: it.color }]} />
          <Text style={s.legText}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  card: { backgroundColor: c.ui.in, borderRadius: radius.lg, padding: spacing[3], marginTop: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], marginBottom: spacing[2] },
  title: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: spacing[3], rowGap: 2, flexShrink: 1 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legSq: { width: 8, height: 8, borderRadius: 2 },
  legLine: { width: 10, height: 2, borderRadius: 1 },
  legText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
}));
