import { View, Text, StyleSheet } from 'react-native';
import { Moon } from 'lucide-react-native';
import { themedStyles } from '@/theme';
import PatternTileBackground from './PatternTileBackground';
import type { StatTilePosition } from './tilePosition';

// "Sen" (2026-10-26) — user: "godzina snu ma rozmiar 48, napis SNU 40" (na jego
// referencyjnym ekranie 1440px) — przeliczone proporcjonalnie, nie 1:1.
export default function SleepTile({
  position,
  accent,
  duration,
  window,
}: {
  position: StatTilePosition;
  accent: string;
  duration: string;
  window: string;
}) {
  const s = makeS();
  return (
    <PatternTileBackground position={position} accent={accent}>
      <View style={s.topRow}>
        <View />
        <Moon size={18} color={accent} />
      </View>
      <View>
        <Text style={[s.value, { color: accent }]}>{duration}</Text>
        <Text style={s.label}>SNU</Text>
      </View>
      <Text style={[s.window, { color: accent }]}>{window}</Text>
    </PatternTileBackground>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontFamily: 'Inter_900Black', fontSize: 20 },
  label: { fontFamily: 'Inter_200ExtraLight', fontSize: 15, color: c.text.primary, marginTop: -2 },
  window: { fontFamily: 'Inter_700Bold', fontSize: 14 },
}));
