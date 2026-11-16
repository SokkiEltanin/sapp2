import { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useExpensesStore } from '@/store/expensesStore';
import { useCategoriesVersion } from '@/store/categoriesStore';
import { buildExpenseTable, heat, type TableRow } from '@/utils/expenseTable';
import { metricAmount, type PaceKey } from '@/utils/monthPace';
import { labelFor } from '@/utils/fixedVariable';
import { money, zl, round2 } from '@/utils/money';
import { haptic } from '@/utils/haptics';
import type { Expense } from '@/types/finances';

// Tabela wydatków "jak w Sheets" (2026-11-16, user: "podoba mi się bardziej tabela jak
// w excelu, jak w sheets"). Pierwsza kolumna (kategorie) stoi, miesiące przewijają się
// w bok (start na bieżącym). Kolor komórki = ile w porównaniu z najdroższym miesiącem
// tego wiersza. Stuknięcie w grupę zwija/rozwija podkategorie, w komórkę — lista
// wydatków z tej kategorii w tym miesiącu. Logika: utils/expenseTable.ts.
const COL_W = 86;
const NAME_W = 132;
const H = { head: 34, group: 38, row: 32, total: 36 };
const PERIODS = [6, 12, 24] as const;

const alpha = (a: number) => Math.round(a * 255).toString(16).padStart(2, '0');

export default function ExpenseTableScreen() {
  const s = makeS();
  const expenses = useExpensesStore((st) => st.expenses);
  const catVer = useCategoriesVersion();
  const [n, setN] = useState<(typeof PERIODS)[number]>(12);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drill, setDrill] = useState<{ key: string; label: string; month: string; monthLabel: string } | null>(null);
  const hScroll = useRef<ScrollView>(null);
  const viewW = useRef(0);
  const contentW = useRef(0);
  // Przewiń tak, żeby bieżący miesiąc stał przy prawej krawędzi (gdy znane oba wymiary).
  const position = () => {
    if (!viewW.current || !contentW.current) return;
    const x = Math.max(0, contentW.current - viewW.current - 2 * (COL_W + 6));
    setTimeout(() => hScroll.current?.scrollTo({ x, animated: false }), 0);
  };
  const t = useMemo(() => buildExpenseTable(expenses, n), [expenses, n, catVer]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (k: string) => { haptic.tap(); setCollapsed((c) => { const x = new Set(c); if (x.has(k)) x.delete(k); else x.add(k); return x; }); };

  // Kolejność wierszy: [typ, wiersz]
  const lines: { kind: 'group' | 'row' | 'total' | 'income' | 'balance'; r: TableRow; group?: string }[] = [];
  for (const g of t.groups) {
    lines.push({ kind: 'group', r: g });
    if (!collapsed.has(g.key)) for (const r of g.rows) lines.push({ kind: 'row', r, group: g.key });
  }
  lines.push({ kind: 'total', r: t.total }, { kind: 'income', r: t.income }, { kind: 'balance', r: t.balance });
  const heightOf = (k: string) => (k === 'group' ? H.group : k === 'row' ? H.row : H.total);

  const cell = (ln: (typeof lines)[number], v: number, i: number, rowMax: number) => {
    const isBal = ln.kind === 'balance';
    const a = isBal ? 0 : heat(v, rowMax) * (ln.kind === 'row' ? 0.55 : 0.4);
    const bg = isBal ? (v > 0 ? '#4ADE8022' : v < 0 ? '#F8717122' : 'transparent') : a > 0 ? ln.r.color + alpha(0.06 + a) : 'transparent';
    const fg = isBal ? (v > 0 ? '#4ADE80' : v < 0 ? '#F87171' : colors.text.muted) : v > 0 ? (ln.kind === 'row' ? colors.text.primary : colors.text.bright) : colors.ui.dim;
    const tappable = !isBal && v !== 0;
    const m = t.months[i];
    return (
      <TouchableOpacity key={i} disabled={!tappable} activeOpacity={0.6}
        onPress={() => { haptic.tap(); setDrill({ key: ln.r.key, label: ln.r.label, month: m.key, monthLabel: m.label }); }}
        style={[s.cell, { height: heightOf(ln.kind), backgroundColor: bg }, i === t.months.length - 1 && s.cellNow]}>
        <Text style={[s.cellTxt, { color: fg }, ln.kind !== 'row' && s.cellBold]} numberOfLines={1}>
          {v === 0 ? '–' : `${isBal && v > 0 ? '+' : ''}${money(v)}`}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Wróć">
          <ChevronLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Tabela wydatków</Text>
        <View style={s.periods}>
          {PERIODS.map((p) => (
            <TouchableOpacity key={p} onPress={() => { haptic.tap(); setN(p); }} style={[s.period, n === p && s.periodOn]}>
              <Text style={[s.periodTxt, n === p && s.periodTxtOn]}>{p} m</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body}>
        <View style={s.table}>
          {/* Stała kolumna nazw */}
          <View style={{ width: NAME_W }}>
            <View style={[s.nameCell, s.headCell, { height: H.head }]}><Text style={s.headTxt}>Kategoria</Text></View>
            {lines.map((ln) => (
              <TouchableOpacity key={ln.kind + ln.r.key} disabled={ln.kind !== 'group'} onPress={() => toggle(ln.r.key)} activeOpacity={0.7}
                style={[s.nameCell, { height: heightOf(ln.kind) }, ln.kind === 'group' && s.groupName, ln.kind === 'total' && s.totalTop]}>
                {ln.kind === 'group'
                  ? (collapsed.has(ln.r.key) ? <ChevronRight size={13} color={colors.text.muted} /> : <ChevronDown size={13} color={colors.text.muted} />)
                  : ln.kind === 'row' ? <View style={[s.dot, { backgroundColor: ln.r.color }]} /> : null}
                <Text style={[ln.kind === 'row' ? s.rowName : s.groupTxt, ln.kind === 'income' && { color: '#4ADE80' }]} numberOfLines={1}>{ln.r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Miesiące — poziomo */}
          {/* Start: bieżący miesiąc przy prawej krawędzi, średnia i suma dalej w prawo. */}
          <ScrollView ref={hScroll} horizontal showsHorizontalScrollIndicator
            onLayout={(e) => { viewW.current = e.nativeEvent.layout.width; position(); }}
            onContentSizeChange={(w) => { contentW.current = w; position(); }}>
            <View>
              <View style={[s.rowLine, { height: H.head }]}>
                {t.months.map((m, i) => (
                  <View key={m.key} style={[s.cell, s.headCell, { height: H.head }, i === t.months.length - 1 && s.cellNow]}>
                    <Text style={[s.headTxt, i === t.months.length - 1 && { color: colors.text.bright }]}>{m.label}</Text>
                  </View>
                ))}
                <View style={[s.cell, s.headCell, s.statCol, { height: H.head }]}><Text style={s.headTxt}>śr. / mies.</Text></View>
                <View style={[s.cell, s.headCell, s.statCol, { height: H.head }]}><Text style={s.headTxt}>suma</Text></View>
              </View>
              {lines.map((ln) => {
                const rowMax = Math.max(0, ...ln.r.values);
                return (
                  <View key={ln.kind + ln.r.key} style={[s.rowLine, ln.kind === 'group' && s.groupLine, ln.kind === 'total' && s.totalTop]}>
                    {ln.r.values.map((v, i) => cell(ln, v, i, rowMax))}
                    <View style={[s.cell, s.statCol, { height: heightOf(ln.kind) }]}>
                      <Text style={[s.cellTxt, s.statTxt]} numberOfLines={1}>{ln.r.avg ? money(ln.r.avg) : '–'}</Text>
                    </View>
                    <View style={[s.cell, s.statCol, { height: heightOf(ln.kind) }]}>
                      <Text style={[s.cellTxt, s.statTxt, s.cellBold]} numberOfLines={1}>{ln.r.total ? money(ln.r.total) : '–'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
        <Text style={s.note}>Kwoty w zł. Mocniejszy kolor = drożej niż w innych miesiącach tego wiersza. Stuknij grupę, żeby zwinąć; komórkę — żeby zobaczyć wydatki. Średnia liczy wszystkie pełne miesiące od początku danych — także te z zerem (np. gdy jecie zapasy kupione wcześniej).</Text>
      </ScrollView>

      <DrillSheet drill={drill} onClose={() => setDrill(null)} expenses={expenses} />
    </SafeAreaView>
  );
}

function amountFor(e: Expense, key: string): number {
  if (key === 'income') return e.type === 'income' && e.fvOverride !== 'transfer' ? e.amount : 0;
  return metricAmount(e, key as PaceKey);
}

function DrillSheet({ drill, onClose, expenses }: { drill: { key: string; label: string; month: string; monthLabel: string } | null; onClose: () => void; expenses: Expense[] }) {
  const s = makeS();
  const rows = useMemo(() => {
    if (!drill) return [];
    return expenses
      .filter((e) => (e.date ?? '').startsWith(drill.month))
      .map((e) => ({ e, amt: round2(amountFor(e, drill.key)) }))
      .filter((x) => x.amt > 0)
      .sort((a, b) => b.e.date.localeCompare(a.e.date) || b.amt - a.amt);
  }, [drill, expenses]);
  const sum = round2(rows.reduce((a, x) => a + x.amt, 0));
  return (
    <AppBottomSheet visible={!!drill} onClose={onClose} header={
      <View style={s.drillHead}>
        <Text style={s.drillTitle} numberOfLines={1}>{drill?.label} · {drill?.monthLabel}</Text>
        <Text style={s.drillSum}>{zl(sum)}</Text>
      </View>
    }>
      {rows.map(({ e, amt }) => (
        <View key={e.id} style={s.drillRow}>
          <Text style={s.drillDate}>{e.date.slice(8, 10)}.{e.date.slice(5, 7)}</Text>
          <Text style={s.drillName} numberOfLines={1}>{labelFor(e)}</Text>
          <Text style={s.drillAmt}>{zl(amt)}</Text>
        </View>
      ))}
      {rows.length === 0 && <Text style={s.note}>Brak wydatków.</Text>}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3], flexWrap: 'wrap' },
  title: { flex: 1, fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.bright },
  periods: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: radius.md, backgroundColor: c.ui.in },
  period: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm },
  periodOn: { backgroundColor: c.text.bright },
  periodTxt: { fontSize: 11.5, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  periodTxtOn: { color: c.bg.primary },
  body: { paddingHorizontal: spacing[3], paddingBottom: spacing[6] },
  table: { flexDirection: 'row', borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.ui.line, backgroundColor: c.bg.card },
  rowLine: { flexDirection: 'row' },
  groupLine: { backgroundColor: c.ui.in },
  totalTop: { borderTopWidth: 1, borderTopColor: c.border.default },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: c.ui.line, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.ui.line, backgroundColor: c.bg.card },
  groupName: { backgroundColor: c.ui.in },
  headCell: { backgroundColor: c.ui.in2, borderBottomWidth: 1, borderBottomColor: c.border.default },
  headTxt: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  groupTxt: { flex: 1, fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.text.bright },
  rowName: { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.text.primary },
  dot: { width: 7, height: 7, borderRadius: 4, marginLeft: 6 },
  cell: { width: COL_W, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 8, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.ui.line, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.ui.line },
  cellNow: { borderLeftWidth: 1, borderLeftColor: c.text.muted },
  cellTxt: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', fontVariant: ['tabular-nums'] },
  cellBold: { fontFamily: 'Inter_800ExtraBold' },
  statCol: { backgroundColor: c.ui.in, width: COL_W + 6 },
  statTxt: { color: c.text.secondary },
  note: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, lineHeight: 16, marginTop: spacing[3], paddingHorizontal: 4 },
  drillHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2], paddingBottom: spacing[2] },
  drillTitle: { flex: 1, fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.primary },
  drillSum: { fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.bright, fontVariant: ['tabular-nums'] },
  drillRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.ui.line },
  drillDate: { width: 42, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted, fontVariant: ['tabular-nums'] },
  drillName: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  drillAmt: { fontSize: 13.5, fontFamily: 'Inter_800ExtraBold', color: c.text.bright, fontVariant: ['tabular-nums'] },
}));
