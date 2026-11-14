import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { X, Search, ChevronDown, ChevronUp, GitMerge } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { useExpensesStore } from '@/store/expensesStore';
import { useDeferredMemo } from '@/hooks/useDeferredMemo';
import { buildProductCatalog, findDuplicateCandidates, type ProductCatalogEntry } from '@/utils/productCatalog';
import { loadNameAliases, saveNameAliases, saveFoodSubcatMemory, loadWeightMemory, saveWeightMemory, parseWeightFromName, weightFor, type WeightMemory } from '@/utils/productMemory';
import { productStats, topProductsByKg, fmtKg } from '@/utils/productStats';
import { useCategoriesVersion } from '@/store/categoriesStore';
import NumberInput from '@/components/design/NumberInput';
import { FOOD_SUBCATS, FOOD_SUBCAT_META } from '@/utils/food';
import { haptic } from '@/utils/haptics';
import AppBottomSheet from '@/components/design/AppBottomSheet';

// Faza 2.3 (2026-11-01) — "jak złapie źle... wejść w produkty i edytować, ale dużo
// ładniej zrobione niż w SAPie". Brak osobnego store'u "Produkty" — katalog jest
// WIDOKIEM agregowanym z historii `Expense.receiptItems` (`productCatalog.ts`),
// edycja (zmiana nazwy/kategorii) zapisuje się do istniejącej pamięci
// (`productMemory.ts`: aliasy nazw, pamięć podkategorii jedzenia), NIE przepisuje
// historycznych wydatków — przyszłe paragony i widok tego katalogu od razu
// korzystają z poprawki, stare dane zostają jako były (audyt/historia nietknięta).
// UI karty-wiersze (jak TaskRow), nie ciasny centered-modal sapp's `products.tsx`.
//
// Przebudowany na `AppBottomSheet` (2026-11-02, kontynuacja migracji z Faza 3.6) —
// tytuł+szukajka jako `header` (nieruchome, ten sam wzorzec co TransactionsModal),
// duplikaty+lista produktów jako scrollowalna treść.
export default function ProductsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const expenses = useExpensesStore((st) => st.expenses);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  useCategoriesVersion(); // nazwy/kolory kategorii z Ustawień
  // Waga produktów (2026-11-14): pamięć wag sztuk + statystyki ilości.
  const [weights, setWeights] = useState<WeightMemory>({});
  const [unitGrams, setUnitGrams] = useState<number | undefined>(undefined);
  // Wydajność: setki kart naraz = przycinka przy otwieraniu → po 50, reszta na żądanie.
  const PAGE = 50;
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    if (visible) { loadNameAliases().then(setAliases); loadWeightMemory().then(setWeights); setShown(PAGE); }
  }, [visible]);

  const catalog = useMemo(() => buildProductCatalog(expenses, aliases), [expenses, aliases]);
  // Duplikaty (porównanie każdego z każdym) liczone PO animacji otwarcia.
  const allDuplicates = useDeferredMemo(() => findDuplicateCandidates(catalog), [catalog], [] as ReturnType<typeof findDuplicateCandidates>);
  const duplicates = useMemo(() => {
    const pairKey = (a: ProductCatalogEntry, b: ProductCatalogEntry) => `${a.groupKey}|${b.groupKey}`;
    return allDuplicates.filter((d) => !dismissed.has(pairKey(d.a, d.b)));
  }, [allDuplicates, dismissed]);

  // "Ile czego kupujesz" — jedno przejście po wydatkach, po animacji otwarcia.
  const top = useDeferredMemo(() => topProductsByKg(expenses, aliases, weights), [expenses, aliases, weights], [] as ReturnType<typeof topProductsByKg>);
  const labelOf = useMemo(() => new Map(catalog.map((c) => [c.groupKey, c.label])), [catalog]);
  // Statystyki TYLKO rozwiniętego produktu.
  const expandedStats = useMemo(
    () => (expandedKey ? productStats(expenses, expandedKey, aliases, weights) : null),
    [expandedKey, expenses, aliases, weights],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((e) => e.label.toLowerCase().includes(q));
  }, [catalog, search]);

  const refreshAliases = () => loadNameAliases().then(setAliases);

  const dismissPair = (a: ProductCatalogEntry, b: ProductCatalogEntry) => {
    setDismissed((prev) => new Set(prev).add(`${a.groupKey}|${b.groupKey}`));
  };

  const mergeInto = async (keep: ProductCatalogEntry, drop: ProductCatalogEntry) => {
    haptic.success();
    const products = drop.rawNames.map((name) => ({ name }));
    const edited = Object.fromEntries(drop.rawNames.map((_, i) => [i, keep.label]));
    await saveNameAliases(products, edited);
    dismissPair(keep, drop);
    refreshAliases();
  };

  const openEdit = (entry: ProductCatalogEntry) => {
    setExpandedKey((cur) => (cur === entry.groupKey ? null : entry.groupKey));
    setEditName(entry.label);
    const known = entry.rawNames.map((n) => weightFor(n, weights)).find((v) => v != null);
    setUnitGrams(known != null ? Math.round(known * 1000) : undefined);
  };

  const saveUnitWeight = async (entry: ProductCatalogEntry) => {
    if (!unitGrams || unitGrams <= 0) return;
    haptic.success();
    await saveWeightMemory(entry.rawNames.map((name) => ({ name, kg: unitGrams / 1000 })));
    setWeights(await loadWeightMemory());
  };

  const saveName = async (entry: ProductCatalogEntry) => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== entry.label) {
      const products = entry.rawNames.map((name) => ({ name }));
      const edited = Object.fromEntries(entry.rawNames.map((_, i) => [i, trimmed]));
      await saveNameAliases(products, edited);
      refreshAliases();
    }
    setExpandedKey(null);
  };

  const setSubcat = async (entry: ProductCatalogEntry, tag: string | undefined) => {
    await saveFoodSubcatMemory(entry.rawNames.map((name) => ({ name, foodSubcat: tag })));
    refreshAliases(); // aliasy się nie zmieniły, ale katalog i tak przeliczy się z expenses — no-op bezpieczny
  };

  const header = (
    <>
      <View style={s.header}>
        <Text style={s.title}>Produkty</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} style={s.closeBtn}>
          <X size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={s.searchRow}>
        <Search size={14} color={colors.text.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Szukaj produktu…"
          placeholderTextColor={colors.text.muted}
          style={s.searchInput}
        />
      </View>
    </>
  );

  return (
    <AppBottomSheet visible={visible} onClose={onClose} header={header}>
      {duplicates.length > 0 && (
        <View style={s.dupeSection}>
          <TouchableOpacity style={s.dupeHeader} onPress={() => setDuplicatesOpen((v) => !v)} activeOpacity={0.7}>
            <GitMerge size={14} color={colors.text.bright} />
            <Text style={s.dupeHeaderLabel}>Możliwe duplikaty ({duplicates.length})</Text>
            {duplicatesOpen ? <ChevronUp size={14} color={colors.text.muted} /> : <ChevronDown size={14} color={colors.text.muted} />}
          </TouchableOpacity>
          {duplicatesOpen && duplicates.map(({ a, b }) => (
            <View key={`${a.groupKey}|${b.groupKey}`} style={s.dupeRow}>
              <Text style={s.dupeQuestion}>Czy to ten sam produkt?</Text>
              <Text style={s.dupeNames}>„{a.label}” i „{b.label}”</Text>
              <View style={s.dupeActions}>
                <TouchableOpacity style={s.dupeBtnSecondary} onPress={() => dismissPair(a, b)}>
                  <Text style={s.dupeBtnSecondaryLabel}>To różne</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.dupeBtnPrimary} onPress={() => mergeInto(a, b)}>
                  <Text style={s.dupeBtnPrimaryLabel}>Połącz</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {!search && top.length > 0 && (
        <View style={s.topCard}>
          <Text style={s.topTitle}>Najwięcej kupujesz · średnio na miesiąc</Text>
          {top.map((t) => (
            <TouchableOpacity key={t.groupKey} style={s.topRow} activeOpacity={0.7}
              onPress={() => { const e = catalog.find((c) => c.groupKey === t.groupKey); if (e) { setSearch(e.label); openEdit(e); } }}>
              <Text style={s.topName} numberOfLines={1}>{labelOf.get(t.groupKey) ?? t.groupKey}</Text>
              <Text style={s.topVal}>{fmtKg(t.kgPerMonth, t.liquid)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {filtered.length === 0 ? (
        <Text style={s.empty}>
          {catalog.length === 0 ? 'Brak produktów — pojawią się tu po pierwszym paragonie z pozycjami.' : 'Nic nie znaleziono.'}
        </Text>
      ) : (
        filtered.slice(0, search ? filtered.length : shown).map((entry) => {
          const meta = entry.foodSubcat ? FOOD_SUBCAT_META[entry.foodSubcat] : undefined;
          const expanded = expandedKey === entry.groupKey;
          return (
            <View key={entry.groupKey} style={s.card}>
              <TouchableOpacity style={s.cardRow} onPress={() => openEdit(entry)} activeOpacity={0.7}>
                <View style={s.cardInfo}>
                  <Text style={s.cardLabel} numberOfLines={1}>{entry.label}</Text>
                  <Text style={s.cardStats}>
                    {entry.timesBought}× · ostatnio {entry.lastPrice.toFixed(2)} zł · razem {entry.totalSpent.toFixed(2)} zł
                  </Text>
                </View>
                <View style={[s.subcatChip, meta && { backgroundColor: meta.color + '2A', borderColor: meta.color }]}>
                  <Text style={[s.subcatChipLabel, meta && { color: meta.color }]}>{meta?.label ?? 'Nie-jedzenie'}</Text>
                </View>
              </TouchableOpacity>

              {expanded && (
                <View style={s.editArea}>
                  {expandedStats && expandedStats.purchases > 0 && (() => {
                    const st = expandedStats;
                    const maxKg = Math.max(...st.months.map((m) => m.kg), 0.001);
                    const maxCnt = Math.max(...st.months.map((m) => m.count), 1);
                    const useKg = st.knownKg > 0;
                    return (
                      <View style={s.statBox}>
                        <View style={s.statRow}>
                          <View style={s.statCell}><Text style={s.statVal}>{st.kgPerMonth != null ? fmtKg(st.kgPerMonth, st.liquid) : '—'}</Text><Text style={s.statKey}>na miesiąc</Text></View>
                          <View style={s.statCell}><Text style={s.statVal}>{st.gPerWeek != null ? fmtKg(st.gPerWeek / 1000, st.liquid) : '—'}</Text><Text style={s.statKey}>na tydzień</Text></View>
                          <View style={s.statCell}><Text style={s.statVal}>{st.pricePerKg != null ? `${st.pricePerKg.toFixed(0)} zł` : '—'}</Text><Text style={s.statKey}>{st.liquid ? 'za litr' : 'za kg'}</Text></View>
                          <View style={s.statCell}><Text style={s.statVal}>{st.spentPerMonth} zł</Text><Text style={s.statKey}>mies.</Text></View>
                        </View>
                        <View style={s.bars}>
                          {st.months.map((m) => (
                            <View key={m.key} style={s.barCol}>
                              <Text style={s.barVal}>{useKg ? (m.kg > 0 ? fmtKg(m.kg, st.liquid) : '') : (m.count || '')}</Text>
                              <View style={s.barBox}>
                                {(useKg ? m.kg : m.count) > 0 && <View style={[s.bar, { height: `${((useKg ? m.kg / maxKg : m.count / maxCnt) * 100)}%` }]} />}
                              </View>
                              <Text style={s.barLabel}>{m.label}</Text>
                            </View>
                          ))}
                        </View>
                        {st.coverage < 1 && (
                          <Text style={s.statHint}>
                            {useKg ? `Waga znana dla ${Math.round(st.coverage * 100)}% zakupów.` : 'Brak wagi w nazwie — wpisz wagę sztuki niżej, żeby liczyć kg.'}
                          </Text>
                        )}
                      </View>
                    );
                  })()}

                  <Text style={s.editLabel}>Nazwa</Text>
                  <View style={s.editNameRow}>
                    <TextInput value={editName} onChangeText={setEditName} style={s.editNameInput} />
                    <TouchableOpacity style={s.editSaveBtn} onPress={() => saveName(entry)}>
                      <Text style={s.editSaveLabel}>Zapisz</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[s.editLabel, s.editLabelGap]}>Kategoria jedzenia</Text>
                  <View style={s.pickerWrap}>
                    <TouchableOpacity
                      style={[s.pickerChip, !entry.foodSubcat && s.pickerChipActive]}
                      onPress={() => setSubcat(entry, undefined)}
                    >
                      <Text style={s.pickerChipLabel}>Brak</Text>
                    </TouchableOpacity>
                    {FOOD_SUBCATS.map((sc) => (
                      <TouchableOpacity
                        key={sc.tag}
                        style={[s.pickerChip, entry.foodSubcat === sc.tag && { backgroundColor: sc.color }]}
                        onPress={() => setSubcat(entry, sc.tag)}
                      >
                        <Text style={[s.pickerChipLabel, entry.foodSubcat === sc.tag && s.pickerChipLabelActive]}>{sc.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {(() => {
                    const fromName = entry.rawNames.map((n) => parseWeightFromName(n)).find((v) => v != null);
                    if (fromName != null) return <Text style={s.rawNamesHint}>Waga z nazwy: {fmtKg(fromName)} / szt.</Text>;
                    return (
                      <>
                        <Text style={[s.editLabel, s.editLabelGap]}>Waga 1 szt. (g)</Text>
                        <View style={s.editNameRow}>
                          <NumberInput value={unitGrams} onChangeValue={setUnitGrams} style={s.editNameInput} placeholder="np. 150" placeholderTextColor={colors.text.muted} />
                          <TouchableOpacity style={[s.editSaveBtn, !(unitGrams && unitGrams > 0) && { opacity: 0.4 }]} onPress={() => saveUnitWeight(entry)} disabled={!(unitGrams && unitGrams > 0)}>
                            <Text style={s.editSaveLabel}>Zapisz</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    );
                  })()}

                  {entry.rawNames.length > 1 && (
                    <Text style={s.rawNamesHint}>Scalone nazwy: {entry.rawNames.join(', ')}</Text>
                  )}
                </View>
              )}
            </View>
          );
        })
      )}
      {!search && filtered.length > shown && (
        <TouchableOpacity style={s.moreBtn} onPress={() => { haptic.tap(); setShown((n) => n + PAGE); }} activeOpacity={0.7}>
          <Text style={s.moreLabel}>Pokaż więcej ({filtered.length - shown})</Text>
        </TouchableOpacity>
      )}
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
    marginBottom: spacing[1],
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3],
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.primary, paddingVertical: spacing[2] },

  empty: { fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', paddingVertical: spacing[6] },

  dupeSection: {
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    marginBottom: spacing[3], overflow: 'hidden',
  },
  dupeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[3] },
  dupeHeaderLabel: { flex: 1, fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.text.bright },
  dupeRow: { padding: spacing[3], borderTopWidth: 1, borderTopColor: c.border.subtle, gap: spacing[1] },
  dupeQuestion: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted },
  dupeNames: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  dupeActions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
  dupeBtnSecondary: { flex: 1, paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: c.bg.elevated, alignItems: 'center' },
  dupeBtnSecondaryLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  dupeBtnPrimary: { flex: 1, paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: c.text.bright, alignItems: 'center' },
  dupeBtnPrimaryLabel: { fontSize: 11.5, fontFamily: 'Inter_900Black', color: c.bg.primary },

  card: {
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    marginBottom: spacing[2], overflow: 'hidden',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[3] },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  cardStats: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
  subcatChip: {
    paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.sm,
    backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default,
  },
  subcatChipLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted },

  editArea: { padding: spacing[3], borderTopWidth: 1, borderTopColor: c.border.subtle, gap: spacing[2] },
  editLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  editLabelGap: { marginTop: spacing[1] },
  editNameRow: { flexDirection: 'row', gap: spacing[2] },
  editNameInput: {
    flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.primary,
    backgroundColor: c.bg.elevated, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: spacing[1],
  },
  editSaveBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.sm, backgroundColor: c.text.bright, justifyContent: 'center' },
  editSaveLabel: { fontSize: 11.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
  pickerChip: {
    backgroundColor: c.bg.elevated, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 6,
  },
  pickerChipActive: { backgroundColor: c.text.bright },
  pickerChipLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  pickerChipLabelActive: { color: c.bg.primary },
  rawNamesHint: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[1] },
  topCard: { backgroundColor: c.ui.in, borderRadius: radius.lg, padding: spacing[3], marginBottom: spacing[3], gap: 6 },
  topTitle: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  topRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  topName: { flex: 1, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  topVal: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.text.secondary, fontVariant: ['tabular-nums'] },
  statBox: { backgroundColor: c.ui.in, borderRadius: radius.md, padding: spacing[3], marginBottom: spacing[3] },
  statRow: { flexDirection: 'row' },
  statCell: { flex: 1 },
  statVal: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.text.primary, fontVariant: ['tabular-nums'] },
  statKey: { fontSize: 9.5, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 },
  bars: { flexDirection: 'row', gap: 6, height: 70, marginTop: spacing[3] },
  barCol: { flex: 1, alignItems: 'center', gap: 3 },
  barVal: { fontSize: 9, fontFamily: 'Inter_700Bold', color: c.text.secondary, height: 11 },
  barBox: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '64%', minHeight: 2, borderRadius: 3, backgroundColor: c.text.secondary },
  barLabel: { fontSize: 9.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  statHint: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2] },
  moreBtn: { alignItems: 'center', paddingVertical: spacing[3], borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, marginTop: spacing[2] },
  moreLabel: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
}));
