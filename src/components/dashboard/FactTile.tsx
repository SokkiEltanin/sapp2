import { View, Text, StyleSheet } from 'react-native';
import { Globe } from 'lucide-react-native';
import { themedStyles } from '@/theme';
import PatternTileBackground from './PatternTileBackground';
import type { StatTilePosition } from './tilePosition';

// "Ciekawostka" (2026-10-26) — user usunął kropkę karuzeli (było zapowiedzią przyszłego
// swipe'a między wieloma ciekawostkami, teraz nieużywane — jeśli karuzela wróci,
// potrzebny będzie inny wskaźnik stron). Tekst wycentrowany w całym kaflu, ikona
// przypięta osobno w rogu (position: absolute), żeby nie brała udziału w centrowaniu.
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
      <View style={s.wrap}>
        <Globe size={18} color={accent} style={s.icon} />
        <Text
          style={[s.title, { color: accent }]}
          numberOfLines={4}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {text}
        </Text>
      </View>
    </PatternTileBackground>
  );
}

const makeS = themedStyles(() => StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { position: 'absolute', top: 0, left: 0 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 19, textAlign: 'center' },
}));
