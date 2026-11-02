import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Row, Tile, StatTile, Cap } from '@/ui/layout';
import { C, T, S } from '@/ui/theme';
import MoodPad from '@/components/design/MoodPad';
import { todayISO } from '@/utils/date';
import { useMoodStore } from '@/store/moodStore';
import MoodModal from '@/components/mood/MoodModal';

// Faza 3.10 (design/rn kit) — Daily przebudowany na kitu's `src/ui/layout.tsx`
// prymitywy (Screen/Row/Tile/StatTile/Cap), ten sam powód co Dashboard (Faza
// 3.10, ARCHITECTURE.md): jawna siatka kolumn zamiast `flex` w rzędzie z `gap`.
// Kolejność i spany 1:1 z design/app-design.html's `#daily` (`grid-template-
// rows: auto auto auto 1fr auto`): Sen (4) → Kroki(2)|Tętno(2) →
// Waga(2)|Woda(2) → Ćwiczenia (4, fill) → Nastrój (4, row).
//
// Realne vs stub — bez zmian względem Fazy 3.3: Sen/Kroki/Tętno/Waga/Woda =
// Health Connect nieistniejący, appka NIE udaje tych danych. `StatTile`'s
// `value={null}` to WBUDOWANA obsługa DESIGN.md's "licznik bez danych → 0
// (dim) + brak" (patrz src/ui/layout.tsx) — nie trzeba tego ręcznie
// powtarzać tutaj. Sen (pełna szerokość, nie StatTile) dostaje dedykowany
// empty-state 1:1 z kitu's DashboardScreen sleep-tile ("0h 00m" dim +
// "Połącz zegarek w Ustawieniach"). Ćwiczenia = appka nie ma jeszcze store'a
// treningów, ten sam stub co wcześniej. Nastrój = JEDYNA realna sekcja
// (`useMoodStore`), bez zmian logiki — tylko nowy `Tile` z kitu.
export default function DailyScreen() {
  const entries = useMoodStore((st) => st.entries);
  const [moodOpen, setMoodOpen] = useState(false);

  const todayEntries = useMemo(() => entries.filter((e) => e.date === todayISO()), [entries]);
  const lastToday = todayEntries[todayEntries.length - 1];
  const dayLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  return (
    <Screen title="Daily" right={<Text style={T.small}>{dayLabel}</Text>}>
      <Row>
        <Tile span={4}>
          <Cap l="Sen" />
          <Text style={[T.num, st.sleepNum]}>0h 00m</Text>
          <Text style={T.small}>Połącz zegarek w Ustawieniach</Text>
        </Tile>
      </Row>

      <Row>
        <StatTile value={null} unit="z celu" label="Kroki" span={2} />
        <StatTile value={null} unit="bpm" label="Tętno" span={2} />
      </Row>

      <Row>
        <StatTile value={null} unit="kg" label="Waga" span={2} />
        <StatTile value={null} unit="litra" label="Woda" span={2} />
      </Row>

      <Row flex={1}>
        <Tile span={4}>
          <Cap l="Ćwiczenia" />
          <Text style={[T.small, st.exEmpty]}>Jeszcze nic dziś — appka nie śledzi jeszcze treningów.</Text>
        </Tile>
      </Row>

      <Row>
        <Tile span={4} onPress={() => setMoodOpen(true)} style={st.moodTile}>
          <MoodPad mood={lastToday?.mood} energy={lastToday?.energy} mini />
          <View style={st.moodTextCol}>
            <Cap l="Nastrój" r="dotknij, by zapisać" />
            <Text style={[T.rowHi]} numberOfLines={1}>
              {lastToday ? 'Zapisane dziś' : 'Jeszcze nie zapisano'}
            </Text>
          </View>
        </Tile>
      </Row>

      <MoodModal visible={moodOpen} onClose={() => setMoodOpen(false)} />
    </Screen>
  );
}

const st = StyleSheet.create({
  sleepNum: { color: C.dim, marginTop: 4 },
  exEmpty: { textAlign: 'center', marginTop: S.gap },
  moodTile: { flexDirection: 'row', alignItems: 'center', gap: S.pad },
  moodTextCol: { flex: 1, minWidth: 0 },
});
