import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { themedStyles } from '@/theme';
import { haptic } from '@/utils/haptics';

// `Segmented` — design/app-design.html §Komponenty: "bg `in`, aktywny segment bg
// `txt` + czarny tekst, wysokość 40". Używany w Zadaniach (Teraz/Terminowe/Bez
// terminu) — `count` opcjonalny, renderuje się jako przygaszona liczba po etykiecie
// (spec: `.seg button b{opacity:.55}`), np. "Terminowe 3".
export interface SegmentedOption {
  key: string;
  label: string;
  count?: number;
}

export default function Segmented({
  options,
  activeKey,
  onChange,
}: {
  options: SegmentedOption[];
  activeKey: string;
  onChange: (key: string) => void;
}) {
  const s = makeS();
  return (
    <View style={s.wrap}>
      {options.map((o) => {
        const active = o.key === activeKey;
        return (
          <Pressable key={o.key} style={[s.btn, active && s.btnOn]} onPress={() => { haptic.tap(); onChange(o.key); }}>
            <Text style={[s.label, active && s.labelOn]} numberOfLines={1}>
              {o.label}{o.count !== undefined ? <Text style={s.count}> {o.count}</Text> : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: c.ui.in, borderRadius: 14, padding: 4, flex: 1, gap: 2 },
  btn: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnOn: { backgroundColor: c.text.primary },
  label: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted },
  labelOn: { color: c.bg.primary },
  count: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', opacity: 0.55 },
}));
