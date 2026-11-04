import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Row, Tile, StatTile, Cap } from '@/ui/layout';
import { C, T, S } from '@/ui/theme';
import MoodPad from '@/components/design/MoodPad';
import { todayISO } from '@/utils/date';
import { useMoodStore } from '@/store/moodStore';
import { useHealthStore } from '@/store/healthStore';
import { useHealthSync } from '@/hooks/useHealthSync';
import MoodModal from '@/components/mood/MoodModal';

// Faza 3.10 (design/rn kit) — Daily przebudowany na kitu's `src/ui/layout.tsx`
// prymitywy (Screen/Row/Tile/StatTile/Cap), ten sam powód co Dashboard (Faza
// 3.10, ARCHITECTURE.md): jawna siatka kolumn zamiast `flex` w rzędzie z `gap`.
// Kolejność i spany 1:1 z design/app-design.html's `#daily` (`grid-template-
// rows: auto auto auto 1fr auto`): Sen (4) → Kroki(2)|Tętno(2) →
// Waga(2)|Woda(2) → Ćwiczenia (4, fill) → Nastrój (4, row).
//
// Faza 3.12 (2026-11-02) — Sen/Kroki/Tętno/Waga/Woda DOSTAŁY realny Health
// Connect (port z sapp, `src/services/healthConnectService.ts`). Bez zegarka/
// bez zgody (`useHealthStore().today === null`) → `StatTile value={null}`
// (DESIGN.md's zaprojektowany stan pusty, "0" dim + "brak") i Sen zostaje przy
// "0h 00m" + "Połącz zegarek w Ustawieniach" — DOKŁADNIE jak wcześniej, zero
// zmiany wizualnej dla usera bez zegarka. Ćwiczenia = appka nie ma jeszcze
// store'a treningów (osobna, nieportowalna z sapp 1:1 funkcja — inny model
// danych), ten sam stub co wcześniej. Nastrój = `useMoodStore`, bez zmian.
function fmtMin(m: number): string {
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export default function DailyScreen() {
  const entries = useMoodStore((st) => st.entries);
  const [moodOpen, setMoodOpen] = useState(false);
  const health = useHealthStore((st) => st.today);
  useHealthSync();

  const todayEntries = useMemo(() => entries.filter((e) => e.date === todayISO()), [entries]);
  const lastToday = todayEntries[todayEntries.length - 1];
  const dayLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  const hasSleep = !!health && health.sleepMinutes != null && !!health.sleepFrom && !!health.sleepTo;
  const weightVal = health?.weightKg != null ? health.weightKg.toFixed(1).replace('.', ',') : null;
  const hydrationVal = health?.hydrationMl != null ? (health.hydrationMl / 1000).toFixed(1).replace('.', ',') : null;

  return (
    <Screen title="Daily" right={<Text style={T.small} numberOfLines={1}>{dayLabel}</Text>}>
      <Row>
        <Tile span={4}>
          <Cap l="Sen" />
          {hasSleep ? (
            <>
              <Text style={T.num}>{fmtMin(health!.sleepMinutes!)}</Text>
              <Text style={T.small}>{health!.sleepFrom} – {health!.sleepTo}</Text>
            </>
          ) : (
            <>
              <Text style={[T.num, st.sleepNum]}>0h 00m</Text>
              <Text style={T.small}>Połącz zegarek w Ustawieniach</Text>
            </>
          )}
        </Tile>
      </Row>

      <Row>
        <StatTile value={health?.steps ?? null} unit="kroki" label="Kroki" span={2} />
        <StatTile value={health?.restingHeartRate ?? null} unit="bpm" label="Tętno" span={2} />
      </Row>

      <Row>
        <StatTile value={weightVal} unit="kg" label="Waga" span={2} />
        <StatTile value={hydrationVal} unit="litra" label="Woda" span={2} />
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
