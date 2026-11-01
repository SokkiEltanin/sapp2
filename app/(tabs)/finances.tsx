import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Package, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import Tile from '@/components/design/Tile';
import Row from '@/components/design/Row';
import PricePill from '@/components/design/PricePill';
import StackBar from '@/components/design/StackBar';
import FitList from '@/components/design/FitList';
import AddExpenseModal from '@/components/finances/AddExpenseModal';
import ProductsModal from '@/components/finances/ProductsModal';
import TransactionsModal from '@/components/finances/TransactionsModal';
import WydatkiModal from '@/components/dashboard/WydatkiModal';
import { useExpensesStore } from '@/store/expensesStore';
import { getBalanceOffset, setBalanceOffset, accountBalance, affectsBalance } from '@/utils/balance';
import { buildProductCatalog } from '@/utils/productCatalog';
import { useWydatkiData } from '@/hooks/useWydatkiData';
import { haptic } from '@/utils/haptics';
import { todayISO } from '@/utils/date';
import type { Expense } from '@/types/finances';

// Faza 3.4 (2026-11-01, "dawaj skończ wszystko") — Finanse przebudowane na nowy
// system komponentów, układ z design/app-design.html's `#fin` (4 kolumny,
// `grid-template-rows: auto auto auto auto 1fr`): Saldo → Podział (StackBar) →
// Jedzenie kategorie (StackBar) → Praca+Najbliższa opłata (stub, s2+s2) →
// Ostatnie transakcje (fill, 2-liniowe wiersze, `FitList`).
//
// POPUPY (AddExpenseModal/ProductsModal/TransactionsModal/WydatkiModal, balance-edit)
// ŚWIADOMIE BEZ ZMIAN — wciąż `Modal`, NIE `AppBottomSheet`. Bottom-sheet-yfikacja
// istniejących, złożonych popupów to osobna, odłożona faza (ARCHITECTURE.md
// §"REDESIGN RDZENIA UI", "Następne fazy") — ryzyko migrowania 5 różnych modali w
// tej samej rundzie co przebudowa głównego ekranu byłoby nieproporcjonalne.
//
// "Produkty" (pamięć cen, realna funkcja) NIE WYSTĘPUJE w spec — zamiast ją
// wyrzucić, dostała mały link w nagłówku kafla "Jedzenie · kategorie" (ten sam
// kafel skąd sensownie się do niej trafia). "Praca"/"Najbliższa opłata" = uczciwy
// stub (appka nie ma store'a "bills"/godzin z kalendarza, patrz ARCHITECTURE.md
// §FINANSE "Kolejność budowy" — Subskrypcje/Praca wciąż nieistniejące).
function parseZl(s: string): number {
  return parseInt(s.replace(/[^\d]/g, ''), 10) || 0;
}
function fmtAmount(n: number): string {
  return Math.abs(n).toFixed(2).replace('.', ',');
}

export default function FinancesScreen() {
  const s = makeS();
  const expenses = useExpensesStore((st) => st.expenses);
  const [addOpen, setAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [productsOpen, setProductsOpen] = useState(false);
  const [transactionsOpen, setTransactionsOpen] = useState(false);
  const [wydatkiOpen, setWydatkiOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');

  const today = todayISO();
  const now = useMemo(() => new Date(), [today]);
  const wydatkiData = useWydatkiData(expenses, now);

  useEffect(() => { getBalanceOffset().then(setOffset); }, []);

  const balance = useMemo(() => accountBalance(expenses, offset), [expenses, offset]);
  const monthKey = today.slice(0, 7);
  const monthIncome = useMemo(
    () => expenses.filter((e) => e.type === 'income' && affectsBalance(e) && e.date.slice(0, 7) === monthKey).reduce((a, e) => a + e.amount, 0),
    [expenses, monthKey],
  );
  const monthExpense = useMemo(
    () => expenses.filter((e) => e.type === 'expense' && affectsBalance(e) && e.date.slice(0, 7) === monthKey).reduce((a, e) => a + e.amount, 0),
    [expenses, monthKey],
  );

  const openEditBalance = () => { setBalanceInput(balance.toFixed(2)); setEditingBalance(true); };
  const saveBalance = async () => {
    const real = parseFloat(balanceInput.replace(',', '.'));
    if (isFinite(real)) {
      haptic.success();
      const netWithoutOffset = balance - offset;
      const newOffset = real - netWithoutOffset;
      await setBalanceOffset(newOffset);
      setOffset(newOffset);
    }
    setEditingBalance(false);
  };

  const recent = useMemo(
    () => [...expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [expenses],
  );
  const productCount = useMemo(() => buildProductCatalog(expenses).length, [expenses]);

  const split = useMemo(() => {
    const fixed = parseZl(wydatkiData.fixed.total);
    const food = parseZl(wydatkiData.food.total);
    const variable = parseZl(wydatkiData.variable.total);
    return [
      { value: Math.max(fixed, 0.001), color: colors.text.primary, label: 'Stałe' },
      { value: Math.max(food, 0.001), color: '#8A8A8A', label: 'Jedzenie' },
      { value: Math.max(variable, 0.001), color: '#3F3F3F', label: 'Zmienne' },
    ];
  }, [wydatkiData]);
  const splitTotal = split.reduce((a, s2) => a + s2.value, 0);

  const foodCats = wydatkiData.food.categories;
  const foodTotal = parseZl(wydatkiData.food.total);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Finanse</Text>
        <Text style={s.headerMonth}>{wydatkiData.month.toUpperCase()} {now.getFullYear()}</Text>
      </View>

      <View style={s.content}>
        {/* Rząd 1: Saldo */}
        <Tile style={s.balanceTile} onPress={openEditBalance}>
          <View style={s.capRow}>
            <Text style={s.capLabel}>SALDO</Text>
            <Text style={s.capUnit}>stuknij, by skalibrować</Text>
          </View>
          <Text style={s.balanceNum}>{balance.toFixed(2)} <Text style={s.balanceCur}>PLN</Text></Text>
          <View style={s.balanceSumRow}>
            <Text style={s.balanceIn}>+{fmtAmount(monthIncome)}</Text>
            <Text style={s.balanceOut}>−{fmtAmount(monthExpense)}</Text>
          </View>
        </Tile>

        {/* Rząd 2: Podział */}
        <Tile style={[s.wideTile, s.rowGap]} onPress={() => setWydatkiOpen(true)}>
          <View style={s.capRow}>
            <Text style={s.capLabel}>PODZIAŁ</Text>
            <Text style={s.capUnit}>{splitTotal} PLN</Text>
          </View>
          <View style={s.barSpace}>
            <StackBar segments={split} height={10} legend={split} />
          </View>
        </Tile>

        {/* Rząd 3: Jedzenie kategorie */}
        <Tile style={[s.wideTile, s.rowGap]} variant="static">
          <View style={s.capRow}>
            <Text style={s.capLabel}>JEDZENIE · KATEGORIE</Text>
            <TouchableOpacity onPress={() => setProductsOpen(true)} style={s.productsLink} hitSlop={6}>
              <Package size={11} color={colors.text.muted} />
              <Text style={s.productsLinkLabel}>Produkty {productCount > 0 ? `(${productCount})` : ''}</Text>
            </TouchableOpacity>
          </View>
          {foodCats.length === 0 ? (
            <Text style={s.emptyInline}>Brak jedzenia w tym miesiącu</Text>
          ) : (
            <TouchableOpacity onPress={() => setWydatkiOpen(true)} activeOpacity={0.7} style={s.barSpace}>
              <StackBar
                segments={foodCats.map((c) => ({ value: c.amount, color: c.color }))}
                height={10}
                legend={foodCats.slice(0, 3).map((c) => ({ value: c.amount, color: c.color, label: c.label }))}
                extra={Math.max(0, foodCats.length - 3)}
              />
              <Text style={s.foodTotalHint}>{foodTotal} PLN</Text>
            </TouchableOpacity>
          )}
        </Tile>

        {/* Rząd 4: Praca + Najbliższa opłata (stub) */}
        <View style={[s.row, s.rowGap]}>
          <Tile style={s.stubTile}>
            <Text style={s.capLabel}>PRACA</Text>
            <Text style={s.stubNum}>—</Text>
            <Text style={s.stubHint}>wkrótce — kalendarz</Text>
          </Tile>
          <Tile style={s.stubTile}>
            <Text style={s.capLabel}>NAJBLIŻSZA OPŁATA</Text>
            <Text style={s.stubNum}>—</Text>
            <Text style={s.stubHint}>wkrótce — rachunki</Text>
          </Tile>
        </View>

        {/* Rząd 5 (flex): Ostatnie transakcje */}
        <Tile style={[s.wideTile, s.rowGap, s.rowFlex1]} variant="static">
          <TouchableOpacity
            style={s.capRow}
            onPress={() => setTransactionsOpen(true)}
            activeOpacity={0.6}
            disabled={expenses.length === 0}
          >
            <Text style={s.capLabel}>OSTATNIE TRANSAKCJE</Text>
            {expenses.length > 0 && (
              <View style={s.seeAllRow}>
                <Text style={s.capUnit}>wszystkie</Text>
                <ChevronRight size={12} color={colors.text.muted} />
              </View>
            )}
          </TouchableOpacity>
          <FitList
            data={recent}
            itemHeight={44}
            gap={spacing[1]}
            keyExtractor={(e) => e.id}
            empty={<Text style={s.emptyInline}>Brak transakcji — dodaj pierwszą przyciskiem +</Text>}
            renderItem={(e) => (
              <Row
                key={e.id}
                height={44}
                onPress={() => setEditingExpense(e)}
                label={e.storeName || e.note || (e.type === 'income' ? 'Przychód' : 'Wydatek')}
                sublabel={e.date}
                right={<PricePill amount={fmtAmount(e.amount)} income={e.type === 'income'} />}
              />
            )}
          />
        </Tile>
      </View>

      <TouchableOpacity
        style={s.fab}
        onPress={() => setAddOpen(true)}
        activeOpacity={0.8}
        accessibilityLabel="Nowy wydatek lub przychód"
      >
        <Plus size={22} color={colors.bg.primary} />
      </TouchableOpacity>

      <AddExpenseModal
        visible={addOpen || !!editingExpense}
        onClose={() => { setAddOpen(false); setEditingExpense(null); }}
        editingExpense={editingExpense}
      />
      <ProductsModal visible={productsOpen} onClose={() => setProductsOpen(false)} />
      <TransactionsModal
        visible={transactionsOpen}
        onClose={() => setTransactionsOpen(false)}
        expenses={expenses}
        onSelect={(e) => setEditingExpense(e)}
      />
      <WydatkiModal
        visible={wydatkiOpen}
        onClose={() => setWydatkiOpen(false)}
        month={wydatkiData.month}
        initialTab="fixed"
        food={wydatkiData.food}
        fixed={wydatkiData.fixed}
        variable={wydatkiData.variable}
      />

      <Modal visible={editingBalance} transparent animationType="fade" onRequestClose={() => setEditingBalance(false)}>
        <Pressable style={s.backdrop} onPress={() => setEditingBalance(false)}>
          <Pressable style={s.editCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.editTitle}>Ustaw aktualne saldo</Text>
            <Text style={s.editHint}>Tyle realnie masz teraz na koncie — appka doliczy od tego wszystkie kolejne wydatki/przychody kartą.</Text>
            <View style={s.editInputRow}>
              <TextInput
                value={balanceInput}
                onChangeText={setBalanceInput}
                keyboardType="decimal-pad"
                style={s.editInput}
                autoFocus
                onSubmitEditing={saveBalance}
              />
              <Text style={s.editCurrency}>zł</Text>
            </View>
            <View style={s.editActions}>
              <TouchableOpacity onPress={() => setEditingBalance(false)} style={s.editCancelBtn}>
                <Text style={s.editCancelLabel}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveBalance} style={s.editSaveBtn}>
                <Text style={s.editSaveLabel}>Zapisz</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  title: { fontSize: 22, fontFamily: 'Inter_900Black', letterSpacing: -0.5, color: c.text.bright },
  headerMonth: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted, letterSpacing: 0.4 },
  content: { flex: 1, paddingHorizontal: spacing[3] },

  row: { flexDirection: 'row', gap: spacing[2] },
  rowGap: { marginTop: spacing[2] },
  rowFlex1: { flex: 1 },
  wideTile: { width: '100%' },

  capRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, color: c.text.primary },
  capUnit: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  balanceTile: {},
  balanceNum: { fontSize: 32, fontFamily: 'Inter_900Black', letterSpacing: -0.8, color: c.text.bright, marginTop: spacing[2] },
  balanceCur: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.muted },
  balanceSumRow: { flexDirection: 'row', gap: spacing[4], marginTop: spacing[2] },
  balanceIn: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.accent.green },
  balanceOut: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted },

  barSpace: { marginTop: spacing[3] },
  productsLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  productsLinkLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  foodTotalHint: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: spacing[2], textAlign: 'right' },
  emptyInline: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', marginTop: spacing[3] },

  stubTile: { flex: 1, gap: 4 },
  stubNum: { fontSize: 22, fontFamily: 'Inter_800ExtraBold', color: c.text.bright, marginTop: spacing[1] },
  stubHint: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.text.muted },

  fab: {
    position: 'absolute', right: spacing[4], bottom: spacing[4],
    width: 52, height: 52, borderRadius: radius.full, backgroundColor: c.text.bright,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 6,
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing[4] },
  editCard: {
    backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[4], gap: spacing[2],
  },
  editTitle: { fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.primary },
  editHint: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted, lineHeight: 16 },
  editInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], marginTop: spacing[1],
  },
  editInput: { flex: 1, fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.bright, paddingVertical: spacing[2] },
  editCurrency: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.muted },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[1] },
  editCancelBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  editCancelLabel: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  editSaveBtn: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.md, backgroundColor: c.text.bright },
  editSaveLabel: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
}));
