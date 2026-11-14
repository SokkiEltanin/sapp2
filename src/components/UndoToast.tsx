import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radius, themedStyles } from '@/theme';
import { useUndoStore, runUndo } from '@/services/undo';

// Pasek "Cofnij" nad nawigacją — patrz services/undo.ts.
export function UndoToast() {
  const s = makeS();
  const insets = useSafeAreaInsets();
  const label = useUndoStore((x) => x.label);
  if (!label) return null;
  return (
    <View pointerEvents="box-none" style={[s.wrap, { bottom: insets.bottom + 156 }]}>
      <View style={s.bar}>
        <Text style={s.txt} numberOfLines={1}>{label}</Text>
        <TouchableOpacity onPress={runUndo} hitSlop={10} accessibilityRole="button">
          <Text style={s.btn}>Cofnij</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  wrap: { position: 'absolute', left: spacing[3], right: spacing[3], alignItems: 'center', zIndex: 60 },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[4], maxWidth: 480, width: '100%',
    backgroundColor: c.text.bright, borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  txt: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.bg.primary },
  btn: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary, textDecorationLine: 'underline' },
}));
