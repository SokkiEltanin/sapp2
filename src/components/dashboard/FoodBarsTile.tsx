import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, themedStyles } from '@/theme';
import { cornersForPosition, TILE_ROW_HEIGHT, type StatTilePosition } from './tilePosition';

// Mini wykres słupkowy w kaflu Finanse (2026-10-26) — user: "ogarniesz już po stylu".
// Wysokość słupka proporcjonalna do wartości względem max w zestawie (sensowny domyślny
// wybór, niezależnie od dokładnych, prawdopodobnie orientacyjnych wysokości w mockupie).
// Kolumna "average" (np. "~ŚR") ma słupek z przerywaną ramką zamiast wypełnienia
// (2026-10-30) — odróżnia wartość odniesienia od realnych miesięcy, bez znikania.
//
// Monochromatyczne (2026-10-30, redesign) — usunięty gradient tła oraz kolorowanie
// `colors.stat.finanse` na aktywnej kolumnie/tytule: aktywna (bieżący miesiąc) kolumna
// jest teraz jasna/neutralna (`c.text.bright`), reszta (w tym "average") ciemnoszara
// (`colors.chart.muted`) — w referencyjnym mockupie tylko OSTATNIA kolumna (bieżący
// miesiąc) jest jaśniejsza, "average" NIE jest już specjalnie wyróżniona kolorem.
export type BarColumn = {
  label: string;
  value: number;
  display: string; // sformatowana wartość do pokazania nad słupkiem, np. "843"
  kind: 'average' | 'bar' | 'highlight';
};

export default function FoodBarsTile({
  position,
  title,
  columns,
}: {
  position: StatTilePosition;
  title: string;
  columns: BarColumn[];
}) {
  const s = makeS();
  const maxValue = Math.max(...columns.map((c) => c.value));

  return (
    <View style={[s.tile, cornersForPosition(position)]}>
      <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{title}</Text>
      <View style={s.columns}>
        {columns.map((col) => {
          const active = col.kind === 'highlight';
          const tint = active ? colors.text.bright : colors.chart.muted;
          return (
            <View key={col.label} style={s.column}>
              <Text
                style={[s.value, { color: tint }, active && s.valueActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {col.display}
              </Text>
              <View style={s.barTrack}>
                {col.kind === 'average' ? (
                  // Prostokąt średniej, WYSOKOŚĆ jak zwykły słupek (user, 2026-10-27:
                  // "miała pokazywać tę średnią wysokością względem innych kafelków"),
                  // ale PRZERYWANA ramka zamiast pełnego wypełnienia — odróżnia
                  // "wartość odniesienia" od realnych danych miesięcy, zamiast zupełnie
                  // zanikać jak w poprzedniej wersji (sama kreska bez prostokąta — user
                  // zaznaczył na referencyjnym screenshocie 2026-10-30: "w wydatkach
                  // jedzenia brakuje tam prostokąt przy średniej").
                  <View
                    style={[
                      s.bar,
                      s.avgBar,
                      { height: `${Math.max(12, (col.value / maxValue) * 100)}%` },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      s.bar,
                      { height: `${Math.max(12, (col.value / maxValue) * 100)}%` },
                      { backgroundColor: active ? colors.text.bright : colors.chart.barBg },
                    ]}
                  />
                )}
              </View>
              <Text
                style={[s.label, { color: tint }, active && s.labelActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {col.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  tile: {
    flex: 3, height: TILE_ROW_HEIGHT, backgroundColor: c.bg.card, overflow: 'hidden',
    padding: spacing[2],
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 11, color: c.text.secondary, marginBottom: 4 },
  columns: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  // `alignItems: 'stretch'` (domyślne) — Text potrzebuje realnej szerokości kolumny żeby
  // `adjustsFontSizeToFit` miało względem czego się kurczyć (ten sam fix co StatTile).
  column: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  value: { fontFamily: 'Inter_700Bold', fontSize: 11, textAlign: 'center' },
  valueActive: { fontFamily: 'Inter_900Black' },
  barTrack: {
    flex: 1, width: '72%', alignSelf: 'center', justifyContent: 'flex-end', marginVertical: 3,
    position: 'relative',
  },
  bar: { width: '100%', borderRadius: 3 },
  avgBar: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.chart.muted, borderStyle: 'dashed' },
  label: { fontFamily: 'Inter_700Bold', fontSize: 9, textAlign: 'center' },
  labelActive: { fontFamily: 'Inter_900Black' },
}));
