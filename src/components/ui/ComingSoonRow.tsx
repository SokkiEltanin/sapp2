import { View, Text, StyleSheet } from 'react-native';
import type { ComponentType } from 'react';
import { spacing, radius, themedStyles } from '@/theme';

// Wiersz "to tu będzie, jeszcze nie działa" — wspólny dla szkieletów Daily i Finanse
// (2026-10-29, user: "zacznij budować szkielet pod finanse, kalendarz, zadania" —
// lekka struktura wg ARCHITECTURE.md, pełna logika dopiero w ustalonej kolejności
// faz). Nie TouchableOpacity — nic tu jeszcze nie prowadzi nigdzie, więc nie udaje
// klikalności, której nie ma.
export default function ComingSoonRow({
  icon: Icon, label, description, accent, isLast,
}: {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  description?: string;
  accent: string;
  isLast?: boolean;
}) {
  const s = makeS();
  return (
    <View style={[s.row, !isLast && s.rowDivider]}>
      <View style={[s.iconWrap, { backgroundColor: `${accent}33` }]}>
        <Icon size={16} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        {description && <Text style={s.description}>{description}</Text>}
      </View>
      <Text style={s.badge}>Wkrótce</Text>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], paddingHorizontal: spacing[3] },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: c.border.subtle },
  iconWrap: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  description: { fontSize: 11.5, fontFamily: 'Inter_400Regular', color: c.text.muted, marginTop: 2 },
  badge: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
}));
