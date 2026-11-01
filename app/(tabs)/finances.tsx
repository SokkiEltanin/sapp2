import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Briefcase, Repeat, Plus, Package } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import ComingSoonRow from '@/components/ui/ComingSoonRow';
import LiveSectionRow from '@/components/ui/LiveSectionRow';
import AddExpenseModal from '@/components/finances/AddExpenseModal';
import ProductsModal from '@/components/finances/ProductsModal';
import { useExpensesStore } from '@/store/expensesStore';
import { getBalanceOffset, setBalanceOffset, accountBalance } from '@/utils/balance';
import { buildProductCatalog } from '@/utils/productCatalog';
import type { Expense } from '@/types/finances';

// Faza 2.2 (2026-10-31) — FAB "dodaj" podpięty (rozstrzygnięcie "Kolizja lewy dolny
// róg" z NEXT_STEPS.md: ten sam wzorzec co Zadania, patrz tasks.tsx), "Ostatnie
// transakcje" czyta TERAZ realnie z `expensesStore` (max 4, najnowsze pierwsze) —
// WYŁĄCZNIE żeby zapis z nowego AddExpenseModal miał widzialny efekt do testowania
// na urządzeniu. Pełna lista/popup Stałe-Zmienne-Jedzenie to Faza 2.4 ("Przebudowa
// ekranu Finanse") — świadomie NIE teraz, ten ekran zostaje tymczasowym szkieletem.
//
// Saldo — PODPIĘTE realnie (2026-11-01, user: "chcę saldo żeby odzwierciedlało ile
// mam na koncie w banku") — `accountBalance()` (utils/balance.ts) liczy offset +
// wpływy/wydatki gdzie `affectsBalance()` (karta/BLIK/przelew, zapłacone przez "ja")
// jest prawdą; gotówka i płatności Olesi nigdy go nie ruszają. Offset ustawiany
// tapem w kafel — bez tego appka nie zna realnego punktu startowego (nigdy nie
// prosiliśmy usera o stan konta na starcie), więc domyślnie 0 aż user go skalibruje.
export default function FinancesScreen() {
  const s = makeS();
  const expenses = useExpensesStore((st) => st.expenses);
  const [addOpen, setAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [productsOpen, setProductsOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');

  useEffect(() => { getBalanceOffset().then(setOffset); }, []);

  const balance = useMemo(() => accountBalance(expenses, offset), [expenses, offset]);

  const openEditBalance = () => { setBalanceInput(balance.toFixed(2)); setEditingBalance(true); };
  const saveBalance = async () => {
    const real = parseFloat(balanceInput.replace(',', '.'));
    if (isFinite(real)) {
      const netWithoutOffset = balance - offset;
      const newOffset = real - netWithoutOffset;
      await setBalanceOffset(newOffset);
      setOffset(newOffset);
    }
    setEditingBalance(false);
  };

  const recent = useMemo(
    () => [...expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4),
    [expenses],
  );

  const productCount = useMemo(() => buildProductCatalog(expenses).length, [expenses]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Finanse</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <TouchableOpacity style={s.balanceCard} onPress={openEditBalance} activeOpacity={0.8}>
          <Text style={s.balanceLabel}>Saldo</Text>
          <Text style={[s.balanceValue, { color: colors.text.bright }]}>{balance.toFixed(2)} zł</Text>
          <Text style={s.balanceHint}>tapnij, żeby skalibrować</Text>
        </TouchableOpacity>

        <Text style={s.sectionTitle}>Ostatnie transakcje</Text>
        <View style={s.card}>
          {recent.length === 0 ? (
            <Text style={s.empty}>Brak transakcji — dodaj pierwszą przyciskiem +.</Text>
          ) : (
            recent.map((e, i) => (
              <TouchableOpacity
                key={e.id}
                style={[s.txRow, i < recent.length - 1 && s.txRowDivider]}
                onPress={() => setEditingExpense(e)}
                activeOpacity={0.7}
              >
                <View style={s.txInfo}>
                  <Text style={s.txNote} numberOfLines={1}>{e.storeName || e.note || (e.type === 'income' ? 'Przychód' : 'Wydatek')}</Text>
                  <Text style={s.txDate}>{e.date}</Text>
                </View>
                <Text style={[s.txAmount, e.type === 'income' && s.txAmountIncome]}>
                  {e.type === 'income' ? '+' : '−'}{e.amount.toFixed(2)} zł
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <Text style={s.sectionTitle}>Obszary</Text>
        <View style={s.card}>
          <LiveSectionRow
            icon={Package}
            label="Produkty"
            status={productCount > 0 ? `${productCount}` : 'Zobacz →'}
            onPress={() => setProductsOpen(true)}
          />
          <ComingSoonRow icon={Briefcase} label="Praca" description="zmiany, godziny, wypłaty" />
          <ComingSoonRow icon={Repeat} label="Subskrypcje" description="cykliczne płatności" isLast />
        </View>
      </ScrollView>

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
  header: { paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  title: { fontSize: 22, fontFamily: 'Inter_900Black', color: c.text.primary },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[8], gap: spacing[2] },
  balanceCard: {
    backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', paddingVertical: spacing[5], marginBottom: spacing[4],
  },
  balanceLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  // `colors.text.bright` (2026-10-30, redesign Dashboardu na monochromatyczny) —
  // zamiast `colors.stat.finanse`, spójnie z dużymi liczbami kafli Dashboardu
  // (StatTile.tsx).
  balanceValue: { fontSize: 36, fontFamily: 'Inter_900Black', marginTop: spacing[1] },
  balanceHint: { fontSize: 10, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[1] },
  sectionTitle: {
    fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2], marginTop: spacing[2],
  },
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    overflow: 'hidden', marginBottom: spacing[4],
  },
  empty: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, padding: spacing[4], textAlign: 'center' },

  txRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  txRowDivider: { borderBottomWidth: 1, borderBottomColor: c.border.subtle },
  txInfo: { flex: 1, marginRight: spacing[2] },
  txNote: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  txDate: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
  txAmount: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.text.bright },
  txAmountIncome: { color: c.accent.green },

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
