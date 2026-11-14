import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ScrollView } from 'react-native';
import { X, Search, SlidersHorizontal } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import type { Expense } from '@/types/finances';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import NumberInput from '@/components/design/NumberInput';
import { haptic } from '@/utils/haptics';
import { pendingFxOf, formatFx } from '@/utils/fx';
import { filterTransactions, summarize, activeFilterCount, datePreset, EMPTY_FILTER, type TxFilter, type TxKind, type TxBucket } from '@/utils/txFilter';
import { EXPENSE_CATEGORIES } from '@/utils/expenseCategory';
import { toDisplayDate, parseDisplayDate, maskDateDigits } from '@/utils/dateInput';

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

const KINDS: { k: TxKind; label: string }[] = [{ k: 'all', label: 'Wszystkie' }, { k: 'expense', label: 'Wydatki' }, { k: 'income', label: 'Przychody' }];
const PRESETS: { p: 'thisMonth' | 'lastMonth' | 'days30' | 'thisYear'; label: string }[] = [
  { p: 'thisMonth', label: 'Ten miesiąc' }, { p: 'lastMonth', label: 'Poprzedni' }, { p: 'days30', label: '30 dni' }, { p: 'thisYear', label: 'Ten rok' },
];
const BUCKETS: { b: TxBucket; label: string }[] = [
  { b: 'food', label: 'Jedzenie' }, { b: 'fixed', label: 'Stałe' }, { b: 'variable', label: 'Zmienne' },
  ...EXPENSE_CATEGORIES.map((c) => ({ b: `cat:${c.tag}` as TxBucket, label: c.label })),
];
const zl = (n: number) => `${n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;

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
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const set = (patch: Partial<TxFilter>) => setF((cur) => ({ ...cur, ...patch }));

  const hits = useMemo(() => filterTransactions(expenses, f), [expenses, f]);
  const sum = useMemo(() => summarize(hits), [hits]);
  const nActive = activeFilterCount(f);
  const narrowed = nActive > 0 || f.query.trim().length > 0;

  const setDates = (from?: string, to?: string) => {
    set({ from, to });
    setFromText(from ? toDisplayDate(from) : '');
    setToText(to ? toDisplayDate(to) : '');
  };
  const presetOn = (p: typeof PRESETS[number]['p']) => { const r = datePreset(p); return f.from === r.from && f.to === r.to; };
  const clearAll = () => { haptic.tap(); setF({ ...EMPTY_FILTER, query: f.query }); setFromText(''); setToText(''); };

  const header = (
    <>
      <View style={s.header}>
        <Text style={s.title}>Transakcje</Text>
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
          <View style={[s.fRow, { marginTop: spacing[2] }]}>
            <TextInput value={fromText} onChangeText={(v) => { const t = maskDateDigits(v); setFromText(t); const iso = parseDisplayDate(t); set({ from: iso ?? undefined }); }}
              style={s.fInput} placeholder="od DD.MM.RRRR" placeholderTextColor={colors.text.muted} keyboardType="number-pad" />
            <Text style={s.dash}>–</Text>
            <TextInput value={toText} onChangeText={(v) => { const t = maskDateDigits(v); setToText(t); const iso = parseDisplayDate(t); set({ to: iso ?? undefined }); }}
              style={s.fInput} placeholder="do DD.MM.RRRR" placeholderTextColor={colors.text.muted} keyboardType="number-pad" />
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
    <AppBottomSheet visible={visible} onClose={onClose} header={header} scrollable={false} maxHeightRatio={0.9}>
      <FlatList
        style={s.list}
        data={hits}
        keyExtractor={(h) => h.e.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        windowSize={7}
        ListEmptyComponent={
          <Text style={s.empty}>{expenses.length === 0 ? 'Brak transakcji — dodaj pierwszą przyciskiem +.' : 'Brak wyników.'}</Text>
        }
        renderItem={({ item: { e, match } }) => (
          <TouchableOpacity style={s.row} onPress={() => { haptic.tap(); onSelect(e); }} activeOpacity={0.7}>
            <View style={s.rowInfo}>
              <Text style={s.rowNote} numberOfLines={1}>
                {e.storeName || e.note || (e.type === 'income' ? 'Przychód' : 'Wydatek')}
              </Text>
              <Text style={s.rowDate} numberOfLines={1}>{toDisplayDate(e.date.slice(0, 10))}{match ? ` · ${match}` : ''}</Text>
            </View>
            {pendingFxOf(e) ? (
              <View style={s.fxCol}>
                <Text style={s.fxAmount}>{formatFx(pendingFxOf(e)!)}</Text>
                <Text style={s.fxHint}>wpisz PLN</Text>
              </View>
            ) : (
              <Text style={[s.rowAmount, e.type === 'income' && s.rowAmountIncome]}>
                {e.type === 'income' ? '+' : '−'}{e.amount.toFixed(2)} zł
              </Text>
            )}
          </TouchableOpacity>
        )}
      />
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: spacing[3],
  },
  title: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.primary },
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

  list: { flexShrink: 1 },
  empty: { fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', paddingVertical: spacing[6] },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  rowInfo: { flex: 1, marginRight: spacing[2] },
  rowNote: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  rowDate: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
  rowAmount: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.text.bright },
  rowAmountIncome: { color: c.accent.green },
  fxCol: { alignItems: 'flex-end' },
  fxAmount: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.accent.red },
  fxHint: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.accent.red, opacity: 0.8 },
}));
