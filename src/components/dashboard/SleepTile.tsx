import { View, Text, StyleSheet } from 'react-native';
import { Moon } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { themedStyles } from '@/theme';
import PatternTileBackground from './PatternTileBackground';
import type { StatTilePosition } from './tilePosition';

// "Sen" (2026-10-26) — user: "godzina snu ma rozmiar 48, napis SNU 40" (na jego
// referencyjnym ekranie 1440px) — przeliczone proporcjonalnie, nie 1:1. Ikona + czas
// snu + etykieta SNU grupowane w JEDNO dziecko (`topGroup`), żeby `space-between` z
// `PatternTileBackground` rozciągał tylko DWIE rzeczy (grupę u góry i zakres godzin na
// dole) zamiast trzech — inaczej czas snu lądował wizualnie na środku kafla zamiast
// zaraz pod ikoną w lewym górnym rogu (user to poprawił 2026-10-26).
//
// Monochromatyczne — `accent` prop USUNIĘTY (2026-10-30, redesign): `duration`
// (wyróżniona wartość) na `c.text.bright`, `window` (zakres godzin) na `c.text.secondary`,
// ikona neutralna.
export default function SleepTile({
  position,
  duration,
  window,
}: {
  position: StatTilePosition;
  duration: string;
  window: string;
}) {
  const s = makeS();
  return (
    <PatternTileBackground position={position}>
      <View style={s.topGroup}>
        <View style={s.topRow}>
          <View />
          <Moon size={18} color={colors.text.secondary} />
        </View>
        <Text style={s.value}>{duration}</Text>
        <Text style={s.label}>SNU</Text>
      </View>
      <Text style={s.window}>{window}</Text>
    </PatternTileBackground>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  topGroup: {},
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontFamily: 'Inter_900Black', fontSize: 25, marginTop: 0, color: c.text.bright },
  label: { fontFamily: 'Inter_200ExtraLight', fontSize: 15, color: c.text.primary, marginTop: -4 },
  window: { fontFamily: 'Inter_700Bold', fontSize: 14, color: c.text.secondary },
}));
