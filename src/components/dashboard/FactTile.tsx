import { View, Text, StyleSheet } from 'react-native';
import { themedStyles } from '@/theme';
import PatternTileBackground from './PatternTileBackground';
import type { StatTilePosition } from './tilePosition';

// "Ciekawostka" (2026-10-26) — user usunął kropkę karuzeli (było zapowiedzią przyszłego
// swipe'a między wieloma ciekawostkami, teraz nieużywane — jeśli karuzela wróci,
// potrzebny będzie inny wskaźnik stron). Tekst wycentrowany w całym kaflu.
//
// Monochromatyczne — `accent` prop USUNIĘTY (2026-10-30, redesign, patrz
// PatternTileBackground.tsx). Ikona Globe USUNIĘTA CAŁKOWICIE (2026-10-30, user
// zaznaczył ją na referencyjnym screenshocie: "wywal tę ikonkę przy ciekawostkach") —
// nie zastąpiona niczym, kafel to teraz czysty wycentrowany tekst.
export default function FactTile({
  position,
  text,
}: {
  position: StatTilePosition;
  text: string;
}) {
  const s = makeS();
  return (
    <PatternTileBackground position={position}>
      <View style={s.wrap}>
        <Text
          style={s.title}
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

const makeS = themedStyles((c) => StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 19, textAlign: 'center', color: c.text.primary },
}));
