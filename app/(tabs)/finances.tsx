import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Briefcase, Repeat, Plus } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import ComingSoonRow from '@/components/ui/ComingSoonRow';
import AddExpenseModal from '@/components/finances/AddExpenseModal';
import { useExpensesStore } from '@/store/expensesStore';

// Faza 2.2 (2026-10-31) — FAB "dodaj" podpięty (rozstrzygnięcie "Kolizja lewy dolny
// róg" z NEXT_STEPS.md: ten sam wzorzec co Zadania, patrz tasks.tsx), "Ostatnie
// transakcje" czyta TERAZ realnie z `expensesStore` (max 4, najnowsze pierwsze) —
// WYŁĄCZNIE żeby zapis z nowego AddExpenseModal miał widzialny efekt do testowania
// na urządzeniu. Saldo/pełna lista/popup Stałe-Zmienne-Jedzenie to Faza 2.4
// ("Przebudowa ekranu Finanse") — świadomie NIE teraz, ten ekran zostaje
// tymczasowym szkieletem do tego momentu.
export default function FinancesScreen() {
  const s = makeS();
  const expenses = useExpensesStore((st) => st.expenses);
  const [addOpen, setAddOpen] = useState(false);

  const recent = useMemo(
    () => [...expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4),
    [expenses],
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Finanse</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Saldo</Text>
          <Text style={[s.balanceValue, { color: colors.text.bright }]}>0,00 zł</Text>
        </View>

        <Text style={s.sectionTitle}>Ostatnie transakcje</Text>
        <View style={s.card}>
          {recent.length === 0 ? (
            <Text style={s.empty}>Brak transakcji — dodaj pierwszą przyciskiem +.</Text>
          ) : (
            recent.map((e, i) => (
              <View key={e.id} style={[s.txRow, i < recent.length - 1 && s.txRowDivider]}>
                <View style={s.txInfo}>
                  <Text style={s.txNote} numberOfLines={1}>{e.storeName || e.note || (e.type === 'income' ? 'Przychód' : 'Wydatek')}</Text>
                  <Text style={s.txDate}>{e.date}</Text>
                </View>
                <Text style={[s.txAmount, e.type === 'income' && s.txAmountIncome]}>
                  {e.type === 'income' ? '+' : '−'}{e.amount.toFixed(2)} zł
                </Text>
              </View>
            ))
          )}
        </View>

        <Text style={s.sectionTitle}>Obszary</Text>
        <View style={s.card}>
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

      <AddExpenseModal visible={addOpen} onClose={() => setAddOpen(false)} />
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
}));
