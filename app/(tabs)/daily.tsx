import FitText from '@/ui/FitText';
import { useEffect, useMemo, useState } from 'react';
import LazyMount from '@/components/design/LazyMount';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Pressable } from 'react-native';
import { Screen, Row, Tile, Cap, StackBar, FitList } from '@/ui/layout';
import { router, useLocalSearchParams } from 'expo-router';
import MonthPaceSheet, { MonthPaceRows, windowLabel } from '@/components/daily/MonthPace';
import { useExpensesStore } from '@/store/expensesStore';
import { FACT_BY_ID, CAT_LABEL } from '@/utils/facts';
import { FACT_LIST } from '@/utils/factsData';
import { useFactsStore } from '@/store/factsStore';
import FactSheet from '@/components/daily/FactSheet';
import FactIcon from '@/components/daily/FactIcon';
import CollectionSheet, { useCollectionData } from '@/components/daily/CollectionSheet';
import { useCollectionStore } from '@/store/collectionStore';
import { haptic } from '@/utils/haptics';
import { Check, BarChart3 } from 'lucide-react-native';
import { C, T, S, R } from '@/ui/theme';
import MoodModal from '@/components/mood/MoodModal';
import MoodStatsSheet from '@/components/mood/MoodStatsSheet';
import GoodThingSheet from '@/components/mood/GoodThingSheet';


import { useConfirmTap } from '@/hooks/useConfirmTap';
import SleepSheet from '@/components/health/SleepSheet';
import BodySheet from '@/components/health/BodySheet';
import { moodColor, energyGlow, MOOD_LABELS, ENERGY_LABELS, MOOD_COLORS, roundLevel } from '@/types/mood';
import { moodStreak } from '@/utils/moodReminder';
import { addQuickMood } from '@/services/moodReminders';
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
  // Stuknięcie w przypomnienie o humorze → Daily z otwartym wpisem (hooks/useNotifeeAlertLaunch.ts).
  const { mood: moodParam, good: goodParam } = useLocalSearchParams<{ mood?: string; good?: string }>();
  useEffect(() => { if (moodParam) setMoodOpen(true); }, [moodParam]);
  // Jedna dobra rzecz z dnia (2026-11-22): wpis w MoodModal; `good` z wyszukiwarki / statystyk
  // humoru = edycja wpisu z tego dnia (GoodThingSheet).
  const [good, setGood] = useState<{ open: boolean; date: string | null }>({ open: false, date: null });
  useEffect(() => { if (goodParam) setGood({ open: true, date: goodParam }); }, [goodParam]);


  const [moodStatsOpen, setMoodStatsOpen] = useState(false);
  const [knowArmed, knowTap] = useConfirmTap();
  const [sleepOpen, setSleepOpen] = useState(false);
  const [paceOpen, setPaceOpen] = useState(false);
  const [factOpen, setFactOpen] = useState(false);
  // Kolekcja: karty miesięcy + rekordy (2026-11-17). Nowa karta (zakończony miesiąc)
  // otwiera się sama raz — 1. dnia albo przy pierwszym wejściu po końcu miesiąca.
  const [coll, setColl] = useState<{ open: boolean; highlight: string | null }>({ open: false, highlight: null });
  const { cards: monthCards } = useCollectionData();
  const latestCard = monthCards[0]?.key ?? null;
  useEffect(() => {
    if (!latestCard) return;
    const go = () => { if (latestCard > (useCollectionStore.getState().cardsSeen ?? '')) setColl({ open: true, highlight: latestCard }); };
    if (useCollectionStore.persist.hasHydrated()) go();
    return useCollectionStore.persist.onFinishHydration(go);
  }, [latestCard]);
  const closeColl = () => { if (coll.highlight) useCollectionStore.getState().markSeen(coll.highlight); setColl({ open: false, highlight: null }); };
  const fact = useFactsStore((st) => (st.cur ? FACT_BY_ID[st.cur.id] ?? null : null));
  const factSeen = useFactsStore((st) => st.seen.length);
  const expenses = useExpensesStore((st) => st.expenses);
  const [bodyOpen, setBodyOpen] = useState(false);
  const today = todayISO();
  // Okno "1–N" liczone raz na dzień (nie przy każdym renderze).
  const paceNow = useMemo(() => new Date(), [today]); // eslint-disable-line react-hooks/exhaustive-deps
  // Ciekawostka dnia — dopiero po wczytaniu stanu z pamięci (inaczej wylosowałaby od zera).
  useEffect(() => {
    const go = () => useFactsStore.getState().ensureDay(today);
    if (useFactsStore.persist.hasHydrated()) go();
    return useFactsStore.persist.onFinishHydration(go);
  }, [today]);

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
  const moodSeries = useMemo(() => moodStreak(entries), [entries, today]); // eslint-disable-line react-hooks/exhaustive-deps
  // wieczorem bez wpisu kafel lekko się wyróżnia (2026-11-18)
  const moodEvening = !lastToday && new Date().getHours() >= 18;

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

      {/* CIEKAWOSTKA (2026-11-16; 2.0: "temat max 3 słowa, treść zachęcająca jako skrót,
          po kliknięciu rozszerzone info", "znam to", "każda tylko raz", ta sama na tel i komp).
          Jedna na dzień — utils/facts.ts + store/factsStore.ts; tap → FactSheet. */}
      <Row flex={1}>
        <Tile span={4} onPress={() => { haptic.tap(); setFactOpen(true); }} style={st.factTile}>
          <Cap l={fact ? `Ciekawostka · ${CAT_LABEL[fact.cat]}` : 'Ciekawostka'} r={`${factSeen}/${FACT_LIST.length}`} />
          <View style={st.factBody}>
            <View style={st.factHead}>
              {fact && <FactIcon cat={fact.cat} px={3} />}
              <FitText style={[st.factTopic, { flex: 1 }]} numberOfLines={2} minimumFontScale={0.7}>{fact ? fact.topic : 'Wszystko przeczytane'}</FitText>
            </View>
            <Text style={st.factTeaser} numberOfLines={5}>{fact ? fact.teaser : 'Dotknij, żeby wybrać inne dziedziny albo zacząć od nowa.'}</Text>
          </View>
          <View style={st.factFoot}>
            <Text style={[T.small, { flex: 1 }]}>{fact ? 'dotknij, by czytać dalej' : ''}</Text>
            {fact && (
              <TouchableOpacity onPress={() => { haptic.tap(); knowTap(() => useFactsStore.getState().knowIt(today)); }} style={[st.factKnow, knowArmed && st.factKnowArmed]} hitSlop={8} accessibilityLabel={knowArmed ? 'Na pewno? Stuknij jeszcze raz' : 'Znam to — pokaż następną'}>
                <Check size={13} color={knowArmed ? C.hi : C.mut} />
                <Text style={[st.factKnowTxt, knowArmed && { color: C.hi }]}>{knowArmed ? 'Na pewno? Stuknij' : 'Znam to'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Tile>
      </Row>

      {/* MIESIĄC DO DZIŚ (2026-11-16, user: "duży kafelek podzielić... progress miesiąca,
          porównuje pierwsze dni ostatnich miesięcy do pierwszych dni tego... prąd").
          components/daily/MonthPace.tsx, logika utils/monthPace.ts. */}
      <Row>
        <Tile span={4} onPress={() => setPaceOpen(true)}>
          <Cap l={`Miesiąc · ${windowLabel(paceNow)}`} r={`karty ${monthCards.length} · rekordy ›`} onR={() => { haptic.tap(); setColl({ open: true, highlight: null }); }} />
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
        <Tile span={2} onPress={() => setMoodOpen(true)} style={moodEvening ? st.moodEvening : undefined}>
          {/* Mini przycisk → zakładka humoru (2026-11-18): średnia, rok w pikselach, zależności.
              Reszta kafla dalej = zapisz humor. */}
          <View style={st.moodCap}>
            <Text style={T.cap} numberOfLines={1}>Humor</Text>
            <Pressable style={st.moodStatsBtn} hitSlop={10} onPress={() => { haptic.tap(); setMoodStatsOpen(true); }} accessibilityLabel="Statystyki humoru">
              <BarChart3 size={13} color={C.txt} />
            </Pressable>
          </View>
          {lastToday ? (
            <>
              <Text style={[T.rowHi, { color: moodColor(lastToday.mood) }]} numberOfLines={1}>{MOOD_LABELS[roundLevel(lastToday.mood)]}</Text>
              <Text style={T.small} numberOfLines={1}>{energyText(lastToday.energy)}{moodSeries.days >= 2 ? ` · seria ${moodSeries.days} dni` : ''}</Text>
              <View style={st.moodDots}>
                {moodWeek.map((d, i) => (
                  <View key={d.key} style={st.moodDotCol}>
                    {d.mood != null && d.energy != null
                      ? <View style={[st.moodDot, { backgroundColor: moodColor(d.mood), width: 6 + energyGlow(d.energy) * 7, height: 6 + energyGlow(d.energy) * 7 }, i === 6 && st.moodDotToday]} />
                      : <View style={st.dotEmpty} />}
                  </View>
                ))}
              </View>
            </>
          ) : (
            // Brak wpisu (2026-11-18, user: "zachęcić do wpisu humoru"): 5 kolorów = jedno
            // stuknięcie zapisuje humor (energia średnia); szczegóły dalej po stuknięciu kafla.
            <>
              <Text style={T.rowHi} numberOfLines={1}>Jak minął dzień?</Text>
              <Text style={T.small} numberOfLines={1}>{moodSeries.days >= 1 ? `seria ${moodSeries.days} dni — nie przerwij` : 'stuknij kolor'}</Text>
              <View style={st.moodQuick}>
                {([1, 2, 3, 4, 5] as const).map((l) => (
                  <Pressable key={l} hitSlop={6} onPress={() => { haptic.success(); addQuickMood(l); }} accessibilityLabel={`Humor: ${MOOD_LABELS[l]}`}
                    style={({ pressed }) => [st.moodQuickDot, { backgroundColor: MOOD_COLORS[l] }, pressed && { transform: [{ scale: 0.85 }] }]} />
                ))}
              </View>
            </>
          )}
        </Tile>
      </Row>

      <LazyMount visible={good.open}>
        <GoodThingSheet visible={good.open} date={good.date} onClose={() => setGood({ open: false, date: null })} />
      </LazyMount>
      <LazyMount visible={coll.open}>
        <CollectionSheet visible={coll.open} onClose={closeColl} highlight={coll.highlight} />
      </LazyMount>
      <LazyMount visible={factOpen}>
        <FactSheet visible={factOpen} onClose={() => setFactOpen(false)} />
      </LazyMount>
      <LazyMount visible={paceOpen}>
        <MonthPaceSheet visible={paceOpen} onClose={() => setPaceOpen(false)} expenses={expenses}
          onOpenCards={() => { setPaceOpen(false); setTimeout(() => setColl({ open: true, highlight: null }), 280); }} />
      </LazyMount>
      <LazyMount visible={sleepOpen}>
        <SleepSheet visible={sleepOpen} onClose={() => setSleepOpen(false)} />
      </LazyMount>
      <LazyMount visible={bodyOpen}>
        <BodySheet visible={bodyOpen} onClose={() => setBodyOpen(false)} />
      </LazyMount>
      <LazyMount visible={moodStatsOpen}>
        <MoodStatsSheet visible={moodStatsOpen} onClose={() => setMoodStatsOpen(false)} expenses={expenses}
          onAdd={() => { setMoodStatsOpen(false); setTimeout(() => setMoodOpen(true), 280); }}
          onGood={(date) => { setMoodStatsOpen(false); setTimeout(() => setGood({ open: true, date }), 280); }} />
      </LazyMount>
      <LazyMount visible={moodOpen}>
        <MoodModal visible={moodOpen} onClose={() => setMoodOpen(false)} />
      </LazyMount>
    </Screen>
  );
}

const st = StyleSheet.create({
  factTile: { gap: 8 },
  factBody: { flex: 1, justifyContent: 'center', gap: 10, paddingHorizontal: 4 },
  factHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  factTopic: { fontSize: 30, lineHeight: 35, fontFamily: 'Inter_900Black', letterSpacing: -0.5, color: C.hi },
  factTeaser: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_600SemiBold', color: C.txt },
  factFoot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factKnow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.chip, borderWidth: 1, borderColor: C.line },
  factKnowArmed: { borderColor: C.hi, backgroundColor: C.in2 },
  factKnowTxt: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: C.mut },
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
  moodCap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, marginTop: -6 },
  moodStatsBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: C.in2, alignItems: 'center', justifyContent: 'center' },
  moodQuick: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, height: 24 },
  moodQuickDot: { width: 20, height: 20, borderRadius: 10 },
  moodEvening: { borderWidth: 1, borderColor: 'rgba(163,230,53,0.45)', backgroundColor: 'rgba(163,230,53,0.06)' },
  moodDots: { flexDirection: 'row', marginTop: 8, height: 14, alignItems: 'center' },
  moodDotCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  moodDot: { borderRadius: 7 },
  moodDotToday: { borderWidth: 1.5, borderColor: C.hi },
});
