import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import FoodBreakdownCard, { type FoodCategory } from './FoodBreakdownCard';
import FoodCategoryItemsModal from './FoodCategoryItemsModal';
import FixedBreakdownCard from './FixedBreakdownCard';
import VariableBreakdownCard from './VariableBreakdownCard';
import { bucketTransactions } from '@/utils/fixedVariable';
import { nonFoodByCategory } from '@/utils/nonFood';
import { expenseCategoryByCategory } from '@/utils/expenseCategory';
import { computeWydatkiData, monthKeyOf } from '@/utils/wydatkiData';
import { haptic } from '@/utils/haptics';
import type { Expense } from '@/types/finances';

// Popup "#wydatki" (2026-10-31, user: "lepiej mniej informacji ale popup po kliknięciu
// na zakładkę #wydatki, w której będzie scroll już jakby bo to popup będzie ze
// wszystkim co związane z wydatkami i wtedy tam przeniesie gdzie jest kategoria
// jedzenie") — poprawka po tym jak pełna `FoodBreakdownCard` wylądowała NA STAŁE na
// Dashboardzie i zmusiła go do scrolla (user to jednoznacznie odrzucił: "mieliśmy
// robić nie scrollowalny ekran żeby nie było chaosu"). Dashboard/Finanse NIGDY nie
// dostają scrolla, szczegóły żyją TUTAJ — w popupie. Scroll żyje TYLKO tutaj.
//
// Faza 2.4 (2026-11-01, user: "dawaj" na plan przebudowy Finansów) — 3-WAY
// segmented tab Stałe/Zmienne/Jedzenie zastąpił "jedną kategorię" z poprzedniej
// rundy (ARCHITECTURE.md §FINANSE: "te 3 zakładki w sapp2 = 3-way segmented tab w
// popupie Wydatki"). Modal jest teraz WSPÓLNY punkt wejścia z DWÓCH miejsc:
// Dashboard (kafel "DZIENNIE #JEDZENIE", `initialTab="food"`) i Finanse (nowy
// wiersz "Stałe / Zmienne / Jedzenie", `initialTab="fixed"`) — dane dla WSZYSTKICH
// trzech zakładek liczone w `utils/wydatkiData.ts`/`hooks/useWydatkiData.ts`, jedno
// miejsce dla obu ekranów, żeby nie rozjeżdżały się w definicji "ten miesiąc".
// `initialTab` resetuje aktywną zakładkę przy KAŻDYM otwarciu (nie tylko przy
// pierwszym mouncie) — bez tego Finanse otwierałyby się czasem na zakładce, na
// której Dashboard zostawił modal poprzednim razem.
//
// Przebudowany na `AppBottomSheet` (2026-11-02, kontynuacja migracji z Faza 3.6) —
// tytuł+zakładki jako `header` (nieruchome), rozbudowa kategorii (`FixedBreakdown-
// Card`/itd.) jako scrollowalna treść. `FoodCategoryItemsModal` STACKUJE się na
// wierchu (też `AppBottomSheet`, patrz tam) — to samo zachowanie co wcześniej z
// dwoma niezależnymi `Modal`ami, gorhom's `BottomSheetModalProvider` wspiera
// kilka naraz prezentowanych sheetów bez specjalnej obsługi z naszej strony.
type WydatkiTab = 'fixed' | 'variable' | 'food';
const TABS: { key: WydatkiTab; label: string }[] = [
  { key: 'fixed', label: 'Stałe' },
  { key: 'variable', label: 'Zmienne' },
  { key: 'food', label: 'Jedzenie' },
];

export default function WydatkiModal({
  visible,
  onClose,
  expenses,
  today,
  initialTab = 'food',
  onEditExpense,
}: {
  visible: boolean;
  onClose: () => void;
  expenses: Expense[];
  today: Date;
  initialTab?: WydatkiTab;
  onEditExpense: (expense: Expense) => void;
}) {
  const s = makeS();
  const [tab, setTab] = useState<WydatkiTab>(initialTab);
  // Nawigacja miesiącami (2026-11-09, user: "nie moge... sprawdzać innych
  // miesiecy") — `today` od wołającego to ZAWSZE realne "teraz" (Dashboard/
  // Finanse liczą SWOJE widoki z niego, bez offsetu); `monthOffset` to TYLKO
  // lokalny stan TEGO popupu, resetowany do 0 przy każdym otwarciu — Dashboard/
  // Finanse pod spodem zawsze dalej pokazują bieżący miesiąc, nawigacja w
  // popupie nic tam nie zmienia. `> 0` (przyszłość) celowo zablokowane —
  // appka nie ma jeszcze żadnych danych z przyszłości do pokazania.
  const [monthOffset, setMonthOffset] = useState(0);
  // Drill-down popup "co się na to złożyło" (2026-11-01) STACKUJE się na wierchu
  // tego modala, zamiast go zamykać — ten sam wzorzec co TransactionsModal.
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | null>(null);

  useEffect(() => {
    if (visible) { setTab(initialTab); setMonthOffset(0); }
  }, [visible, initialTab]);

  const viewDate = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + monthOffset, 1),
    [today, monthOffset],
  );
  const data = useMemo(() => computeWydatkiData(expenses, viewDate), [expenses, viewDate]);
  const monthKey = useMemo(() => monthKeyOf(viewDate), [viewDate]);
  const fixedTx = useMemo(() => bucketTransactions(expenses, monthKey, 'fixed'), [expenses, monthKey]);
  const variableTx = useMemo(() => bucketTransactions(expenses, monthKey, 'variable'), [expenses, monthKey]);
  // Higiena/Chemia itp. (2026-11-10) — ten sam kształt co Jedzenie's `categories`,
  // więc `selectedCategory`/`FoodCategoryItemsModal` POD SPODEM są reużyte 1:1,
  // bez osobnego stanu/drugiego drill-down modala.
  const nonFoodCats = useMemo(() => nonFoodByCategory(expenses, monthKey), [expenses, monthKey]);
  // Rozrywka/Transport/itp. (2026-11-10) — kategoria CAŁEGO wydatku, ten sam
  // reużyty drill-down co Higiena/Chemia wyżej.
  const expenseCats = useMemo(() => expenseCategoryByCategory(expenses, monthKey), [expenses, monthKey]);

  // Bubbluje do ekranu-wołającego (Dashboard/Finanse) — oba już mają
  // `editingExpense`/`AddExpenseModal` dla "Ostatnie transakcje", to ten sam
  // mechanizm, nie drugi. Stuknięcie w transakcję NIE zamyka tego popupu —
  // AddExpenseModal STACKUJE się na wierzchu (ten sam wzorzec co
  // FoodCategoryItemsModal niżej), user wraca dokładnie tam gdzie był.
  const selectExpense = (id: string) => {
    const exp = expenses.find((e) => e.id === id);
    if (exp) onEditExpense(exp);
  };

  const header = (
    <>
      <View style={s.header}>
        <Text style={s.title}>Wydatki</Text>
        <TouchableOpacity onPress={() => { haptic.tap(); onClose(); }} hitSlop={8} style={s.closeBtn}>
          <X size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
      <View style={s.monthRow}>
        <TouchableOpacity onPress={() => { haptic.tap(); setMonthOffset((o) => o - 1); }} style={s.monthNavBtn} hitSlop={8}>
          <ChevronLeft size={18} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={s.monthLabel}>{data.month} {viewDate.getFullYear()}</Text>
        <TouchableOpacity
          onPress={() => { if (monthOffset < 0) { haptic.tap(); setMonthOffset((o) => Math.min(0, o + 1)); } }}
          style={[s.monthNavBtn, monthOffset >= 0 && s.monthNavBtnDisabled]}
          hitSlop={8}
          disabled={monthOffset >= 0}
        >
          <ChevronRight size={18} color={monthOffset >= 0 ? colors.text.muted : colors.text.secondary} />
        </TouchableOpacity>
      </View>
      <View style={s.tabsRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
            onPress={() => { haptic.tap(); setTab(t.key); }}
            activeOpacity={0.7}
          >
            <Text style={[s.tabBtnLabel, tab === t.key && s.tabBtnLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  return (
    <>
      <AppBottomSheet visible={visible} onClose={onClose} header={header}>
        {tab === 'fixed' && (
          <FixedBreakdownCard
            month={data.month}
            total={data.fixed.total}
            changePercent={data.fixed.changePercent}
            previousTotal={data.fixed.previousTotal}
            items={data.fixed.items}
            deviations={data.fixed.deviations}
            transactions={fixedTx}
            onSelectTransaction={selectExpense}
          />
        )}
        {tab === 'variable' && (
          <VariableBreakdownCard
            month={data.month}
            total={data.variable.total}
            changePercent={data.variable.changePercent}
            previousTotal={data.variable.previousTotal}
            top={data.variable.top}
            transactions={variableTx}
            onSelectTransaction={selectExpense}
            nonFoodCategories={nonFoodCats}
            expenseCategories={expenseCats}
            onSelectCategory={setSelectedCategory}
          />
        )}
        {tab === 'food' && (
          <FoodBreakdownCard
            month={data.month}
            total={data.food.total}
            changePercent={data.food.changePercent}
            previousTotal={data.food.previousTotal}
            weeks={data.food.weeks}
            categories={data.food.categories}
            onSelectCategory={setSelectedCategory}
          />
        )}
      </AppBottomSheet>
      <FoodCategoryItemsModal
        visible={!!selectedCategory}
        onClose={() => setSelectedCategory(null)}
        month={data.month}
        category={selectedCategory}
        onEditExpense={selectExpense}
      />
    </>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: spacing[3],
  },
  title: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.primary },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[3], marginBottom: spacing[3] },
  monthNavBtn: { width: 30, height: 30, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.elevated },
  monthNavBtnDisabled: { opacity: 0.4 },
  monthLabel: { fontSize: 13.5, fontFamily: 'Inter_900Black', color: c.text.primary, minWidth: 130, textAlign: 'center' },
  tabsRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[1] },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  tabBtnActive: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  tabBtnLabel: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  tabBtnLabelActive: { color: c.bg.primary },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },
}));
