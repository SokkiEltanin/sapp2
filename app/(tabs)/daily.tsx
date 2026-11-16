import FitText from '@/ui/FitText';
import { useMemo, useState } from 'react';
import LazyMount from '@/components/design/LazyMount';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Screen, Row, Tile, Cap, StackBar, FitList } from '@/ui/layout';
import { router } from 'expo-router';
import MonthPaceSheet, { MonthPaceRows, windowLabel } from '@/components/daily/MonthPace';
import { useExpensesStore } from '@/store/expensesStore';
import { FACTS, factOfDay } from '@/utils/facts';
import { haptic } from '@/utils/haptics';
import { Lightbulb } from 'lucide-react-native';
import { C, T, S } from '@/ui/theme';
import MoodModal from '@/components/mood/MoodModal';
import SleepSheet from '@/components/health/SleepSheet';
import BodySheet from '@/components/health/BodySheet';
import { moodColor, energyGlow, MOOD_LABELS, ENERGY_LABELS, roundLevel } from '@/types/mood';
import { todayISO } from '@/utils/date';
import { useMoodStore } from '@/store/moodStore';
import { useHealthStore } from '@/store/healthStore';
import { useHealthSync } from '@/hooks/useHealthSync';
import { sleepSummary, sleepWeek, vsAverage, fmtDur, PHASE_META, PHASE_COLOR, PHASE_ORDER } from '@/utils/sleepStats';

// Daily (przebudowa 2026-11-13, user: "zostawiamy sen, humor, kroki; głównie
// patrzę ile spałem" + "plan lekcji / pracy na dzień z wybranymi tagami i
// zadaniami, pod spodem zapowiedź jutra"). Bez scrolla:
//   1. SEN — kompaktowo: czas, okno, wydajność, fazy. Tap → SleepSheet
//      (hipnogram, normy faz, 7 nocy, średnie godziny, dług snu).
//   2. CIEKAWOSTKA (flex, od 2026-11-16 zamiast planu dnia) + MIESIĄC DO DZIŚ.
//   3. KROKI (tap → BodySheet: waga, tętno, woda) | HUMOR (kropki tygodnia).
// USUNIĘTE (user): wykres 7 dni humoru, trening/streaki, kafle Waga/Woda/Tętno,
// podsumowanie dnia i "zależności sen↔humor" (świadomie odrzucone).
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
  const [paceOpen, setPaceOpen] = useState(false);
  const [factIdx, setFactIdx] = useState(() => factOfDay(new Date()));
  const expenses = useExpensesStore((st) => st.expenses);
  const [bodyOpen, setBodyOpen] = useState(false);
  const today = todayISO();
  // Okno "1–N" liczone raz na dzień (nie przy każdym renderze).
  const paceNow = useMemo(() => new Date(), [today]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  const sleep = useMemo(() => (health && health.date === today ? sleepSummary(health) : null), [health, today]);
  const week = useMemo(() => sleepWeek({ ...history, ...(health ? { [health.date]: health } : {}) }), [history, health]);
  const cmp = sleep ? vsAverage(sleep.total, week) : null;

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
      {/* SEN — kompaktowo (szczegóły, hipnogram i 7 nocy w SleepSheet). */}
      <Row>
        <Tile span={4} onPress={() => setSleepOpen(true)}>
          <Cap l="Sen" r={sleep ? (cmp ?? 'szczegóły') : undefined} />
          {sleep ? (
            <>
              <View style={st.sleepTop}>
                <Text style={T.numXl}>{fmtDur(sleep.total)}</Text>
                <Text style={[T.small, st.sleepWhen]} numberOfLines={2}>{health!.sleepFrom} – {health!.sleepTo}{sleep.efficiency != null ? `\nwydajność ${sleep.efficiency}%` : ''}</Text>
              </View>
              {sleep.hasPhases && (
                <View style={{ marginTop: 8 }}>
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
              {!sleep.hasPhases && (
                <Text style={[T.small, { marginTop: 6 }]} numberOfLines={2}>
                  Bez faz snu — zegarek jeszcze ich nie przesłał do Health Connect{Platform.OS === 'web' ? ' (komputer pokazuje to, co telefon wysłał ostatnio)' : ''}.
                </Text>
              )}
            </>
          ) : (
            <View style={st.sleepTop}>
              <Text style={[T.numXl, { color: C.dim }]}>0h 00m</Text>
              <Text style={[T.small, st.sleepWhen]}>{connected ? 'Brak danych z dzisiejszej nocy' : 'Połącz zegarek w Ustawieniach'}</Text>
            </View>
          )}
        </Tile>
      </Row>

      {/* CIEKAWOSTKA (2026-11-16, user: "ciekawostkę przeniesiemy zamiast DZIŚ —
          tej górnej części"): plan dnia był dublem "Najbliższych eventów" z
          Dashboardu; na Dashboardzie w miejscu ciekawostki są baterie. Tap = następna. */}
      <Row flex={1}>
        <Tile span={4} onPress={() => { haptic.tap(); setFactIdx((i) => (i + 1) % FACTS.length); }} style={st.factTile}>
          <Cap l="Ciekawostka" r={`${factIdx + 1}/${FACTS.length}`} />
          <View style={st.factBody}>
            <Lightbulb size={22} color={C.mut} />
            <FitText style={st.factText} numberOfLines={6} minimumFontScale={0.7}>{FACTS[factIdx]}</FitText>
          </View>
          <Text style={T.small}>dotknij, by zobaczyć następną</Text>
        </Tile>
      </Row>

      {/* MIESIĄC DO DZIŚ (2026-11-16, user: "duży kafelek podzielić... progress miesiąca,
          porównuje pierwsze dni ostatnich miesięcy do pierwszych dni tego... prąd").
          components/daily/MonthPace.tsx, logika utils/monthPace.ts. */}
      <Row>
        <Tile span={4} onPress={() => setPaceOpen(true)}>
          <Cap l={`Miesiąc · ${windowLabel(paceNow)}`} r="vs te same dni" />
          <MonthPaceRows expenses={expenses} now={paceNow} />
        </Tile>
      </Row>

      <Row>
        <Tile span={2} onPress={() => setBodyOpen(true)}>
          <Cap l="Kroki" r="więcej" />
          <FitText style={[T.num, stepsToday == null && { color: C.dim }]} numberOfLines={1}>{stepsToday != null ? stepsToday.toLocaleString('pl-PL') : '0'}</FitText>
          <View style={st.stepsBars}>
            {stepsWeek.map((x, i) => (
              <View key={x.key} style={st.stepCol}>
                {x.steps != null
                  ? <View style={[st.stepBar, { height: `${Math.max(8, (x.steps / maxSteps) * 100)}%` }, i === 6 && { backgroundColor: C.hi }]} />
                  : <View style={st.dotEmpty} />}
              </View>
            ))}
          </View>
        </Tile>
        <Tile span={2} onPress={() => setMoodOpen(true)}>
          <Cap l="Humor" r="+" />
          <Text style={[T.rowHi, lastToday && { color: moodColor(lastToday.mood) }]} numberOfLines={1}>
            {lastToday ? MOOD_LABELS[roundLevel(lastToday.mood)] : 'nie zapisano'}
          </Text>
          <Text style={T.small} numberOfLines={1}>{lastToday ? energyText(lastToday.energy) : 'dotknij, by zapisać'}</Text>
          <View style={st.moodDots}>
            {moodWeek.map((d, i) => (
              <View key={d.key} style={st.moodDotCol}>
                {d.mood != null && d.energy != null
                  ? <View style={[st.moodDot, { backgroundColor: moodColor(d.mood), width: 6 + energyGlow(d.energy) * 7, height: 6 + energyGlow(d.energy) * 7 }, i === 6 && st.moodDotToday]} />
                  : <View style={st.dotEmpty} />}
              </View>
            ))}
          </View>
        </Tile>
      </Row>

      <LazyMount visible={paceOpen}>
        <MonthPaceSheet visible={paceOpen} onClose={() => setPaceOpen(false)} expenses={expenses} />
      </LazyMount>
      <LazyMount visible={sleepOpen}>
        <SleepSheet visible={sleepOpen} onClose={() => setSleepOpen(false)} />
      </LazyMount>
      <LazyMount visible={bodyOpen}>
        <BodySheet visible={bodyOpen} onClose={() => setBodyOpen(false)} />
      </LazyMount>
      <LazyMount visible={moodOpen}>
        <MoodModal visible={moodOpen} onClose={() => setMoodOpen(false)} />
      </LazyMount>
    </Screen>
  );
}

const st = StyleSheet.create({
  factTile: { gap: 8 },
  factBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4 },
  factText: { flex: 1, fontSize: 20, lineHeight: 28, fontFamily: 'Inter_800ExtraBold', color: C.hi },
  sleepTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  sleepWhen: { textAlign: 'right', marginBottom: 4 },
  phaseLegend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 8 },
  phaseItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  phaseDot: { width: 7, height: 7, borderRadius: 4 },
  phaseMin: { color: C.hi },
  dotEmpty: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.dim },
  stepsBars: { flexDirection: 'row', gap: 3, height: 26, marginTop: 6, alignItems: 'flex-end' },
  stepCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  stepBar: { width: '75%', borderRadius: 2, backgroundColor: C.mut },
  moodDots: { flexDirection: 'row', marginTop: 8, height: 14, alignItems: 'center' },
  moodDotCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  moodDot: { borderRadius: 7 },
  moodDotToday: { borderWidth: 1.5, borderColor: C.hi },
});
