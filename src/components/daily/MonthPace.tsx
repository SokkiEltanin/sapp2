import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { SheetCard } from '@/components/design/SheetCard';
import Segmented from '@/components/design/Segmented';
import { monthPace, yearPace, monthlySeries, seasonCompare, PACE_LABEL, type PaceKey, type MonthPace } from '@/utils/monthPace';
import { zl, money } from '@/utils/money';
import type { Expense } from '@/types/finances';

// Postęp miesiąca w Daily (2026-11-16, user: "porównuje pierwsze dni miesięcy
// ostatnich do pierwszych dni tego... wydatki, słodycze... prąd: czy się zwiększa
// w zimę"). Kafel: 3 metryki "do dziś" vs średnia z tych samych dni 3 poprzednich
// miesięcy + prąd 12 miesięcy. Sheet: wszystkie metryki, rok do dziś, prąd sezonowo.
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const TILE_KEYS: PaceKey[] = ['all', 'food', 'food:słodycze'];
const SHEET_KEYS: PaceKey[] = ['all', 'food', 'variable', 'fixed', 'food:słodycze', 'food:przekąski', 'food:napoje'];

export const windowLabel = (now: Date) => `1–${now.getDate()} ${MONTHS_GEN[now.getMonth()]}`;

// Wydatki: mniej = dobrze (zielony), więcej = źle (pomarańczowy), ±5% = jak zwykle.
export function deltaView(delta: number | null): { text: string; color: string } {
  if (delta == null) return { text: 'nowe', color: colors.text.muted };
  if (Math.abs(delta) < 5) return { text: 'jak zwykle', color: colors.text.secondary };
  return delta > 0 ? { text: `+${delta}%`, color: colors.accent.orange } : { text: `${delta}%`, color: colors.accent.green };
}

/** Wiersze kafla (bez Tile — Tile i nagłówek w daily.tsx). */
export function MonthPaceRows({ expenses, now }: { expenses: Expense[]; now: Date }) {
  const s = makeS();
  const paces = useMemo(() => TILE_KEYS.map((k) => monthPace(expenses, k, now)), [expenses, now]);
  const power = useMemo(() => monthlySeries(expenses, 'fixed:prąd', 12, now), [expenses, now]);
  const powerMax = Math.max(1, ...power.map((x) => x.value));
  const hasPower = power.some((x) => x.value > 0);
  const season = seasonCompare(power);
  return (
    <View style={s.rows}>
      {paces.map((p) => <PaceRow key={p.key} p={p} />)}
      <View style={s.row}>
        <Text style={s.label}>Prąd</Text>
        {hasPower ? (
          <>
            <View style={s.spark}>
              {power.map((x, i) => (
                <View key={x.key} style={[s.sparkBar, { height: `${Math.max(6, (x.value / powerMax) * 100)}%`, backgroundColor: i === power.length - 1 ? colors.text.bright : x.value > 0 ? colors.text.muted : colors.ui.dim }]} />
              ))}
            </View>
            <Text style={s.sub} numberOfLines={1}>{season.delta != null ? `zima ${season.delta > 0 ? '+' : ''}${season.delta}%` : '12 mies.'}</Text>
          </>
        ) : <Text style={[s.sub, { flex: 1 }]}>brak rachunków za prąd</Text>}
      </View>
    </View>
  );
}

function PaceRow({ p }: { p: MonthPace }) {
  const s = makeS();
  const d = deltaView(p.delta);
  const max = Math.max(p.current, p.avg ?? 0, 1) * 1.08;
  return (
    <View style={s.row}>
      <Text style={s.label} numberOfLines={1}>{PACE_LABEL[p.key] ?? p.key}</Text>
      <View style={s.track}>
        {/* Paski biało-czarne (2026-11-23, user: "wydatki miesięczne na biało-czarno, kolorowe tylko liczby, że przekraczamy"). */}
        <View style={[s.fill, { width: `${(p.current / max) * 100}%`, backgroundColor: colors.text.secondary }]} />
        {p.avg != null && <View style={[s.avgMark, { left: `${(p.avg / max) * 100}%` }]} />}
      </View>
      <Text style={s.value} numberOfLines={1}>{money(p.current)}</Text>
      <Text style={[s.delta, { color: d.color }]} numberOfLines={1}>{d.text}</Text>
    </View>
  );
}

export default function MonthPaceSheet({ visible, onClose, expenses, onOpenCards }: { visible: boolean; onClose: () => void; expenses: Expense[]; onOpenCards?: () => void }) {
  const s = makeS();
  const [tab, setTab] = useState<'month' | 'year'>('month');
  const now = useMemo(() => new Date(), [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  // Metryki bez żadnych kwot (np. brak przekąsek) chowamy.
  const paces = useMemo(() => (visible ? SHEET_KEYS.map((k) => monthPace(expenses, k, now, 6)).filter((p) => p.current > 0 || p.months.some((m) => m.value > 0)) : []), [visible, expenses, now]);
  const years = useMemo(() => (visible ? SHEET_KEYS.map((k) => ({ key: k, ...yearPace(expenses, k, now) })).filter((y) => y.current > 0 || (y.last ?? 0) > 0) : []), [visible, expenses, now]);
  const power = useMemo(() => (visible ? monthlySeries(expenses, 'fixed:prąd', 12, now) : []), [visible, expenses, now]);
  const power24 = useMemo(() => (visible ? monthlySeries(expenses, 'fixed:prąd', 24, now) : []), [visible, expenses, now]);
  const season = seasonCompare(power24);
  const powerMax = Math.max(1, ...power.map((x) => x.value));
  const lastYearSame = power24.length === 24 ? power24[11].value : 0;

  return (
    <AppBottomSheet fixedHeight visible={visible} onClose={onClose} maxHeightRatio={0.9} header={<Text style={s.title}>Podsumowanie</Text>}>
      <Segmented options={[{ key: 'month', label: 'Miesiąc' }, { key: 'year', label: 'Rok' }]} activeKey={tab} onChange={(k) => setTab(k as 'month' | 'year')} />

      {tab === 'month' ? (
        <SheetCard title={`${windowLabel(now)} vs te same dni`}>
          {paces.map((p) => {
            const d = deltaView(p.delta);
            const cols = [...p.months, { key: 'now', label: 'teraz', value: p.current }];
            const max = Math.max(1, ...cols.map((c) => c.value));
            return (
              <View key={p.key} style={s.metric}>
                <View style={s.metricHead}>
                  <Text style={s.metricName}>{PACE_LABEL[p.key] ?? p.key}</Text>
                  <Text style={s.metricVal}>{zl(p.current)}</Text>
                  <Text style={[s.metricDelta, { color: d.color }]}>{d.text}</Text>
                </View>
                {p.months.length > 0 ? (
                  <View style={s.cols}>
                    {cols.map((c, i) => (
                      <View key={c.key} style={s.col}>
                        <Text style={s.colVal} numberOfLines={1}>{c.value > 0 ? Math.round(c.value) : '–'}</Text>
                        <View style={s.colBox}>
                          <View style={[s.colBar, { height: `${Math.max(3, (c.value / max) * 100)}%` }, i === cols.length - 1 && { backgroundColor: colors.text.bright }]} />
                        </View>
                        <Text style={[s.colLbl, i === cols.length - 1 && { color: colors.text.bright }]}>{c.label}</Text>
                      </View>
                    ))}
                  </View>
                ) : <Text style={s.note}>Za mało historii — porównanie pojawi się w następnym miesiącu.</Text>}
                {p.avg != null && <Text style={s.note}>Średnio w tych samych dniach (3 ostatnie mies.): {zl(p.avg)}</Text>}
              </View>
            );
          })}
        </SheetCard>
      ) : (
        <SheetCard title={`Rok do dziś · ${now.getFullYear()} vs ${now.getFullYear() - 1}`}>
          {years.map((y) => {
            const d = deltaView(y.delta);
            return (
              <View key={y.key} style={s.yearRow}>
                <Text style={s.metricName}>{PACE_LABEL[y.key] ?? y.key}</Text>
                <Text style={s.metricVal}>{zl(y.current)}</Text>
                <Text style={s.yearLast}>{y.last != null ? `rok temu ${zl(y.last)}` : 'rok temu —'}</Text>
                <Text style={[s.metricDelta, { color: d.color }]}>{y.last != null ? d.text : ''}</Text>
              </View>
            );
          })}
          {years.every((y) => y.last == null) && <Text style={s.note}>Brak danych z zeszłego roku — porównanie rok do roku pojawi się, gdy appka będzie miała historię.</Text>}
        </SheetCard>
      )}

      {/* Prąd: kiedy i ile płacisz, czy zimą więcej. */}
      <SheetCard title="Prąd · 12 miesięcy">
        {power.some((x) => x.value > 0) ? (
          <>
            <View style={[s.cols, { height: 110 }]}>
              {power.map((x, i) => (
                <View key={x.key} style={s.col}>
                  <Text style={s.colVal} numberOfLines={1}>{x.value > 0 ? Math.round(x.value) : ''}</Text>
                  <View style={s.colBox}>
                    <View style={[s.colBar, { height: `${x.value > 0 ? Math.max(4, (x.value / powerMax) * 100) : 0}%`, backgroundColor: i === power.length - 1 ? colors.text.bright : colors.text.muted }]} />
                  </View>
                  <Text style={[s.colLbl, [11, 12, 1, 2].includes(Number(x.key.slice(5, 7))) && { color: '#93C5FD' }]}>{x.label}</Text>
                </View>
              ))}
            </View>
            <Text style={s.powerLine}>
              {season.delta != null
                ? `Zimą (lis–lut) średnio ${zl(season.winter!)}, latem (maj–sie) ${zl(season.summer!)} — zimą ${season.delta > 0 ? `o ${season.delta}% więcej` : season.delta < 0 ? `o ${-season.delta}% mniej` : 'tyle samo'}.`
                : 'Porównanie zima / lato pojawi się, gdy będą rachunki z obu pór roku.'}
            </Text>
            {lastYearSame > 0 && <Text style={s.note}>Ten miesiąc rok temu: {zl(lastYearSame)}. Niebieskie miesiące = zima.</Text>}
          </>
        ) : <Text style={s.note}>Brak rachunków za prąd. Appka rozpoznaje je po nazwie (PGE, Tauron, Energa, Enea, „prąd”).</Text>}
      </SheetCard>
      {onOpenCards && (
        <TouchableOpacity style={s.cardsBtn} onPress={onOpenCards} accessibilityLabel="Karty miesięcy i rekordy">
          <Text style={s.cardsBtnTxt}>Karty miesięcy i rekordy ›</Text>
        </TouchableOpacity>
      )}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  cardsBtn: { marginTop: spacing[3], height: 44, borderRadius: radius.md, backgroundColor: c.text.bright, alignItems: 'center', justifyContent: 'center' },
  cardsBtnTxt: { fontSize: 13.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
  rows: { gap: 7, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], height: 20 },
  label: { width: 70, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.primary },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.ui.in2, position: 'relative', overflow: 'visible' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  avgMark: { position: 'absolute', top: -3, bottom: -3, width: 4, marginLeft: -2, borderRadius: 2, backgroundColor: c.text.bright, borderWidth: 1, borderColor: c.bg.card },
  value: { width: 64, textAlign: 'right', fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.bright, fontVariant: ['tabular-nums'] },
  delta: { width: 62, textAlign: 'right', fontSize: 11, fontFamily: 'Inter_800ExtraBold', fontVariant: ['tabular-nums'] },
  spark: { flex: 1, height: 18, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  sparkBar: { flex: 1, borderRadius: 1.5 },
  sub: { width: 126, textAlign: 'right', fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, paddingBottom: spacing[2] },
  metric: { paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: c.ui.line, gap: 6 },
  metricHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  metricName: { flex: 1, fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  metricVal: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.text.bright, fontVariant: ['tabular-nums'] },
  metricDelta: { minWidth: 68, textAlign: 'right', fontSize: 12, fontFamily: 'Inter_800ExtraBold' },
  cols: { flexDirection: 'row', gap: 6, height: 74 },
  col: { flex: 1, alignItems: 'center', gap: 2 },
  colVal: { fontSize: 9.5, fontFamily: 'Inter_700Bold', color: c.text.muted, fontVariant: ['tabular-nums'] },
  colBox: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  colBar: { width: '70%', borderRadius: 3, backgroundColor: c.text.muted },
  colLbl: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted },
  note: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, lineHeight: 15 },
  yearRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2], paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.ui.line, flexWrap: 'wrap' },
  yearLast: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  powerLine: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary, lineHeight: 18, marginTop: spacing[2] },
}));
