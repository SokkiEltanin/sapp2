import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { themedStyles } from '@/theme';
import { cornersForPosition, TILE_ROW_HEIGHT, type StatTilePosition } from './tilePosition';

// Placeholder — user nie specyfikował jeszcze tego kafla (wiemy tylko że istnieje, LVL +
// maskotka, z mockupu). Czysty tekst, bez ilustracji, do doprecyzowania później
// (patrz NEXT_STEPS.md — powiązane z pomysłem "Pupil jako roślinka").
export default function LevelTile({
  position,
  level,
}: {
  position: StatTilePosition;
  level: number;
}) {
  const s = makeS();
  return (
    <View style={[s.tile, cornersForPosition(position)]}>
      <Text style={s.label}>LVL</Text>
      <Text style={s.value}>{level}</Text>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  tile: {
    flex: 1, height: TILE_ROW_HEIGHT, backgroundColor: c.bg.card, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontFamily: 'Inter_700Bold', fontSize: 11, color: colors.accent.red, letterSpacing: 1 },
  value: { fontFamily: 'Inter_900Black', fontSize: 24, color: colors.text.primary, marginTop: -2 },
}));
