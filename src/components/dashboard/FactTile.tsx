import { View, Text, StyleSheet } from 'react-native';
import { Globe } from 'lucide-react-native';
import { themedStyles } from '@/theme';
import PatternTileBackground from './PatternTileBackground';
import type { StatTilePosition } from './tilePosition';

// "Ciekawostka" (2026-10-26) — kropka na dole to zapowiedź karuzeli wielu ciekawostek
// (swipe), NA RAZIE statyczna, nieinteraktywna — patrz NEXT_STEPS.md.
export default function FactTile({
  position,
  accent,
  text,
}: {
  position: StatTilePosition;
  accent: string;
  text: string;
}) {
  const s = makeS();
  return (
    <PatternTileBackground position={position} accent={accent}>
      <Globe size={18} color={accent} />
      <Text style={[s.title, { color: accent }]}>{text}</Text>
      <View style={s.dots}>
        <View style={[s.dot, { backgroundColor: accent }]} />
      </View>
    </PatternTileBackground>
  );
}

const makeS = themedStyles(() => StyleSheet.create({
  title: { fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 18 },
  dots: { flexDirection: 'row', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 999 },
}));
