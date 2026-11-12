import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Screen, Row, Tile, StatTile, Cap } from '@/ui/layout';
import { C, T, S } from '@/ui/theme';
import MoodPad from '@/components/design/MoodPad';
import { moodColor, energyGlow, MOOD_LABELS, ENERGY_LABELS, roundLevel } from '@/types/mood';
import { todayISO } from '@/utils/date';
import { useMoodStore } from '@/store/moodStore';
import { useHealthStore } from '@/store/healthStore';
import { useHealthSync } from '@/hooks/useHealthSync';
import MoodModal from '@/components/mood/MoodModal';
import { useHabitsStore } from '@/store/habitsStore';
import { habitStreak } from '@/utils/habitStreak';
import HabitsModal from '@/components/dashboard/HabitsModal';

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
// "bez energii" / "energia niska…dobra" / "pełna energia" — czyta się jak zdanie.
function energyText(e: number): string {
  const l = roundLevel(e);
  return l === 1 || l === 5 ? ENERGY_LABELS[l].toLowerCase() : `energia ${ENERGY_LABELS[l].toLowerCase()}`;
}

function fmtMin(m: number): string {
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export default function DailyScreen() {
  const entries = useMoodStore((st) => st.entries);
  const [moodOpen, setMoodOpen] = useState(false);
  const health = useHealthStore((st) => st.today);
  useHealthSync();

  // 2026-11-09, user: "wywalimy streaki" (z Dashboardu) — odhaczanie nawyków
  // (Woda/Słodycze/Trening, `habitsStore.ts`) przeniesione tu, żeby nie
  // zostawić dead-endu (`HabitsModal` z `components/dashboard/` — nazwa
  // folderu to tylko historia, komponent nie jest dashboard-specyficzny).
  const habitDays = useHabitsStore((st) => st.days);
  const today = todayISO();
  const [habitsOpen, setHabitsOpen] = useState(false);
  const streaks = useMemo(() => ({
    water: habitStreak(habitDays, 'water', today),
    sweets: habitStreak(habitDays, 'sweets', today),
    training: habitStreak(habitDays, 'training', today),
  }), [habitDays, today]);

  const todayEntries = useMemo(() => entries.filter((e) => e.date === todayISO()), [entries]);
  // Ostatnie 7 dni nastroju (2026-11-12, CLAUDE.md zasada 10 — zamiast pustego
  // "appka nie śledzi treningów"): średnia z wpisów dnia, kolor = przyjemność,
  // wysokość słupka = energia (ta sama semantyka co MoodPad).
  const week = useMemo(() => {
    const out: { key: string; label: string; mood: number | null; energy: number | null }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const day = entries.filter((e) => e.date === key);
      const avg = (f: (e: typeof day[number]) => number) => (day.length ? day.reduce((a, e) => a + f(e), 0) / day.length : null);
      out.push({ key, label: ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'][d.getDay()], mood: avg((e) => e.mood), energy: avg((e) => e.energy) });
    }
    return out;
  }, [entries]);
  const weekHasMood = week.some((d) => d.mood != null);
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
        <Tile span={4} style={st.exTile}>
          <Cap l="Ostatnie 7 dni" r={weekHasMood ? 'nastrój · wysokość = energia' : undefined} />
          {weekHasMood ? (
            <TouchableOpacity style={st.week} onPress={() => setMoodOpen(true)} activeOpacity={0.8}>
              {week.map((d) => (
                <View key={d.key} style={st.weekCol}>
                  <View style={st.weekBarBox}>
                    {d.mood != null && d.energy != null ? (
                      <View style={[st.weekBar, { height: `${18 + energyGlow(d.energy) * 82}%`, backgroundColor: moodColor(d.mood) }]} />
                    ) : (
                      <View style={st.weekEmpty} />
                    )}
                  </View>
                  <Text style={[T.small, d.key === today && { color: C.hi }]}>{d.label}</Text>
                </View>
              ))}
            </TouchableOpacity>
          ) : (
            <Text style={[T.small, st.exEmpty]}>Zapisuj nastrój — tu zobaczysz cały tydzień.</Text>
          )}
          {/* 2026-11-09 — odhaczanie nawyków (Woda/Słodycze/Trening, dawniej 3
              kafle streak na Dashboardzie, USUNIĘTE stamtąd) przeniesione tu, w
              TEN SAM, już luźny `flex:1` rząd — osobny `TouchableOpacity`
              (nie `Tile`'s własny `onPress`, żeby tap na "Ćwiczenia" wyżej nie
              otwierał modala o zupełnie innym temacie). */}
          <TouchableOpacity style={st.habitsRow} onPress={() => setHabitsOpen(true)} activeOpacity={0.7}>
            <Cap l="Nawyki" r="dotknij, by odhaczyć" />
            <View style={st.habitsCols}>
              <View style={st.habitsCol}>
                <Text style={T.num}>{streaks.water ?? '—'}</Text>
                <Text style={T.small}>Woda</Text>
              </View>
              <View style={st.habitsCol}>
                <Text style={T.num}>{streaks.sweets ?? '—'}</Text>
                <Text style={T.small}>Słodycze</Text>
              </View>
              <View style={st.habitsCol}>
                <Text style={T.num}>{streaks.training ?? '—'}</Text>
                <Text style={T.small}>Trening</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Tile>
      </Row>

      <Row>
        <Tile span={4} onPress={() => setMoodOpen(true)} style={st.moodTile}>
          <MoodPad mood={lastToday?.mood} energy={lastToday?.energy} mini />
          <View style={st.moodTextCol}>
            <Cap l="Nastrój" r="dotknij, by zapisać" />
            <Text style={[T.rowHi, lastToday && { color: moodColor(lastToday.mood) }]} numberOfLines={1}>
              {lastToday ? `${MOOD_LABELS[roundLevel(lastToday.mood)]} · ${energyText(lastToday.energy)}` : 'Jeszcze nie zapisano'}
            </Text>
            {todayEntries.length > 1 && <Text style={T.rowSub}>{todayEntries.length}× dziś</Text>}
          </View>
        </Tile>
      </Row>

      <MoodModal visible={moodOpen} onClose={() => setMoodOpen(false)} />
      <HabitsModal visible={habitsOpen} onClose={() => setHabitsOpen(false)} />
    </Screen>
  );
}

const st = StyleSheet.create({
  sleepNum: { color: C.dim, marginTop: 4 },
  exTile: { justifyContent: 'space-between' },
  exEmpty: { textAlign: 'center', marginTop: S.gap },
  habitsRow: { marginTop: S.gap },
  week: { flex: 1, flexDirection: 'row', gap: 6, marginTop: S.gap, minHeight: 70 },
  weekCol: { flex: 1, alignItems: 'center', gap: 4 },
  weekBarBox: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  weekBar: { width: '70%', borderRadius: 4, minHeight: 6 },
  weekEmpty: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.dim },
  habitsCols: { flexDirection: 'row', justifyContent: 'space-around', marginTop: S.gap },
  habitsCol: { alignItems: 'center' },
  moodTile: { flexDirection: 'row', alignItems: 'center', gap: S.pad },
  moodTextCol: { flex: 1, minWidth: 0 },
});
