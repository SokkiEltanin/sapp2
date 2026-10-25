import { ComponentType } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing, radius, themedStyles } from '@/theme';

// Wspólny szkielet dla pustych zakładek-korzeni (§ plan sapp2, "struktura najpierw") —
// JEDEN komponent zamiast kopiowania tego samego layoutu w każdym z 5 plików, zgodnie z
// zasadą "zero bespoke-drugi-raz" z naszych ustalonych zasad.
export default function PlaceholderScreen({
  icon: Icon, title, subtitle, accent,
}: {
  icon: ComponentType<{ size?: number; color?: string }>; title: string; subtitle: string; accent: string;
}) {
  const s = makeS();
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.center}>
        <LinearGradient colors={[accent + '33', accent + '0D']} style={s.iconWrap}>
          <Icon size={40} color={accent} />
        </LinearGradient>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], paddingHorizontal: spacing[6] },
  iconWrap: { width: 84, height: 84, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[2] },
  title: { fontSize: 22, fontWeight: '900', color: c.text.primary },
  subtitle: { fontSize: 13, color: c.text.muted, textAlign: 'center', lineHeight: 19 },
}));
