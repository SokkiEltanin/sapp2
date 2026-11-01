import { View, Text, StyleSheet } from 'react-native';
import { spacing, themedStyles } from '@/theme';
import Tile, { type TileVariant } from './Tile';

// `StatTile` — design/app-design.html §Komponenty: "liczba / jednostka / etykieta,
// IDENTYCZNA struktura w całym rzędzie (liczby na jednej linii)". Celowo bez
// wariantów per-tile (żadnych osobnych paddingów/wyrównań) — to jest DOSŁOWNIE ten
// wymóg: każdy StatTile w rzędzie renderuje się identycznie, żeby liczby wizualnie
// siadały na tej samej linii bazowej niezależnie od długości etykiety pod nią.
export default function StatTile({
  value,
  unit,
  label,
  variant = 'default',
  pulse = false,
  onPress,
}: {
  value: string;
  unit: string;
  label: string;
  variant?: TileVariant;
  pulse?: boolean;
  onPress?: () => void;
}) {
  const s = makeS();
  const isHot = variant === 'hot';
  return (
    <Tile variant={variant} pulse={pulse} onPress={onPress} style={s.wrap}>
      <Text style={[s.num, isHot && s.numHot]} numberOfLines={1}>{value}</Text>
      <Text style={[s.unit, isHot && s.unitHot]} numberOfLines={1}>{unit}</Text>
      <Text style={[s.lab, isHot && s.labHot]} numberOfLines={1}>{label}</Text>
    </Tile>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 14, paddingBottom: 12, paddingHorizontal: 4 },
  num: { fontSize: 30, fontFamily: 'Inter_800ExtraBold', letterSpacing: -1.2, color: c.text.bright, lineHeight: 32 },
  numHot: { color: c.bg.primary },
  unit: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2, color: c.text.muted, textTransform: 'uppercase', marginTop: 4 },
  unitHot: { color: 'rgba(0,0,0,0.55)' },
  lab: { fontSize: 10, fontFamily: 'Inter_800ExtraBold', letterSpacing: 0.6, textTransform: 'uppercase', color: c.text.primary, marginTop: spacing[2] },
  labHot: { color: c.bg.primary },
}));
