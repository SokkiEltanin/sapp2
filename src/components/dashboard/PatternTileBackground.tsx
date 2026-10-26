import { View, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { themedStyles } from '@/theme';
import { cornersForPosition, TILE_ROW_HEIGHT, type StatTilePosition } from './tilePosition';

// Przybliżenie "concentric pattern" z mockupu (2026-10-26, kafelki Ciekawostka/Sen) —
// dokładne parametry (liczba pierścieni, odstępy) nie były podane, tylko "Concentric
// p... 20%" w panelu warstw Figmy. Do doprecyzowania na urządzeniu, gdy user zobaczy jak
// wygląda to przybliżenie.
function ConcentricPattern({ accent }: { accent: string }) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 220 160"
      preserveAspectRatio="xMidYMid slice"
      style={StyleSheet.absoluteFillObject}
    >
      {[20, 42, 64, 86, 108].map((r) => (
        <Circle key={r} cx={18} cy={18} r={r} stroke={accent} strokeOpacity={0.15} strokeWidth={1} fill="none" />
      ))}
    </Svg>
  );
}

// Wspólne tło dla kafelków "pattern" (Ciekawostka, Sen) — baza + pierścienie + gradient
// PO SKOSIE (róg-do-rogu, nie pionowy jak w StatTile). Szerokość wychodzi naturalnie z
// flexboxa (2 kafle flex:1 w rzędzie = dokładnie 2× szerokość kafla statystyk + 1 odstęp
// między nimi, jak w mockupie: 649 = 2×308+33) — wysokość stała, taka sama jak w każdym
// innym rzędzie Dashboardu.
export default function PatternTileBackground({
  position,
  accent,
  children,
}: {
  position: StatTilePosition;
  accent: string;
  children?: ReactNode;
}) {
  const s = makeS();
  return (
    <View style={[s.tile, cornersForPosition(position)]}>
      <ConcentricPattern accent={accent} />
      <LinearGradient
        colors={['#000000', accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.gradient}
      />
      <View style={s.content}>{children}</View>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  tile: { flex: 1, height: TILE_ROW_HEIGHT, backgroundColor: c.bg.card, overflow: 'hidden' },
  gradient: { ...StyleSheet.absoluteFillObject, opacity: 0.2 },
  content: { flex: 1, padding: 14, justifyContent: 'space-between' },
}));
