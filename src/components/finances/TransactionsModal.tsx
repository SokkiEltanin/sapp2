import { saveTextFile } from '@/services/localBackup';
import { transactionsCsv, csvFileName } from '@/utils/csvExport';
import { logError } from '@/services/errorLog';
import { useMemo, useState, useRef, useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ScrollView, type ViewToken } from 'react-native';
import { X, Search, SlidersHorizontal, FileDown } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import type { Expense } from '@/types/finances';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import NumberInput from '@/components/design/NumberInput';
import { haptic } from '@/utils/haptics';
import { pendingFxOf, formatFx } from '@/utils/fx';
import { filterTransactions, summarize, activeFilterCount, datePreset, EMPTY_FILTER, type TxFilter, type TxKind, type TxBucket, type TxHit } from '@/utils/txFilter';
import { EXPENSE_CATEGORIES } from '@/utils/expenseCategory';
import { toDisplayDate } from '@/utils/dateInput';
import RangeCalendar from '@/components/design/RangeCalendar';
import { groupTransactions, txDetail, txColor, bucketLabel, type GroupMode } from '@/utils/txGroup';
import { zl } from '@/utils/money';

// Pełna lista transakcji (Faza 2.4, 2026-11-01) — "Ostatnie transakcje" na ekranie
// Finanse pokazuje kilka pozycji, tu żyje reszta. `onSelect` NIE zamyka tego modala
// (po edycji user wraca tu, do listy).
//
// Szukanie i filtry (2026-11-14, user: "szukanie lepsze i filtrowanie po rodzaju —
// wydatek czy przychód, cena od do, data"): szukajka łapie też pozycje paragonu
// ("gouda" → paragon z Lidla) i kwotę ("12,50"); pod nią Wszystkie/Wydatki/Przychody
// i zwinięte "Filtry" (kwota od–do, data: szybkie zakresy albo od–do, rodzaj:
// jedzenie/stałe/zmienne/kategoria). Logika: utils/txFilter.ts. Pod filtrami
// podsumowanie wyników (ile, suma wydatków, suma przychodów).
// FlatList (`scrollable={false}`) — lista bywa długa i ma własny scroll.

const KINDS: { k: TxKind; label: string }[] = [{ k: 'all', label: 'Wszystkie' }, { k: 'expense', label: 'Wydatki' }, { k: 'income', label: 'Przychody' }, { k: 'own', label: 'Własne' }];
const PRESETS: { p: 'thisMonth' | 'lastMonth' | 'days30' | 'thisYear'; label: string }[] = [
  { p: 'thisMonth', label: 'Ten miesiąc' }, { p: 'lastMonth', label: 'Poprzedni' }, { p: 'days30', label: '30 dni' }, { p: 'thisYear', label: 'Ten rok' },
];
const BUCKETS: { b: TxBucket; label: string }[] = [
  { b: 'food', label: 'Jedzenie' }, { b: 'fixed', label: 'Stałe' }, { b: 'variable', label: 'Zmienne' },
  ...EXPENSE_CATEGORIES.map((c) => ({ b: `cat:${c.tag}` as TxBucket, label: c.label })),
];

export default function TransactionsModal({
  visible, onClose, expenses, onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  expenses: Expense[];
  onSelect: (e: Expense) => void;
}) {
  const s = makeS();
  const [f, setF] = useState<TxFilter>(EMPTY_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const set = (patch: Partial<TxFilter>) => setF((cur) => ({ ...cur, ...patch }));

  const hits = useMemo(() => filterTransactions(expenses, f), [expenses, f]);
  // Grupy (2026-11-17): domyślnie dni; nagłówek grupy z sumą, wiersz z detalami paragonu.
  const [mode, setMode] = useState<GroupMode>('day');
  const rows = useMemo(() => {
    const out: ({ t: 'h'; key: string; label: string; out: number; in: number; n: number } | { t: 'r'; key: string; hit: (typeof hits)[number] })[] = [];
    for (const g of groupTransactions(hits, mode)) {
      out.push({ t: 'h', key: `h_${g.key}`, label: g.label, out: g.out, in: g.in, n: g.hits.length });
      for (const h of g.hits) out.push({ t: 'r', key: h.e.id, hit: h });
    }
    return out;
  }, [hits, mode]);
  // Nagłówek "przyklejony" (2026-11-18, user: "przy szybkim scrollu miga data na pasku, a pod
  // spodem pusto"): stickyHeaderIndices z setkami nagłówków na Androidzie dławi listę (każdy
  // nagłówek to animowany transform) i wirtualizacja nie nadąża — zostawał sam pasek nad
  // pustką. Teraz JEDEN nakładany pasek nad listą, podmieniany wg pierwszego widocznego wiersza.
  const headOf = useMemo(() => {
    const out: number[] = []; let h = -1;
    rows.forEach((r, i) => { if (r.t === 'h') h = i; out.push(h); });
    return out;
  }, [rows]);
  const [topHead, setTopHead] = useState<number>(-1);
  const rowsRef = useRef(rows); rowsRef.current = rows;
  const headOfRef = useRef(headOf); headOfRef.current = headOf;
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.index != null);
    if (first?.index == null) return;
    const i = first.index;
    // nagłówek grupy sam jest na górze → bez nakładki (nie dublujemy)
    // …albo ostatni wiersz grupy (zaraz wjedzie następny nagłówek — dwa paski jeden pod drugim)
    const r = rowsRef.current;
    const h = r[i]?.t === 'h' || r[i + 1]?.t === 'h' ? -1 : headOfRef.current[i] ?? -1;
    setTopHead((cur) => (cur === h ? cur : h));
  }).current;
  const viewCfg = useRef({ itemVisiblePercentThreshold: 50, minimumViewTime: 0 }).current;
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const select = useCallback((e: Expense) => onSelectRef.current(e), []);
  const sum = useMemo(() => summarize(hits), [hits]);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const exportCsv = async () => {
    if (!hits.length || exporting) return;
    haptic.tap();
    setExporting(true);
    try {
      const where = await saveTextFile(csvFileName(new Date()), transactionsCsv(hits.map((h) => h.e)), 'text/csv');
      if (where) { haptic.success(); setExported('zapisano'); setTimeout(() => setExported(null), 2500); }
    } catch (e) {
      logError('eksport CSV', e);
      setExported('błąd');
      setTimeout(() => setExported(null), 2500);
    } finally {
      setExporting(false);
    }
  };
  const nActive = activeFilterCount(f);
  const narrowed = nActive > 0 || f.query.trim().length > 0;

  const setDates = (from?: string, to?: string) => set({ from, to });
  const presetOn = (p: typeof PRESETS[number]['p']) => { const r = datePreset(p); return f.from === r.from && f.to === r.to; };
  const clearAll = () => { haptic.tap(); setF({ ...EMPTY_FILTER, query: f.query }); };

  const header = (
    <>
      <View style={s.header}>
        <Text style={s.title}>Transakcje</Text>
        {/* Eksport tego, co widać po filtrach (2026-11-14) — CSV pod polskiego Excela. */}
        <TouchableOpacity onPress={exportCsv} hitSlop={8} style={s.csvBtn} disabled={!hits.length || exporting} accessibilityLabel="Eksport do CSV">
          <FileDown size={15} color={hits.length ? colors.text.secondary : colors.text.muted} />
          <Text style={[s.csvLabel, !hits.length && { color: colors.text.muted }]}>{exporting ? '…' : exported ?? 'CSV'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { haptic.tap(); onClose(); }} hitSlop={8} style={s.closeBtn}>
          <X size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
      <View style={s.searchRow}>
        <Search size={15} color={colors.text.muted} />
        <TextInput
          value={f.query}
          onChangeText={(query) => set({ query })}
          placeholder="Sklep, produkt, notatka, tag, kwota…"
          placeholderTextColor={colors.text.muted}
          style={s.searchInput}
          autoCorrect={false}
        />
        {f.query.length > 0 && (
          <TouchableOpacity onPress={() => set({ query: '' })} hitSlop={8}><X size={14} color={colors.text.muted} /></TouchableOpacity>
        )}
      </View>

      <View style={s.kindRow}>
        <View style={s.seg}>
          {KINDS.map((k) => (
            <TouchableOpacity key={k.k} style={[s.segItem, f.kind === k.k && s.segOn]} onPress={() => { haptic.tap(); set({ kind: k.k }); }} activeOpacity={0.8}>
              <Text style={[s.segLabel, f.kind === k.k && s.segLabelOn]}>{k.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[s.filterBtn, (filtersOpen || nActive - (f.kind !== 'all' ? 1 : 0) > 0) && s.filterBtnOn]} onPress={() => { haptic.tap(); setFiltersOpen((v) => !v); }} accessibilityLabel="Filtry">
          <SlidersHorizontal size={15} color={filtersOpen ? colors.bg.primary : colors.text.primary} />
          {nActive - (f.kind !== 'all' ? 1 : 0) > 0 && <Text style={[s.filterCount, filtersOpen && { color: colors.bg.primary }]}>{nActive - (f.kind !== 'all' ? 1 : 0)}</Text>}
        </TouchableOpacity>
      </View>

      {filtersOpen && (
        <View style={s.filters}>
          <Text style={s.fLabel}>Kwota (zł)</Text>
          <View style={s.fRow}>
            <NumberInput value={f.min} onChangeValue={(min) => set({ min })} style={s.fInput} placeholder="od" placeholderTextColor={colors.text.muted} />
            <Text style={s.dash}>–</Text>
            <NumberInput value={f.max} onChangeValue={(max) => set({ max })} style={s.fInput} placeholder="do" placeholderTextColor={colors.text.muted} />
          </View>

          <Text style={[s.fLabel, s.fGap]}>Data</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">
            {PRESETS.map((p) => {
              const on = presetOn(p.p);
              return (
                <TouchableOpacity key={p.p} style={[s.chip, on && s.chipOn]} onPress={() => { haptic.tap(); if (on) setDates(); else { const r = datePreset(p.p); setDates(r.from, r.to); } }}>
                  <Text style={[s.chipLabel, on && s.chipLabelOn]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Kalendarz zamiast wpisywania (2026-11-16, user: "wpisałem i nic nie zrobiło"):
              1. stuknięcie = ten dzień, 2. = koniec zakresu; filtruje od razu. */}
          <View style={[s.fRow, { marginTop: spacing[2] }]}>
            <Text style={s.rangeTxt}>{f.from ? (f.to && f.to !== f.from ? `${toDisplayDate(f.from)} – ${toDisplayDate(f.to)}` : toDisplayDate(f.from)) : 'Cały okres'}</Text>
            {(f.from || f.to) && (
              <TouchableOpacity onPress={() => { haptic.tap(); setDates(); }} hitSlop={8}>
                <Text style={s.rangeClear}>wyczyść</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={s.cal}>
            <RangeCalendar key={f.to ?? ''} from={f.from} to={f.to} onChange={(from, to) => setDates(from, to)} />
          </View>

          <Text style={[s.fLabel, s.fGap]}>Rodzaj</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">
            {BUCKETS.map((b) => {
              const on = f.bucket === b.b;
              return (
                <TouchableOpacity key={b.b} style={[s.chip, on && s.chipOn]} onPress={() => { haptic.tap(); set({ bucket: on ? undefined : b.b }); }}>
                  <Text style={[s.chipLabel, on && s.chipLabelOn]}>{b.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={s.modeRow}>
        {([['day', 'Dni'], ['week', 'Tygodnie'], ['month', 'Miesiące'], ['year', 'Lata']] as const).map(([k, l]) => (
          <TouchableOpacity key={k} style={[s.modeChip, mode === k && s.modeChipOn]} onPress={() => { haptic.tap(); setMode(k); }}>
            <Text style={[s.modeTxt, mode === k && s.modeTxtOn]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {narrowed && (
        <View style={s.sumRow}>
          <Text style={s.sumText} numberOfLines={1}>
            {sum.count} {sum.count === 1 ? 'transakcja' : sum.count % 10 >= 2 && sum.count % 10 <= 4 && !(sum.count % 100 >= 12 && sum.count % 100 <= 14) ? 'transakcje' : 'transakcji'}
            {sum.out > 0 ? <Text style={s.sumOut}>{`  −${zl(sum.out)}`}</Text> : null}
            {sum.in > 0 ? <Text style={s.sumIn}>{`  +${zl(sum.in)}`}</Text> : null}
          </Text>
          {nActive > 0 && <TouchableOpacity onPress={clearAll} hitSlop={8}><Text style={s.clear}>wyczyść</Text></TouchableOpacity>}
        </View>
      )}
    </>
  );

  return (
    <AppBottomSheet fixedHeight visible={visible} onClose={onClose} header={header} scrollable={false} maxHeightRatio={0.9}>
      <View style={s.listWrap}>
      <FlatList
        style={s.list}
        data={rows}
        keyExtractor={(r) => r.key}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={30}
        maxToRenderPerBatch={30}
        updateCellsBatchingPeriod={16}
        windowSize={15}
        removeClippedSubviews={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={viewCfg}
        ListEmptyComponent={
          <Text style={s.empty}>{expenses.length === 0 ? 'Brak transakcji — dodaj pierwszą przyciskiem +.' : 'Brak wyników.'}</Text>
        }
        renderItem={({ item }) => (item.t === 'h' ? <GroupHead item={item} /> : <TxRow hit={item.hit} mode={mode} onSelect={select} />)}
      />
      {topHead >= 0 && rows[topHead]?.t === 'h' && (
        <View style={s.overlay} pointerEvents="none"><GroupHead item={rows[topHead] as GroupItem} /></View>
      )}
      </View>
    </AppBottomSheet>
  );
}

type GroupItem = { t: 'h'; key: string; label: string; out: number; in: number; n: number };

// Nagłówek grupy (2026-11-17, user: "kwoty się zlewają, nieczytelne"): osobny jaśniejszy
// pasek — etykieta + liczba po lewej, sumy po prawej; wiersze pod nim lżejsze.
const GroupHead = memo(function GroupHead({ item }: { item: GroupItem }) {
  const s = makeS();
  return (
    <View style={s.gHead}>
      <View style={s.gBox}>
        <Text style={s.gLabel} numberOfLines={1}>
          {item.label.charAt(0).toUpperCase() + item.label.slice(1)}
          <Text style={s.gN}>{`  ${item.n} ${plTx(item.n)}`}</Text>
        </Text>
        {item.in > 0 ? <Text style={[s.gSum, s.gIn]} numberOfLines={1}>+{zl(item.in)}</Text> : null}
        {item.out > 0 ? <Text style={s.gSum} numberOfLines={1}>−{zl(item.out)}</Text> : null}
      </View>
    </View>
  );
});

const TxRow = memo(function TxRow({ hit, mode, onSelect }: { hit: TxHit; mode: GroupMode; onSelect: (e: Expense) => void }) {
  const s = makeS();
  const { e, match } = hit;
  const detail = txDetail(e);
  const time = (e.date ?? '').length > 10 ? e.date.slice(11, 16) : '';
  const when = mode === 'day' ? time : `${toDisplayDate(e.date.slice(0, 10)).slice(0, 5)}${time ? ` ${time}` : ''}`;
  const sub = [bucketLabel(e), when, detail, e.fvOverride === 'transfer' ? 'przelew własny' : '', match ? `„${match}”` : ''].filter(Boolean).join(' · ');
  return (
    // Łuk koloru po lewym rogu jak w Zadaniach i Ostatnich transakcjach (2026-11-25).
    <View style={s.rowOuter}>
    <View style={[s.rowEdge, { backgroundColor: txColor(e) }]} pointerEvents="none" />
    <TouchableOpacity style={s.row} onPress={() => { haptic.tap(); onSelect(e); }} activeOpacity={0.7}>
      <View style={s.rowInfo}>
        <View style={s.rowTop}>
          <Text style={s.rowNote} numberOfLines={1}>
            {e.storeName || e.note || (e.fvOverride === 'transfer' ? 'Przelew własny' : e.type === 'income' ? 'Przychód' : 'Wydatek')}
          </Text>
          {pendingFxOf(e) ? (
            <Text style={s.fxAmount}>{formatFx(pendingFxOf(e)!)} · wpisz PLN</Text>
          ) : (
            <Text style={[s.rowAmount, e.type === 'income' && s.rowAmountIncome, e.fvOverride === 'transfer' && { color: colors.text.muted }]}>
              {e.type === 'income' ? '+' : '−'}{zl(Math.abs(e.amount))}
            </Text>
          )}
        </View>
        {sub ? (
          <View style={s.subRow}>
            {bucketLabel(e) ? <View style={s.pin} /> : null}
            <Text style={[s.rowSub, { flex: 1 }]} numberOfLines={1}>{sub}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
    </View>
  );
});

const plTx = (n: number) => (n === 1 ? 'transakcja' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'transakcje' : 'transakcji');

const makeS = themedStyles((c) => StyleSheet.create({
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pin: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.text.bright },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: spacing[3],
  },
  title: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.primary },
  csvBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', marginRight: spacing[3], paddingHorizontal: spacing[2], paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border.default },
  csvLabel: { fontSize: 11.5, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginBottom: spacing[2],
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.primary },

  kindRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  seg: { flex: 1, flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, overflow: 'hidden' },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  segOn: { backgroundColor: c.text.bright },
  segLabel: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  segLabelOn: { color: c.bg.primary },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  filterBtnOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  filterCount: { fontSize: 11, fontFamily: 'Inter_900Black', color: c.text.primary },

  filters: { backgroundColor: c.ui.in, borderRadius: radius.lg, padding: spacing[3], marginBottom: spacing[2] },
  fLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  fGap: { marginTop: spacing[3] },
  fRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  rangeTxt: { flex: 1, fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  rangeClear: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.muted },
  cal: { marginTop: spacing[2], padding: spacing[2], borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  fInput: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: 7, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  dash: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.muted },
  chips: { gap: spacing[2], paddingTop: spacing[2] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  chipOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  chipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  chipLabelOn: { color: c.bg.primary },

  sumRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingBottom: spacing[2] },
  sumText: { flex: 1, fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  sumOut: { color: c.text.bright },
  sumIn: { color: c.accent.green },
  clear: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.muted, textDecorationLine: 'underline' },

  listWrap: { flexShrink: 1, minHeight: 0 },
  list: { flexShrink: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  empty: { fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', paddingVertical: spacing[6] },

  rowOuter: { borderRadius: radius.md, overflow: 'hidden', marginVertical: 3 },
  rowEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 30 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 9, paddingHorizontal: 12, marginLeft: 4, borderRadius: radius.md, backgroundColor: c.ui.in2 },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[3] },
  rowNote: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  rowSub: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
  gHead: { paddingTop: spacing[3], paddingBottom: 4, backgroundColor: c.bg.card },
  gBox: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: c.ui.in2, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9 },
  gLabel: { flex: 1, fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.bright },
  gSum: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.bright, fontVariant: ['tabular-nums'] },
  gIn: { color: c.accent.green },
  gN: { fontSize: 11.5, color: c.text.muted, fontFamily: 'Inter_600SemiBold' },
  modeRow: { flexDirection: 'row', gap: 6, marginBottom: spacing[2] },
  modeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  modeChipOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  modeTxt: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  modeTxtOn: { color: c.bg.primary },
  rowAmount: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: c.text.secondary, fontVariant: ['tabular-nums'] },
  rowAmountIncome: { color: c.accent.green },
  fxAmount: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.accent.red },
}));
