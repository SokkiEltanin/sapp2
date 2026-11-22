import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type LayoutChangeEvent } from 'react-native';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { SheetCard, Legend } from '@/components/design/SheetCard';
import { useMoodStore } from '@/store/moodStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useScreenTimeStore } from '@/store/screenTimeStore';
import { useGoodThingsStore } from '@/store/goodThingsStore';
import { goodList, goodStreak } from '@/utils/goodThings';
import { todayISO } from '@/utils/date';
import type { Expense } from '@/types/finances';
import { moodColor, energyGlow, roundLevel, MOOD_LABELS, ENERGY_LABELS, MOOD_COLORS } from '@/types/mood';
import { dailyMood, moodSummary, lastDays, weekdayMood, yearPixels, moodLinks, tagMood } from '@/utils/moodStats';
import { haptic } from '@/utils/haptics';

// Zakładka humoru (2026-11-18, user: "przy humorze mini przycisk do zakładki — średnia,
// pixel year i wykresy, może zależności od zakupów… w naszym stylu"). Logika:
// utils/moodStats.ts. Otwierana przyciskiem w kaflu Humor w Daily (kafel dalej = dodaj wpis).
const n1 = (v: number) => v.toFixed(1).replace('.', ',');
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${n1(Math.abs(v))}`;
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

export default function MoodStatsSheet({ visible, onClose, onAdd, onGood, expenses }: {
  visible: boolean; onClose: () => void; onAdd: () => void; onGood?: (date: string) => void; expenses: Expense[];
}) {
  const s = makeS();
  const entries = useMoodStore((st) => st.entries);
  const healthLog = useCollectionStore((st) => st.healthLog);
  const days = useMemo(() => dailyMood(entries), [entries]);
  const sum = useMemo(() => moodSummary(days, 30), [days]);
  const month = useMemo(() => lastDays(days, 30), [days]);
  const week = useMemo(() => weekdayMood(days), [days]);
  const screenDays = useScreenTimeStore((st) => st.days);
  const goodItems = useGoodThingsStore((st) => st.items);
  const goods = useMemo(() => goodList(goodItems), [goodItems]);
  const goodDates = useMemo(() => new Set(goods.map((g) => g.date)), [goods]);
  const links = useMemo(() => moodLinks(days, expenses, healthLog, screenDays, goodDates), [days, expenses, healthLog, screenDays, goodDates]);
  const tags = useMemo(() => tagMood(entries), [entries]);
  const years = useMemo(() => {
    const ys = new Set<number>([new Date().getFullYear()]);
    for (const d of days.keys()) ys.add(Number(d.slice(0, 4)));
    return [...ys].sort();
  }, [days]);
  const [year, setYear] = useState(new Date().getFullYear());
  const pixels = useMemo(() => yearPixels(days, year), [days, year]);
  const [gridW, setGridW] = useState(0);
  const weekMax = week.reduce<{ label: string; avg: number } | null>((m, w) => (w.avg != null && w.n >= 2 && (!m || w.avg > m.avg) ? { label: w.label, avg: w.avg } : m), null);

  const cell = gridW > 0 ? Math.floor((gridW - 30 - 31 * 2) / 31) : 0;

  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.92}
      header={
        <View style={s.headRow}>
          <Text style={s.title}>Humor</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => { haptic.tap(); onAdd(); }} activeOpacity={0.8} accessibilityLabel="Zapisz humor">
            <Plus size={14} color={colors.bg.primary} /><Text style={s.addTxt}>Zapisz</Text>
          </TouchableOpacity>
        </View>
      }>
      {days.size === 0 ? (
        <SheetCard><Text style={s.empty}>Brak wpisów — zapisz pierwszy humor, a tu pojawią się średnie, rok w pikselach i zależności.</Text></SheetCard>
      ) : (
        <>
          <SheetCard title="Ostatnie 30 dni" right={<Text style={s.capR}>{sum.days} dni z wpisem</Text>}>
            <View style={s.sumRow}>
              <Text style={[s.big, sum.avg != null && { color: moodColor(sum.avg) }]}>{sum.avg != null ? MOOD_LABELS[roundLevel(sum.avg)] : '—'}</Text>
              {sum.avg != null && <Text style={s.bigNum}>{n1(sum.avg)}</Text>}
              {sum.delta != null && (
                <Text style={[s.delta, { color: Math.abs(sum.delta) < 0.15 ? colors.text.muted : sum.delta > 0 ? colors.accent.green : colors.accent.orange }]}>
                  {Math.abs(sum.delta) < 0.15 ? 'jak miesiąc wcześniej' : `${signed(sum.delta)} vs miesiąc wcześniej`}
                </Text>
              )}
            </View>
            <Text style={s.sub}>
              {sum.energy != null ? `energia: ${ENERGY_LABELS[roundLevel(sum.energy)].toLowerCase()}` : ''}
              {weekMax ? ` · najlepszy dzień: ${weekMax.label}` : ''}
            </Text>
            <View style={s.month}>
              {month.map(({ date, d }) => (
                <View key={date} style={s.monthCol}>
                  {d ? <View style={[s.monthBar, { height: `${12 + ((d.mood - 1) / 4) * 88}%`, backgroundColor: moodColor(d.mood), opacity: 0.55 + energyGlow(d.energy) * 0.45 }]} />
                    : <View style={s.monthEmpty} />}
                </View>
              ))}
            </View>
            <View style={s.axisRow}><Text style={s.axis}>30 dni temu</Text><Text style={s.axis}>dziś</Text></View>
          </SheetCard>

          <SheetCard title="Rok w pikselach"
            right={years.length > 1 ? (
              <View style={s.yearNav}>
                <TouchableOpacity hitSlop={8} disabled={year <= years[0]} onPress={() => setYear((y) => y - 1)}><ChevronLeft size={16} color={year <= years[0] ? colors.text.muted : colors.text.primary} /></TouchableOpacity>
                <Text style={s.capR}>{year}</Text>
                <TouchableOpacity hitSlop={8} disabled={year >= years[years.length - 1]} onPress={() => setYear((y) => y + 1)}><ChevronRight size={16} color={year >= years[years.length - 1] ? colors.text.muted : colors.text.primary} /></TouchableOpacity>
              </View>
            ) : <Text style={s.capR}>{year}</Text>}>
            <View onLayout={(e: LayoutChangeEvent) => setGridW(e.nativeEvent.layout.width)} style={s.grid}>
              {cell > 0 && pixels.map((row, m) => (
                <View key={m} style={s.gridRow}>
                  <Text style={[s.gridLabel, { width: 30 }]}>{MONTHS[m]}</Text>
                  {row.map((v, i) => (
                    <View key={i} style={{ width: cell, height: cell, borderRadius: Math.max(1, cell / 4), backgroundColor: v != null ? moodColor(v) : colors.ui.in2 }} />
                  ))}
                </View>
              ))}
            </View>
            <Legend items={([1, 2, 3, 4, 5] as const).map((l) => ({ color: MOOD_COLORS[l], label: MOOD_LABELS[l].toLowerCase() }))} />
          </SheetCard>

          <SheetCard title="Dni tygodnia">
            {week.map((w) => (
              <View key={w.label} style={s.wRow}>
                <Text style={s.wLabel}>{w.label}</Text>
                <View style={s.wTrack}>
                  {w.avg != null && <View style={[s.wFill, { width: `${((w.avg - 1) / 4) * 100}%`, backgroundColor: moodColor(w.avg) }]} />}
                </View>
                <Text style={s.wVal}>{w.avg != null ? n1(w.avg) : '—'}</Text>
              </View>
            ))}
          </SheetCard>

          <SheetCard title="Co wpływa na humor">
            {links.length === 0 ? (
              <Text style={s.empty}>Za mało danych — zależności pojawią się, gdy będzie po kilka dni w każdej grupie (sen, kroki, wydatki, słodycze, czas z telefonem, dobra rzecz dnia, weekend).</Text>
            ) : links.map((l) => (
              <View key={l.key} style={s.lRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.lLabel} numberOfLines={1}>{l.label}</Text>
                  <Text style={s.lSub} numberOfLines={1}>{`${n1(l.a)} vs ${n1(l.b)} (${l.vs}) · ${l.na}/${l.nb} dni`}</Text>
                </View>
                <Text style={[s.lDiff, { color: Math.abs(l.diff) < 0.15 ? colors.text.muted : l.diff > 0 ? colors.accent.green : colors.accent.orange }]}>
                  {Math.abs(l.diff) < 0.15 ? 'bez różnicy' : signed(l.diff)}
                </Text>
              </View>
            ))}
            <Text style={s.note}>Średni humor (1–5) w dni z danym warunkiem vs bez niego. To korelacje, nie przyczyny.</Text>
          </SheetCard>

          {goods.length > 0 && (
            <SheetCard title="Dobre rzeczy" right={<Text style={s.capR}>{goods.length} zapisanych{goodStreak(goodItems, todayISO()) >= 2 ? ` · ${goodStreak(goodItems, todayISO())} dni z rzędu` : ''}</Text>}>
              {goods.slice(0, 6).map((g) => (
                <TouchableOpacity key={g.id} style={s.goodRow} activeOpacity={0.7} onPress={() => onGood?.(g.date)}>
                  <Text style={s.goodDate}>{new Date(`${g.date}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</Text>
                  <View style={[s.goodDot, { backgroundColor: days.get(g.date) ? moodColor(days.get(g.date)!.mood) : colors.text.muted }]} />
                  <Text style={s.goodTxt} numberOfLines={2}>{g.text}</Text>
                </TouchableOpacity>
              ))}
              <Text style={s.note}>Kropka = humor tego dnia. Stuknij wpis, żeby go zmienić; wszystkie znajdziesz w wyszukiwarce (lupa). Nowy wpisujesz przy zapisie humoru.</Text>
            </SheetCard>
          )}

          {tags.length > 0 && (
            <SheetCard title="Tagi">
              <View style={s.tags}>
                {[...tags.slice(0, 4), ...tags.slice(4).slice(-3)].map((t) => (
                  <View key={t.tag} style={s.tag}>
                    <View style={[s.tagDot, { backgroundColor: moodColor(t.avg) }]} />
                    <Text style={s.tagTxt}>{t.tag}</Text>
                    <Text style={s.tagN}>{n1(t.avg)}</Text>
                  </View>
                ))}
              </View>
            </SheetCard>
          )}
        </>
      )}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  goodRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 5 },
  goodDate: { width: 52, fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, paddingTop: 1 },
  goodDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  goodTxt: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_600SemiBold', color: c.text.primary },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing[2] },
  title: { fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.bright },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.text.bright, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7 },
  addTxt: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.bg.primary },
  capR: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted },
  empty: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', color: c.text.muted },
  sumRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2], flexWrap: 'wrap' },
  big: { fontSize: 26, fontFamily: 'Inter_900Black', color: c.text.bright },
  bigNum: { fontSize: 15, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  delta: { fontSize: 12, fontFamily: 'Inter_700Bold', marginLeft: 'auto' },
  sub: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 2 },
  month: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 64, marginTop: spacing[3] },
  monthCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  monthBar: { width: '100%', borderRadius: 3 },
  monthEmpty: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.ui.in2 },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axis: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  yearNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grid: { gap: 2, marginBottom: spacing[2] },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  gridLabel: { fontSize: 9.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  wRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 4 },
  wLabel: { width: 22, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  wTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.ui.in2, overflow: 'hidden' },
  wFill: { height: '100%', borderRadius: 4 },
  wVal: { width: 30, textAlign: 'right', fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.primary, fontVariant: ['tabular-nums'] },
  lRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.ui.line },
  lLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  lSub: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 1 },
  lDiff: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', fontVariant: ['tabular-nums'] },
  note: { fontSize: 10.5, lineHeight: 15, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.ui.in2, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  tagTxt: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.primary },
  tagN: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
}));
