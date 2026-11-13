import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Moon } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { SheetCard, Legend } from '@/components/design/SheetCard';
import Hypnogram from './Hypnogram';
import { useHealthStore } from '@/store/healthStore';
import { sleepSummary, sleepWeek, vsAverage, fmtDur, PHASE_META, PHASE_COLOR, SLEEP_GOAL_MIN } from '@/utils/sleepStats';

// Szczegóły snu (2026-11-13, user: "po kliknięciu wszystkie szczegóły snu, które
// możemy zebrać, fajnie przedstawione"). Wszystko z Health Connect (zegarek):
// czas, okno snu, porównanie z tygodniem, hipnogram, fazy z normami, wydajność,
// wybudzenia, pierwszy głęboki, 7 nocy z celem 8 h, średnie godziny, dług snu.
const WD = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];

export default function SleepSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const today = useHealthStore((st) => st.today);
  const history = useHealthStore((st) => st.history);
  const connected = useHealthStore((st) => st.connected);
  const sum = useMemo(() => (today ? sleepSummary(today) : null), [today]);
  const week = useMemo(() => sleepWeek({ ...history, ...(today ? { [today.date]: today } : {}) }), [history, today]);

  const spans = today?.sleepStages ?? [];
  const start = today?.sleepStartMs ?? null;
  const end = today?.sleepEndMs ?? null;
  const awakenings = spans.filter((x) => x.stage === 'awake' && x.end - x.start >= 2 * 60000).length;
  const firstDeep = start != null ? spans.find((x) => x.stage === 'deep') : undefined;
  const firstDeepMin = firstDeep && start != null ? Math.round((firstDeep.start - start) / 60000) : null;
  const maxNight = Math.max(SLEEP_GOAL_MIN, ...week.nights.map((n) => n.minutes ?? 0));
  const cmp = sum ? vsAverage(sum.total, week) : null;

  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.92}>
      <View style={s.head}>
        <Moon size={15} color={colors.text.secondary} />
        <Text style={s.title}>Sen</Text>
      </View>

      {!sum ? (
        <Text style={s.empty}>{connected ? 'Brak danych o śnie z dzisiejszej nocy — zegarek jeszcze nie zsynchronizował.' : 'Połącz zegarek w Ustawieniach → Połączenia, żeby widzieć sen.'}</Text>
      ) : (
        <>
          <SheetCard>
          <Text style={s.big}>{fmtDur(sum.total)}</Text>
          <Text style={s.sub}>{today?.sleepFrom} – {today?.sleepTo}{cmp ? ` · ${cmp}` : ''}</Text>
          </SheetCard>

          <View style={s.miniRow}>
            <View style={s.mini}><Text style={s.val}>{fmtDur(sum.asleep)}</Text><Text style={s.key}>sen właściwy</Text></View>
            <View style={s.mini}><Text style={s.val}>{sum.efficiency != null ? `${sum.efficiency}%` : '—'}</Text><Text style={s.key}>wydajność</Text></View>
            <View style={s.mini}><Text style={s.val}>{spans.length ? awakenings : '—'}</Text><Text style={s.key}>wybudzenia</Text></View>
            <View style={s.mini}><Text style={s.val}>{firstDeepMin != null ? `${firstDeepMin} min` : '—'}</Text><Text style={s.key}>do 1. głębokiego</Text></View>
          </View>

          {spans.length > 0 && start != null && end != null && (
            <SheetCard title="Przebieg nocy">
              <Hypnogram spans={spans} start={start} end={end} />
            </SheetCard>
          )}

          {sum.hasPhases && (
            <SheetCard title="Fazy" right={<Legend items={[{ color: colors.text.secondary, label: 'twój %' }, { color: colors.text.muted, label: 'norma' }]} />}>
              {sum.phases.map((p) => {
                const [lo, hi] = PHASE_META[p.kind].norm;
                return (
                  <View key={p.kind} style={s.phaseRow}>
                    <View style={[s.phaseDot, { backgroundColor: PHASE_COLOR[p.kind] }]} />
                    <Text style={s.phaseName}>{PHASE_META[p.kind].label}</Text>
                    <View style={s.phaseTrack}>
                      <View style={[s.phaseFill, { width: `${Math.min(100, p.pct)}%`, backgroundColor: PHASE_COLOR[p.kind] }]} />
                    </View>
                    <Text style={s.phaseMin}>{fmtDur(p.min)}</Text>
                    <Text style={[s.phasePct, p.status !== 'ok' && { color: colors.accent.orange }]}>{p.pct}%</Text>
                    <Text style={s.phaseNorm}>{lo}–{hi}%</Text>
                  </View>
                );
              })}
              <Text style={s.note}>Norma = typowy udział fazy u dorosłych. Pomarańczowy % = poza normą.</Text>
            </SheetCard>
          )}
        </>
      )}

      {week.count > 0 && (
        <>
          <SheetCard
            title="Ostatnie 7 nocy"
            right={<Legend items={[{ color: colors.text.muted, label: 'cel 8 h', line: true }, { color: colors.accent.orange, label: '< 7 h' }, { color: PHASE_COLOR.rem, label: 'dziś' }]} />}
          >
          <View style={s.weekRow}>
            {week.nights.map((n, i) => {
              const [y, m, d] = n.date.split('-').map(Number);
              const h = n.minutes != null ? (n.minutes / maxNight) * 100 : 0;
              const short = n.minutes != null && n.minutes < SLEEP_GOAL_MIN - 60;
              return (
                <View key={n.date} style={s.weekCol}>
                  <Text style={s.weekVal}>{n.minutes != null ? (n.minutes / 60).toFixed(1).replace('.', ',') : ''}</Text>
                  <View style={s.weekBox}>
                    <View style={[s.goalLine, { bottom: `${(SLEEP_GOAL_MIN / maxNight) * 100}%` }]} />
                    {n.minutes != null ? (
                      <View style={[s.weekBar, { height: `${h}%`, backgroundColor: short ? colors.accent.orange : PHASE_COLOR.light }, i === 6 && { backgroundColor: PHASE_COLOR.rem }]} />
                    ) : <View style={s.weekNone} />}
                  </View>
                  <Text style={[s.weekDay, i === 6 && { color: colors.text.primary }]}>{WD[new Date(y, m - 1, d).getDay()]}</Text>
                </View>
              );
            })}
          </View>
          <Text style={s.note}>Liczba nad słupkiem = godziny snu.</Text>
          </SheetCard>
          <View style={s.miniRow}>
            <View style={s.mini}><Text style={s.val}>{week.avgMinutes != null ? fmtDur(week.avgMinutes) : '—'}</Text><Text style={s.key}>średnio</Text></View>
            <View style={s.mini}><Text style={s.val}>{week.avgBedtime ?? '—'}</Text><Text style={s.key}>zasypiasz ok.</Text></View>
            <View style={s.mini}><Text style={s.val}>{week.avgWake ?? '—'}</Text><Text style={s.key}>wstajesz ok.</Text></View>
            <View style={s.mini}><Text style={[s.val, week.debtMin > 120 && { color: colors.accent.orange }]}>{fmtDur(week.debtMin)}</Text><Text style={s.key}>brakuje do 8 h</Text></View>
          </View>
        </>
      )}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  empty: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: spacing[3], lineHeight: 19 },
  big: { fontSize: 40, lineHeight: 46, fontFamily: 'Inter_900Black', color: c.text.primary, letterSpacing: -1.2 },
  miniRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  mini: { flexGrow: 1, flexBasis: '45%', backgroundColor: c.ui.in, borderRadius: radius.lg, paddingVertical: spacing[2], paddingHorizontal: spacing[3] },
  sub: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing[3], rowGap: spacing[3] },
  cell: { width: '50%' },
  val: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  key: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 },
  section: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[5], marginBottom: spacing[2] },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 5 },
  phaseDot: { width: 8, height: 8, borderRadius: 4 },
  phaseName: { width: 84, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.primary },
  phaseTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  phaseFill: { height: 6, borderRadius: 3 },
  phaseMin: { width: 52, textAlign: 'right', fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  phasePct: { width: 36, textAlign: 'right', fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  phaseNorm: { width: 44, textAlign: 'right', fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  note: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2], lineHeight: 15 },
  weekRow: { flexDirection: 'row', gap: 6, height: 130 },
  weekCol: { flex: 1, alignItems: 'center', gap: 4 },
  weekVal: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.secondary, height: 13 },
  weekBox: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  goalLine: { position: 'absolute', left: -3, right: -3, height: 1, backgroundColor: c.text.muted, opacity: 0.6 },
  weekBar: { width: '72%', borderRadius: 4, minHeight: 4 },
  weekNone: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.border.default },
  weekDay: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
}));
