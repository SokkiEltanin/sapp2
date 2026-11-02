import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Plus, Package, ChevronRight } from 'lucide-react-native';
import { spacing, radius, themedStyles } from '@/theme';
import { Screen, Row, Tile, StatTile, Cap, FitList, Item, Price, StackBar } from '@/ui/layout';
import { C, T } from '@/ui/theme';
import AddExpenseModal from '@/components/finances/AddExpenseModal';
import ProductsModal from '@/components/finances/ProductsModal';
import TransactionsModal from '@/components/finances/TransactionsModal';
import WydatkiModal from '@/components/dashboard/WydatkiModal';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useExpensesStore } from '@/store/expensesStore';
import { getBalanceOffset, setBalanceOffset, accountBalance, affectsBalance } from '@/utils/balance';
import { buildProductCatalog } from '@/utils/productCatalog';
import { useWydatkiData } from '@/hooks/useWydatkiData';
import { haptic } from '@/utils/haptics';
import { todayISO } from '@/utils/date';
import type { Expense } from '@/types/finances';

// Faza 3.10 (design/rn kit) — Finanse przebudowane na kitu's `src/ui/layout.tsx`
// prymitywy (Screen/Row/Tile/StatTile/Cap/FitList/Item/Price/StackBar), ten sam
// powód co Dashboard/Daily (ARCHITECTURE.md §"Faza 3.10"). Kolejność/spany 1:1 z
// design/app-design.html's `#fin` (`grid-template-rows: auto auto auto auto
// 1fr`): Saldo(4) → Podział(4, StackBar) → Jedzenie kategorie(4, StackBar) →
// Praca(2)|Najbliższa opłata(2) → Ostatnie transakcje(4, fill, FitList).
//
// Praca/Najbliższa opłata — appka nie ma store'a "bills"/godzin z kalendarza
// (patrz ARCHITECTURE.md §FINANSE). `StatTile value={null}` daje DESIGN.md's
// zaprojektowany stan pusty ("0" dim + "brak") — zastępuje poprzednie ręczne
// "wkrótce — kalendarz"/"wkrótce — rachunki", które łamało regułę "nigdy
// 'wkrótce'" sformalizowaną dopiero w DESIGN.md (Faza 3.9), nie było błędem w
// chwili pisania.
//
// "Produkty" (pamięć cen, realna funkcja) NIE WYSTĘPUJE w spec — zostaje jako
// mały link pod `Cap`'em kafla "Jedzenie · kategorie" (ta sama decyzja co
// Faza 3.4, tylko przeniesiona pod nowy `Cap`, bo ten nie ma miejsca na drugi
// link obok `r`).
//
// FAB "+" (dodaj wydatek/przychód) — REALNA funkcja appki, nie część
// design/app-design.html (tam nie ma floating-button na Finansach, tylko na
// Zadaniach jako `.add` inline obok segmentu) — zostaje bez zmian, renderowana
// jako ostatnie dziecko `Screen` z `position:'absolute'` (w RN pozycjonuje się
// względem najbliższego rodzica-View niezależnie od jego własnego `position`).
//
// Popupy (AddExpenseModal/ProductsModal/TransactionsModal/WydatkiModal,
// balance-edit) BEZ ZMIAN — `AppBottomSheet` już od Fazy 3.8, kit nie ma
// odpowiednika popupów.
function parseZl(s: string): number {
  return parseInt(s.replace(/[^\d]/g, ''), 10) || 0;
}
function fmtAmount(n: number): string {
  return Math.abs(n).toFixed(2).replace('.', ',');
}
function fmtBalance(n: number): string {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  const splitTotal = useMemo(
    () => parseZl(wydatkiData.fixed.total) + parseZl(wydatkiData.food.total) + parseZl(wydatkiData.variable.total),
    [wydatkiData],
  );
  const split = useMemo(() => {
    const fixed = parseZl(wydatkiData.fixed.total);
    const food = parseZl(wydatkiData.food.total);
    const variable = parseZl(wydatkiData.variable.total);
    // `Math.max(…, 0.001)` TYLKO dla proporcji słupka (StackBar dzieli szerokość
    // przez `value` — zero zniknęłoby zamiast dać 3px minimum z DESIGN.md), NIE
    // dla `splitTotal` wyżej (ten pokazuje PRAWDZIWĄ sumę, nie podłogę 0,001 ×3).
    return [
      { value: Math.max(fixed, 0.001), color: C.txt, label: 'Stałe' },
      { value: Math.max(food, 0.001), color: '#8A8A8A', label: 'Jedzenie' },
      { value: Math.max(variable, 0.001), color: '#3F3F3F', label: 'Zmienne' },
    ];
  }, [wydatkiData]);

  const foodCats = wydatkiData.food.categories;
  const foodTotal = parseZl(wydatkiData.food.total);

  return (
    <Screen title="Finanse" right={<Text style={T.small}>{wydatkiData.month.toUpperCase()} {now.getFullYear()}</Text>}>
      <Row>
        <Tile span={4} onPress={openEditBalance}>
          <Cap l="Saldo" r="stuknij, by skalibrować" />
          <Text style={T.numXl}>{fmtBalance(balance)} <Text style={s.balanceCur}>PLN</Text></Text>
          <View style={s.balanceSumRow}>
            <Text style={s.balanceIn}>+{fmtAmount(monthIncome)}</Text>
            <Text style={s.balanceOut}>−{fmtAmount(monthExpense)}</Text>
          </View>
        </Tile>
      </Row>

      <Row>
        <Tile span={4} onPress={() => setWydatkiOpen(true)}>
          <Cap l="Podział" r={`${splitTotal} PLN`} />
          <View style={s.barSpace}>
            <StackBar parts={split} height={10} />
          </View>
        </Tile>
      </Row>

      <Row>
        <Tile span={4}>
          <Cap l="Jedzenie · kategorie" r={`${foodTotal} PLN`} />
          <TouchableOpacity onPress={() => setProductsOpen(true)} style={s.productsLink} hitSlop={6}>
            <Package size={11} color={C.mut} />
            <Text style={s.productsLinkLabel}>Produkty {productCount > 0 ? `(${productCount})` : ''}</Text>
          </TouchableOpacity>
          {foodCats.length === 0 ? (
            <Text style={[T.small, s.emptyInline]}>Brak jedzenia w tym miesiącu</Text>
          ) : (
            <TouchableOpacity onPress={() => setWydatkiOpen(true)} activeOpacity={0.7} style={s.barSpace}>
              <StackBar parts={foodCats.map((c) => ({ label: c.label, value: c.amount, color: c.color }))} height={10} legendMax={3} />
            </TouchableOpacity>
          )}
        </Tile>
      </Row>

      <Row>
        <StatTile value={null} unit="kalendarz" label="Praca" span={2} />
        <StatTile value={null} unit="rachunki" label="Najbliższa opłata" span={2} />
      </Row>

      <Row flex={1}>
        <Tile span={4}>
          <TouchableOpacity
            style={s.capRow}
            onPress={() => setTransactionsOpen(true)}
            activeOpacity={0.6}
            disabled={expenses.length === 0}
          >
            <Text style={T.cap}>Ostatnie transakcje</Text>
            {expenses.length > 0 && (
              <View style={s.seeAllRow}>
                <Text style={T.capR}>wszystkie</Text>
                <ChevronRight size={12} color={C.mut} />
              </View>
            )}
          </TouchableOpacity>
          <FitList
            data={recent}
            emptyText="Brak transakcji — dodaj pierwszą przyciskiem +"
            renderItem={(e) => (
              <Item onPress={() => setEditingExpense(e)}>
                <Price amount={e.type === 'income' ? e.amount : -e.amount} />
                <View style={s.txTextCol}>
                  <Text style={T.row} numberOfLines={1}>{e.storeName || e.note || (e.type === 'income' ? 'Przychód' : 'Wydatek')}</Text>
                  <Text style={T.rowSub} numberOfLines={1}>{e.date}</Text>
                </View>
              </Item>
            )}
          />
        </Tile>
      </Row>

      <TouchableOpacity
        style={s.fab}
        onPress={() => { haptic.tap(); setAddOpen(true); }}
        activeOpacity={0.8}
        accessibilityLabel="Nowy wydatek lub przychód"
      >
        <Plus size={22} color={C.bg} />
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

      <AppBottomSheet visible={editingBalance} onClose={() => setEditingBalance(false)} scrollable={false}>
        <View style={s.editCard}>
          <Text style={s.editTitle}>Ustaw aktualne saldo</Text>
          <Text style={s.editHint}>Tyle realnie masz teraz na koncie — appka doliczy od tego wszystkie kolejne wydatki/przychody kartą.</Text>
          <View style={s.editInputRow}>
            <BottomSheetTextInput
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
        </View>
      </AppBottomSheet>
    </Screen>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  capRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  balanceCur: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.mut },
  balanceSumRow: { flexDirection: 'row', gap: spacing[4], marginTop: spacing[2] },
  balanceIn: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.ok },
  balanceOut: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.mut },

  barSpace: { marginTop: spacing[3] },
  productsLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -4, marginBottom: spacing[1] },
  productsLinkLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: C.mut },
  emptyInline: { textAlign: 'center', marginTop: spacing[3] },

  txTextCol: { flex: 1, minWidth: 0 },

  fab: {
    position: 'absolute', right: spacing[4], bottom: spacing[4],
    width: 52, height: 52, borderRadius: radius.full, backgroundColor: C.hi,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 6,
  },

  editCard: { gap: spacing[2] },
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
