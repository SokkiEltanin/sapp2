import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing, themedStyles } from '@/theme';
import { haptic } from '@/utils/haptics';

// `ChipRow` — design/app-design.html §Komponenty: "poziomy ScrollView, fade na
// krawędziach, chipy 34–40px". Spec ma DWA układy chipów: zawijający się
// (`.chips`, np. tagi kategorii transakcji) i poziomo-scrollowalny z blaknącymi
// krawędziami (`.chips.hs`, np. filtr szablonów w Ustawieniach) — `scroll` tu wybiera
// który. RN nie ma CSS `mask-image`, więc fade na krawędziach odtworzony przez dwa
// małe `LinearGradient` nałożone na brzegi (ten sam `expo-linear-gradient`, który
// appka już ma jako zależność).
export interface ChipRowItem {
  key: string;
  label: string;
}

export default function ChipRow({
  items,
  selected,
  onToggle,
  size = 'md',
  scroll = false,
}: {
  items: ChipRowItem[];
  selected: string[];
  onToggle: (key: string) => void;
  size?: 'md' | 'sm';
  scroll?: boolean;
}) {
  const s = makeS();
  const chips = items.map((it) => {
    const on = selected.includes(it.key);
    return (
      <Pressable
        key={it.key}
        onPress={() => { haptic.tap(); onToggle(it.key); }}
        style={[s.chip, size === 'sm' ? s.chipSm : s.chipMd, on && s.chipOn]}
      >
        <Text style={[s.label, on && s.labelOn]} numberOfLines={1}>{it.label}</Text>
      </Pressable>
    );
  });

  if (!scroll) {
    return <View style={s.wrap}>{chips}</View>;
  }

  return (
    <View style={s.scrollWrap}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {chips}
      </ScrollView>
      <LinearGradient colors={['#000000', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.fade, s.fadeLeft]} pointerEvents="none" />
      <LinearGradient colors={['transparent', '#000000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.fade, s.fadeRight]} pointerEvents="none" />
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[2] },
  scrollWrap: { position: 'relative', marginBottom: spacing[2] },
  scrollContent: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: 2 },
  chip: { backgroundColor: c.ui.in, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chipMd: { height: 40, paddingHorizontal: 14 },
  chipSm: { height: 34, paddingHorizontal: 12 },
  chipOn: { backgroundColor: c.text.primary },
  label: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.primary },
  labelOn: { color: c.bg.primary },
  fade: { position: 'absolute', top: 0, bottom: 0, width: 16 },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
}));
