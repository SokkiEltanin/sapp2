import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Row, Tile, Cap, StackBar, FitList } from '@/ui/layout';
import { router } from 'expo-router';
import DayPlanTagsSheet from '@/components/daily/DayPlanTagsSheet';
import { useCalendarStore } from '@/store/calendarStore';
import { useDayPlanStore } from '@/store/dayPlanStore';
import { useWorkStore } from '@/store/workStore';
import { dayPlan, daySummary } from '@/utils/dayPlan';
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
//   2. PLAN DNIA (flex) — wydarzenia z wybranych tagów + zadania na dziś,
//      "teraz"/minione wyszarzone; na dole JUTRO (od–do per tag). Tagi →
//      DayPlanTagsSheet, tap w kafel → Zadania.
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
  const [bodyOpen, setBodyOpen] = useState(false);
  const today = todayISO();

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

  // Plan dnia + jutro.
  const calEvents = useCalendarStore((st) => st.events);
  const gcalEvents = useCalendarStore((st) => st.gcalEvents);
  const calTasks = useCalendarStore((st) => st.tasks);
  const planTags = useDayPlanStore((st) => st.tags);
  // "[JD] 08:00 - 16:00" → nazwa pracodawcy z prefiksem [JD] zamiast gołego "JD".
  const employers = useWorkStore((st) => st.employers);
  const employerByTag = useMemo(() => Object.fromEntries(employers
    .filter((e) => e.workPrefix)
    .map((e) => [e.workPrefix!.replace(/[\[\]]/g, '').trim().toLowerCase(), e.name])), [employers]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const allEvents = useMemo(() => [...calEvents, ...gcalEvents], [calEvents, gcalEvents]);
  const todayPlan = useMemo(() => dayPlan(allEvents, calTasks, today, planTags), [allEvents, calTasks, today, planTags]);
  const tomorrowText = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return daySummary(dayPlan(allEvents, calTasks, keyOf(d), planTags));
  }, [allEvents, calTasks, planTags, today]);
  const nowD = new Date();
  const nowHM = `${String(nowD.getHours()).padStart(2, '0')}:${String(nowD.getMinutes()).padStart(2, '0')}`;
  const planDayLabel = nowD.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'numeric' });

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
            </>
          ) : (
            <View style={st.sleepTop}>
              <Text style={[T.numXl, { color: C.dim }]}>0h 00m</Text>
              <Text style={[T.small, st.sleepWhen]}>{connected ? 'Brak danych z dzisiejszej nocy' : 'Połącz zegarek w Ustawieniach'}</Text>
            </View>
          )}
        </Tile>
      </Row>

      {/* PLAN DNIA (2026-11-13, user: "plan lekcji / pracy na dzień, tylko z
          tagami, które chcę, i z zadaniami na ten dzień; pod spodem zapowiedź
          jutra"). Tagi wybierane w DayPlanTagsSheet ("tagi" w nagłówku). */}
      <Row flex={1}>
        <Tile span={4} onPress={() => router.push('/tasks')} style={st.planTile}>
          <Cap l={`Dziś · ${planDayLabel}`} r={planTags === null ? 'wybierz tagi' : 'tagi'} onR={() => setTagsOpen(true)} />
          <FitList
            data={todayPlan}
            minRowH={30}
            maxRowH={40}
            emptyText={planTags === null ? 'Nic na dziś' : 'Nic na dziś z wybranych tagów'}
            renderItem={(it) => {
              const past = !!it.end && it.end <= nowHM;
              const current = !!it.start && it.start <= nowHM && (!it.end || it.end > nowHM) && it.kind === 'event';
              return (
                <View style={[st.planRow, past && { opacity: 0.4 }]}>
                  <Text style={[st.planTime, current && { color: C.hi }]} numberOfLines={1}>
                    {it.allDay ? (it.kind === 'task' ? 'zadanie' : 'cały dzień') : `${it.start ?? ''}${it.end ? `–${it.end}` : ''}`}
                  </Text>
                  {it.kind === 'task'
                    ? <View style={st.taskRing} />
                    : <View style={[st.planBar, { backgroundColor: it.color || C.txt }, current && { width: 4 }]} />}
                  <Text style={[T.row, { flex: 1 }, current && { color: C.hi }]} numberOfLines={1}>{it.kind === 'event' && it.tag && it.title === it.tag ? (employerByTag[it.tag.toLowerCase()] ?? it.title) : it.title}</Text>
                  {it.tag && it.kind === 'event' && it.title !== it.tag ? <Text style={st.planTag}>{it.tag}</Text> : null}
                  {current ? <Text style={st.planNow}>teraz</Text> : null}
                </View>
              );
            }}
          />
          <View style={st.tomorrow}>
            <Text style={st.tomorrowLbl}>JUTRO</Text>
            <Text style={[T.small, { flex: 1, color: C.txt }]} numberOfLines={2}>{tomorrowText || 'wolne — nic z wybranych tagów'}</Text>
          </View>
        </Tile>
      </Row>

      <Row>
        <Tile span={2} onPress={() => setBodyOpen(true)}>
          <Cap l="Kroki" r="więcej" />
          <Text style={[T.num, stepsToday == null && { color: C.dim }]} numberOfLines={1} adjustsFontSizeToFit>{stepsToday != null ? stepsToday.toLocaleString('pl-PL') : '0'}</Text>
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

      <SleepSheet visible={sleepOpen} onClose={() => setSleepOpen(false)} />
      <BodySheet visible={bodyOpen} onClose={() => setBodyOpen(false)} />
      <MoodModal visible={moodOpen} onClose={() => setMoodOpen(false)} />
      <DayPlanTagsSheet visible={tagsOpen} onClose={() => setTagsOpen(false)} />
    </Screen>
  );
}

const st = StyleSheet.create({
  sleepTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  sleepWhen: { textAlign: 'right', marginBottom: 4 },
  phaseLegend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 8 },
  phaseItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  phaseDot: { width: 7, height: 7, borderRadius: 4 },
  phaseMin: { color: C.hi },
  planTile: { gap: 6 },
  planRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  planTime: { width: 82, fontSize: 11.5, fontFamily: 'Inter_700Bold', color: C.mut, fontVariant: ['tabular-nums'] },
  planBar: { width: 3, alignSelf: 'stretch', marginVertical: 6, borderRadius: 2 },
  taskRing: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: C.mut },
  planTag: { fontSize: 10, fontFamily: 'Inter_800ExtraBold', color: C.mut, letterSpacing: 0.5 },
  planNow: { fontSize: 9.5, fontFamily: 'Inter_900Black', color: '#000', backgroundColor: C.hi, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
  tomorrow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 },
  tomorrowLbl: { width: 82, fontSize: 10, fontFamily: 'Inter_900Black', color: C.mut, letterSpacing: 1, marginTop: 2 },
  dotEmpty: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.dim },
  stepsBars: { flexDirection: 'row', gap: 3, height: 26, marginTop: 6, alignItems: 'flex-end' },
  stepCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  stepBar: { width: '75%', borderRadius: 2, backgroundColor: C.mut },
  moodDots: { flexDirection: 'row', marginTop: 8, height: 14, alignItems: 'center' },
  moodDotCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  moodDot: { borderRadius: 7 },
  moodDotToday: { borderWidth: 1.5, borderColor: C.hi },
});
