import { useState } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { spacing, themedStyles } from '@/theme';

// `Row` (spec: "Item") — design/app-design.html §Komponenty: bg `in`, radius 10,
// wysokość 28–44, tag po lewej, tekst z ellipsis. Jeden wiersz-prymityw dla WSZYSTKICH
// list appki (transakcje, zadania, ćwiczenia, agenda) — zamiast każdy ekran budujący
// własny `TouchableOpacity`+`StyleSheet` (jak dotąd). `sublabel` (druga linia, szarym,
// mniejsza) NIE jest w podstawowej spec `.item`, ale jest explicite w Finanse's
// "Ostatnie transakcje (fill, 2-liniowe wiersze)" — opcjonalny, bez niego `Row` jest
// dokładnie jednolinijkowym `.item` ze spec.
export default function Row({
  onPress,
  height = 40,
  done = false,
  left,
  label,
  sublabel,
  right,
  style,
}: {
  onPress?: () => void;
  height?: number;
  done?: boolean;
  left?: React.ReactNode;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const s = makeS();
  const [pressed, setPressed] = useState(false);
  const body = (
    <View style={[s.base, { minHeight: height }, pressed && s.pressed, style]}>
      {left}
      <View style={s.textCol}>
        <Text style={[s.label, done && s.labelDone]} numberOfLines={1}>{label}</Text>
        {sublabel ? <Text style={s.sublabel} numberOfLines={1}>{sublabel}</Text> : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}>
      {body}
    </Pressable>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  base: {
    backgroundColor: c.ui.in, borderRadius: 10, paddingHorizontal: spacing[3],
    flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexShrink: 0,
  },
  pressed: { backgroundColor: c.ui.in2 },
  textCol: { flex: 1, minWidth: 0 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.text.primary },
  labelDone: { textDecorationLine: 'line-through', color: c.ui.dim },
  sublabel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
}));
