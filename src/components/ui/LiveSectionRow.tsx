import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { ComponentType } from 'react';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';

// Wiersz sekcji Daily która JUŻ działa (w odróżnieniu od `ComingSoonRow`'s "Wkrótce") —
// ten sam wizualny język (ikona w odznace, label, opis), ale klikalny, z dynamicznym
// statusem po prawej zamiast stałego badge'a. Pierwszy konsument: HUMOR (2026-10-31).
export default function LiveSectionRow({
  icon: Icon, label, status, onPress, isLast,
}: {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  status: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const s = makeS();
  return (
    <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} onPress={onPress} activeOpacity={0.7}>
      <View style={s.iconWrap}>
        <Icon size={16} color={colors.text.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
      </View>
      <Text style={s.status} numberOfLines={1}>{status}</Text>
    </TouchableOpacity>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], paddingHorizontal: spacing[3] },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: c.border.subtle },
  iconWrap: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.elevated },
  label: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  status: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.bright, maxWidth: 140 },
}));
