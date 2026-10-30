import { View, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { themedStyles } from '@/theme';
import { cornersForPosition, TILE_ROW_HEIGHT, type StatTilePosition } from './tilePosition';

// Przybliżenie "concentric pattern" z mockupu (2026-10-26, kafelki Ciekawostka/Sen) —
// dokładne parametry (liczba pierścieni, odstępy) nie były podane, tylko "Concentric
// p... 20%" w panelu warstw Figmy.
//
// Monochromatyczny redesign (2026-10-30, user podesłał SVG-referencję: "wywaliłem
// gradienty i poprawiłem monochromatyczność") — pierścienie NEUTRALNE (`chart.muted`),
// nie kolorowane per-kategoria jak wcześniej.
function ConcentricPattern() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 220 160"
      preserveAspectRatio="xMidYMid slice"
      style={StyleSheet.absoluteFillObject}
    >
      {[20, 42, 64, 86, 108].map((r) => (
        <Circle key={r} cx={18} cy={18} r={r} stroke={colors.chart.muted} strokeOpacity={0.12} strokeWidth={1} fill="none" />
      ))}
    </Svg>
  );
}

// Wspólne tło dla kafelków "pattern" (Ciekawostka, Sen) — baza + subtelne pierścienie,
// PŁASKIE tło (bez gradientu, usuniętego w redesignie 2026-10-30 — patrz komentarz
// wyżej; `accent` prop USUNIĘTY z API, nic go już tu nie używa). Szerokość wychodzi
// naturalnie z flexboxa (2 kafle flex:1 w rzędzie = dokładnie 2× szerokość kafla
// statystyk + 1 odstęp między nimi, jak w mockupie: 649 = 2×308+33) — wysokość stała,
// taka sama jak w każdym innym rzędzie Dashboardu.
export default function PatternTileBackground({
  position,
  children,
}: {
  position: StatTilePosition;
  children?: ReactNode;
}) {
  const s = makeS();
  return (
    <View style={[s.tile, cornersForPosition(position)]}>
      <ConcentricPattern />
      <View style={s.content}>{children}</View>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  tile: { flex: 1, height: TILE_ROW_HEIGHT, backgroundColor: c.bg.card, overflow: 'hidden' },
  content: { flex: 1, padding: 14, justifyContent: 'space-between' },
}));
