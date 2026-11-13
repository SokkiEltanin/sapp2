import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Row, Tile, Cap, StackBar } from '@/ui/layout';
import { C, T, S } from '@/ui/theme';
import MoodPad from '@/components/design/MoodPad';
import MoodModal from '@/components/mood/MoodModal';
import SleepSheet from '@/components/health/SleepSheet';
import BodySheet from '@/components/health/BodySheet';
import Hypnogram from '@/components/health/Hypnogram';
import { moodColor, energyGlow, MOOD_LABELS, ENERGY_LABELS, roundLevel } from '@/types/mood';
import { todayISO } from '@/utils/date';
import { useMoodStore } from '@/store/moodStore';
import { useHealthStore } from '@/store/healthStore';
import { useHealthSync } from '@/hooks/useHealthSync';
import { sleepSummary, sleepWeek, vsAverage, fmtDur, PHASE_META, PHASE_COLOR, PHASE_ORDER, SLEEP_GOAL_MIN } from '@/utils/sleepStats';

// Daily (przebudowa 2026-11-13, user: "zostawiamy sen, wpisywanie humoru, kroki;
// głównie patrzę ile spałem"). Trzy rzeczy, bez scrolla:
//   1. SEN — duży kafel: czas, okno snu, porównanie z tygodniem, fazy (pasek +
//      minuty), 7 nocy. Tap → components/health/SleepSheet (hipnogram, normy faz,
//      wydajność, wybudzenia, średnie godziny, dług snu).
//   2. KROKI — dziś + 7 dni. Tap → components/health/BodySheet (waga do wpisania,
//      tętno, woda — drugorzędne, poza głównym widokiem).
//   3. HUMOR — mini pad + co zapisane + kropki ostatniego tygodnia (kolor =
//      przyjemność, wielkość = energia). Tap → MoodModal.
// USUNIĘTE (user): wykres "Ostatnie 7 dni" humoru, trening/streaki, osobne kafle
// Waga/Woda/Tętno (te w BodySheet).
const WD = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function energyText(e: number): string {
  const l = roundLevel(e);
  return l === 1 || l === 5 ? ENERGY_LABELS[l].toLowerCase() : `energia ${ENERGY_LABELS[l].toLowerCase()}`;
}

export default function DailyScreen() {
  const entries = useMoodStore((st) => st.entries);
  const health = useHealthStore((st) => st.today);
  const history = useHealthStore((st) => st.history);
  const connected = useHealthStore((st) => st.connected);
  useHealthSync();
  const [moodOpen, setMoodOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const today = todayISO();

  const dayLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  const sleep = useMemo(() => (health && health.date === today ? sleepSummary(health) : null), [health, today]);
  const week = useMemo(() => sleepWeek({ ...history, ...(health ? { [health.date]: health } : {}) }), [history, health]);
  const cmp = sleep ? vsAverage(sleep.total, week) : null;
  const maxNight = Math.max(SLEEP_GOAL_MIN, ...week.nights.map((n) => n.minutes ?? 0));

  const stepsWeek = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const k = keyOf(d);
      const snap = k === health?.date ? health : history[k];
      return { key: k, label: WD[d.getDay()], steps: snap?.steps ?? null };
    });
  }, [history, health]);
  const maxSteps = Math.max(1, ...stepsWeek.map((x) => x.steps ?? 0));
  const stepsToday = health?.date === today ? health.steps : null;

  const todayEntries = useMemo(() => entries.filter((e) => e.date === today), [entries, today]);
  const lastToday = todayEntries[todayEntries.length - 1];
  const moodWeek = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const k = keyOf(d);
      const day = entries.filter((e) => e.date === k);
      const avg = (f: (e: typeof day[number]) => number) => (day.length ? day.reduce((a, e) => a + f(e), 0) / day.length : null);
      return { key: k, label: WD[d.getDay()], mood: avg((e) => e.mood), energy: avg((e) => e.energy) };
    });
  }, [entries]);

  return (
    <Screen title="Daily" right={<Text style={T.small} numberOfLines={1}>{dayLabel}</Text>}>
      <Row flex={1}>
        <Tile span={4} onPress={() => setSleepOpen(true)} style={st.sleepTile}>
          <Cap l="Sen" r={sleep ? (cmp ?? 'szczegóły') : undefined} />
          {sleep ? (
            <>
              <View>
                <Text style={T.numXl}>{fmtDur(sleep.total)}</Text>
                <Text style={T.small}>{health!.sleepFrom} – {health!.sleepTo}{sleep.efficiency != null ? ` · wydajność ${sleep.efficiency}%` : ''}</Text>
              </View>
              {(health!.sleepStages?.length ?? 0) > 0 && health!.sleepStartMs != null && health!.sleepEndMs != null ? (
                <View>
                  <Hypnogram spans={health!.sleepStages!} start={health!.sleepStartMs} end={health!.sleepEndMs} />
                  <View style={st.phaseLegend}>
                    {sleep.phases.map((p) => (
                      <Text key={p.kind} style={T.small} numberOfLines={1}>{PHASE_META[p.kind].label} <Text style={st.phaseMin}>{fmtDur(p.min)}</Text></Text>
                    ))}
                  </View>
                </View>
              ) : sleep.hasPhases && (
                <View>
                  <StackBar height={8} legend={false} parts={PHASE_ORDER.map((k) => ({ label: PHASE_META[k].label, value: Math.max(0.001, sleep.phases.find((p) => p.kind === k)!.min), color: PHASE_COLOR[k] }))} />
                  <View style={st.phaseLegend}>
                    {sleep.phases.map((p) => (
                      <View key={p.kind} style={st.phaseItem}>
                        <View style={[st.phaseDot, { backgroundColor: PHASE_COLOR[p.kind] }]} />
                        <Text style={T.small} numberOfLines={1}>{PHASE_META[p.kind].label} <Text style={st.phaseMin}>{fmtDur(p.min)}</Text></Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          ) : (
            <View>
              <Text style={[T.numXl, { color: C.dim }]}>0h 00m</Text>
              <Text style={T.small}>{connected ? 'Brak danych z dzisiejszej nocy' : 'Połącz zegarek w Ustawieniach'}</Text>
            </View>
          )}
          {week.count > 0 && (
            <View style={st.nights}>
              {week.nights.map((n, i) => (
                <View key={n.date} style={st.nightCol}>
                  <View style={st.nightBox}>
                    <View style={[st.goalLine, { bottom: `${(SLEEP_GOAL_MIN / maxNight) * 100}%` }]} />
                    {n.minutes != null
                      ? <View style={[st.nightBar, { height: `${(n.minutes / maxNight) * 100}%` }, i === 6 && { backgroundColor: PHASE_COLOR.rem }]} />
                      : <View style={st.dotEmpty} />}
                  </View>
                  <Text style={[st.dayLbl, i === 6 && { color: C.hi }]}>{WD[new Date(`${n.date}T12:00:00`).getDay()]}</Text>
                </View>
              ))}
            </View>
          )}
        </Tile>
      </Row>

      <Row>
        <Tile span={4} onPress={() => setBodyOpen(true)} style={st.stepsTile}>
          <View style={{ flex: 1 }}>
            <Cap l="Kroki" r="waga i więcej" />
            <Text style={[T.num, stepsToday == null && { color: C.dim }]}>{stepsToday != null ? stepsToday.toLocaleString('pl-PL') : '0'}</Text>
            <Text style={T.small}>{stepsToday != null ? 'dziś' : 'brak danych'}</Text>
          </View>
          <View style={st.stepsBars}>
            {stepsWeek.map((x, i) => (
              <View key={x.key} style={st.stepCol}>
                <View style={st.stepBox}>
                  {x.steps != null
                    ? <View style={[st.stepBar, { height: `${Math.max(6, (x.steps / maxSteps) * 100)}%` }, i === 6 && { backgroundColor: C.hi }]} />
                    : <View style={st.dotEmpty} />}
                </View>
                <Text style={[st.dayLbl, i === 6 && { color: C.hi }]}>{x.label}</Text>
              </View>
            ))}
          </View>
        </Tile>
      </Row>

      <Row>
        <Tile span={4} onPress={() => setMoodOpen(true)} style={st.moodTile}>
          <MoodPad mood={lastToday?.mood} energy={lastToday?.energy} mini />
          <View style={st.moodTextCol}>
            <Cap l="Humor" r="dotknij, by zapisać" />
            <Text style={[T.rowHi, lastToday && { color: moodColor(lastToday.mood) }]} numberOfLines={1}>
              {lastToday ? `${MOOD_LABELS[roundLevel(lastToday.mood)]} · ${energyText(lastToday.energy)}` : 'Jeszcze nie zapisano'}
            </Text>
            <View style={st.moodDots}>
              {moodWeek.map((d, i) => (
                <View key={d.key} style={st.moodDotCol}>
                  <View style={st.moodDotBox}>
                    {d.mood != null && d.energy != null
                      ? <View style={[st.moodDot, { backgroundColor: moodColor(d.mood), width: 7 + energyGlow(d.energy) * 9, height: 7 + energyGlow(d.energy) * 9 }]} />
                      : <View style={st.dotEmpty} />}
                  </View>
                  <Text style={[st.dayLbl, i === 6 && { color: C.hi }]}>{d.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </Tile>
      </Row>

      <SleepSheet visible={sleepOpen} onClose={() => setSleepOpen(false)} />
      <BodySheet visible={bodyOpen} onClose={() => setBodyOpen(false)} />
      <MoodModal visible={moodOpen} onClose={() => setMoodOpen(false)} />
    </Screen>
  );
}

const st = StyleSheet.create({
  sleepTile: { justifyContent: 'space-between', gap: S.gap },
  phaseLegend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 8 },
  phaseItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  phaseDot: { width: 7, height: 7, borderRadius: 4 },
  phaseMin: { color: C.hi },
  nights: { flexDirection: 'row', gap: 6, height: 64 },
  nightCol: { flex: 1, alignItems: 'center', gap: 3 },
  nightBox: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  nightBar: { width: '60%', borderRadius: 3, backgroundColor: PHASE_COLOR.light, minHeight: 3 },
  goalLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: C.dim },
  dayLbl: { fontSize: 9.5, color: C.mut, fontFamily: 'Inter_700Bold' },
  dotEmpty: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.dim },
  stepsTile: { flexDirection: 'row', alignItems: 'stretch', gap: S.pad },
  stepsBars: { flex: 1.1, flexDirection: 'row', gap: 4, minHeight: 64 },
  stepCol: { flex: 1, alignItems: 'center', gap: 3 },
  stepBox: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  stepBar: { width: '70%', borderRadius: 3, backgroundColor: C.mut },
  moodTile: { flexDirection: 'row', alignItems: 'center', gap: S.pad },
  moodTextCol: { flex: 1, minWidth: 0 },
  moodDots: { flexDirection: 'row', marginTop: 8 },
  moodDotCol: { flex: 1, alignItems: 'center', gap: 2 },
  moodDotBox: { height: 18, justifyContent: 'center', alignItems: 'center' },
  moodDot: { borderRadius: 9 },
});
