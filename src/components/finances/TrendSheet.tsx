import { INCOME_META } from '@/utils/incomeCategory';
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { SheetCard } from '@/components/design/SheetCard';
import { useExpensesStore } from '@/store/expensesStore';
import { useCategoriesVersion } from '@/store/categoriesStore';
import { trendSeries, trendStats, monthShort } from '@/utils/trend';
import { FOOD_SUBCAT_META } from '@/utils/food';
import { FIXED_CAT_META, FIXED_OTHER } from '@/utils/fixedCategory';
import { EXPENSE_CATEGORY_META, UNCATEGORIZED } from '@/utils/expenseCategory';
import { haptic } from '@/utils/haptics';
import { zl } from '@/utils/money';

// Trend 12 miesięcy (2026-11-14, z listy "czego brakuje": "ile szło na paliwo albo
// jedzenie miesiąc po miesiącu"). Koszyk → podkategorie, słupki z kreską średniej,
// stuknięcie słupka pokazuje kwotę. Logika: utils/trend.ts.
type Bucket = 'all' | 'food' | 'fixed' | 'variable' | 'income';
const BUCKETS: [Bucket, string][] = [['all', 'Wydatki'], ['food', 'Jedzenie'], ['fixed', 'Stałe'], ['variable', 'Zmienne'], ['income', 'Wpływy']];
const PREFIX: Record<Bucket, string> = { all: '', food: 'food:', fixed: 'fixed:', variable: 'cat:', income: 'inc:' };
const CHART_H = 120;

function metaOf(key: string): { label: string; color: string } {
  const [p, tag] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  if (p === 'food') return tag === 'inne' ? { label: 'Inne jedzenie', color: '#8A8A8A' } : FOOD_SUBCAT_META[tag] ?? { label: tag, color: '#8A8A8A' };
  if (p === 'inc') return INCOME_META[tag] ?? { label: tag, color: '#8A8A8A' };
  if (p === 'fixed') return tag === FIXED_OTHER ? { label: 'Inne stałe', color: '#5A5A5A' } : FIXED_CAT_META[tag] ?? { label: tag, color: '#8A8A8A' };
  return tag === UNCATEGORIZED ? { label: 'Bez kategorii', color: '#5A5A5A' } : EXPENSE_CATEGORY_META[tag] ?? { label: tag, color: '#8A8A8A' };
}

export default function TrendSheet({ visible, onClose, initial = 'all' }: { visible: boolean; onClose: () => void; initial?: Bucket }) {
  const s = makeS();
  const expenses = useExpensesStore((st) => st.expenses);
  const catVersion = useCategoriesVersion();
  const [bucket, setBucket] = useState<Bucket>(initial);
  const [sub, setSub] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => { if (visible) { setBucket(initial); setSub(null); setPicked(null); } }, [visible, initial]);

  // Liczone tylko przy otwartym arkuszu (zamknięty nie przelicza przy każdym wydatku).
  const data = useMemo(() => (visible ? trendSeries(expenses, 12, new Date()) : null), [visible, expenses, catVersion]);
  if (!data) return <AppBottomSheet visible={false} onClose={onClose}><View /></AppBottomSheet>;

  const subs = bucket === 'all' ? [] : [...data.series.entries()]
    .filter(([k]) => k.startsWith(PREFIX[bucket]))
    .map(([k, v]) => ({ key: k, total: v.reduce((a, b) => a + b, 0), ...metaOf(k) }))
    .sort((a, b) => b.total - a.total);
  const key = sub ?? bucket;
  const values = data.series.get(key) ?? new Array(12).fill(0);
  const st = trendStats(values);
  const top = Math.max(st.max.v, st.avg, 1);
  const color = sub ? metaOf(sub).color : colors.text.bright;
  const sel = picked ?? values.length - 1;

  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.92} header={<Text style={s.title}>Trend · 12 miesięcy</Text>}>
      <View style={s.seg}>
        {BUCKETS.map(([b, label]) => (
          <TouchableOpacity key={b} style={[s.segItem, bucket === b && s.segOn]} onPress={() => { haptic.tap(); setBucket(b); setSub(null); setPicked(null); }}>
            <Text style={[s.segLabel, bucket === b && s.segLabelOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Podkategorie w JEDNYM rzędzie przewijanym w bok (2026-11-16, user: "listy
          powinny być poziome scroll, a nie takie rozległe"); "Wszystkie" = cały koszyk. */}
      {subs.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chips}>
          <TouchableOpacity style={[s.chip, !sub && s.chipAll]} onPress={() => { haptic.tap(); setSub(null); setPicked(null); }}>
            <Text style={[s.chipLabel, !sub && s.chipAllLabel]}>Wszystkie</Text>
          </TouchableOpacity>
          {subs.map((c) => {
            const on = sub === c.key;
            return (
              <TouchableOpacity key={c.key} style={[s.chip, on && { borderColor: c.color, backgroundColor: c.color + '22' }]} onPress={() => { haptic.tap(); setSub(on ? null : c.key); setPicked(null); }}>
                <View style={[s.dot, { backgroundColor: c.color }]} />
                <Text style={[s.chipLabel, on && s.chipLabelOn]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <SheetCard title={sub ? metaOf(sub).label : BUCKETS.find(([b]) => b === bucket)![1]}>
        <View style={s.readout}>
          <Text style={s.big}>{zl(values[sel])}</Text>
          <Text style={s.readLabel}>{monthShort(data.months[sel])} {data.months[sel].slice(0, 4)}{sel === values.length - 1 ? ' · do dziś' : ''}</Text>
        </View>
        <View style={s.chart}>
          {st.avg > 0 && <View style={[s.avgLine, { bottom: (st.avg / top) * CHART_H + 16 }]} />}
          {values.map((v, i) => (
            <TouchableOpacity key={data.months[i]} style={s.col} activeOpacity={0.7} onPress={() => { haptic.tap(); setPicked(i); }}>
              <View style={s.barArea}>
                <View style={[s.bar, { height: Math.max(v > 0 ? 3 : 0, (v / top) * CHART_H), backgroundColor: color, opacity: i === sel ? 1 : i === values.length - 1 ? 0.45 : 0.7 }]} />
              </View>
              <Text style={[s.mLabel, i === sel && s.mLabelOn]}>{monthShort(data.months[i]).slice(0, 3)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.stats}>
          <View style={s.stat}><Text style={s.statV}>{zl(st.avg)}</Text><Text style={s.statL}>średnio / mies.</Text></View>
          <View style={s.stat}>
            <Text style={[s.statV, st.delta != null && { color: st.delta > 10 ? colors.accent.red : st.delta < -10 ? colors.accent.green : colors.text.primary }]}>
              {st.delta == null ? '—' : `${st.delta > 0 ? '+' : ''}${st.delta}%`}
            </Text>
            <Text style={s.statL}>ten miesiąc vs średnia</Text>
          </View>
          <View style={s.stat}><Text style={s.statV}>{st.max.v ? zl(st.max.v) : '—'}</Text><Text style={s.statL}>{st.max.v ? `najwięcej · ${monthShort(data.months[st.max.i])}` : 'najwięcej'}</Text></View>
        </View>
        <Text style={s.note}>Kreska = średnia pełnych miesięcy. Bieżący miesiąc jest niepełny (jaśniejszy).</Text>
      </SheetCard>
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, paddingBottom: spacing[2] },
  seg: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, overflow: 'hidden' },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  segOn: { backgroundColor: c.text.bright },
  segLabel: { fontSize: 11.5, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  segLabelOn: { color: c.bg.primary },
  chipScroll: { marginTop: spacing[3], flexGrow: 0 },
  chips: { flexDirection: 'row', gap: 6, paddingRight: spacing[2] },
  chipAll: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  chipAllLabel: { color: c.bg.primary },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  chipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  chipLabelOn: { color: c.text.primary },
  dot: { width: 9, height: 9, borderRadius: 5 },
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2], marginBottom: spacing[2] },
  big: { fontSize: 24, fontFamily: 'Inter_900Black', color: c.text.primary },
  readLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: CHART_H + 18, position: 'relative' },
  col: { flex: 1, alignItems: 'center' },
  barArea: { height: CHART_H, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3 },
  mLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', color: c.text.muted, marginTop: 4, height: 12 },
  mLabelOn: { color: c.text.primary },
  avgLine: { position: 'absolute', left: 0, right: 0, height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: c.text.muted, zIndex: 2 },
  stats: { flexDirection: 'row', marginTop: spacing[3], gap: spacing[2] },
  stat: { flex: 1 },
  statV: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.text.primary },
  statL: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 1 },
  note: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: spacing[3] },
}));
