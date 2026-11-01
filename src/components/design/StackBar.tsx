import { View, Text, StyleSheet } from 'react-native';
import { themedStyles } from '@/theme';

// `StackBar` — design/app-design.html §Komponenty: "poziomy pasek proporcji (podział
// wydatków, kategorie jedzenia, fazy snu) + legenda z kwadracikami". Segmenty = proste
// `flex: value` w rzędzie (szerokość proporcjonalna do wartości, bez liczenia procentów
// ręcznie) — identyczny trik co `.stack i{flex:${value}}` w oryginalnym mockupie.
// `legend` ODDZIELNY prop od `segments` (nie zawsze te same pozycje — np. "Jedzenie ·
// kategorie" pokazuje pasek z WSZYSTKICH kategorii, ale legendę tylko dla pierwszych 3
// + "+N", ucinanie to decyzja ekranu, nie komponentu).
export interface StackBarSegment {
  value: number;
  color: string;
  label?: string;
}

export default function StackBar({
  segments,
  height = 10,
  legend,
  extra,
}: {
  segments: StackBarSegment[];
  height?: number;
  legend?: StackBarSegment[];
  extra?: number;
}) {
  const s = makeS();
  return (
    <View>
      <View style={[s.bar, { height, borderRadius: height / 2 }]}>
        {segments.map((seg, i) => (
          <View key={i} style={{ flex: Math.max(seg.value, 0.001), backgroundColor: seg.color }} />
        ))}
      </View>
      {legend && legend.length > 0 && (
        <View style={s.legend}>
          {legend.map((l, i) => (
            <View key={i} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: l.color }]} />
              <Text style={s.legendLabel}>
                {l.label} <Text style={s.legendValue}>{l.value}</Text>
              </Text>
            </View>
          ))}
          {extra !== undefined && extra > 0 && <Text style={s.legendExtra}>+{extra}</Text>}
        </View>
      )}
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  bar: { flexDirection: 'row', overflow: 'hidden', gap: 2, flexShrink: 0, backgroundColor: c.ui.in2 },
  legend: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted },
  legendValue: { color: c.text.primary, fontFamily: 'Inter_800ExtraBold' },
  legendExtra: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted, marginLeft: 'auto' },
}));
