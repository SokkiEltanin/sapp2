import { useEffect, useMemo, useRef, useState } from 'react';
import { grayRamp } from '@/utils/txGroup';
import { router } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X, ChevronLeft, ChevronRight, Table2 } from 'lucide-react-native';
import TrendCard from '@/components/finances/TrendCard';
import { SheetCard } from '@/components/design/SheetCard';
import { incomeByCategory } from '@/utils/incomeCategory';
import { zl } from '@/utils/money';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import FoodBreakdownCard, { type FoodCategory } from './FoodBreakdownCard';
import FoodCategoryItemsModal from './FoodCategoryItemsModal';
import FixedBreakdownCard from './FixedBreakdownCard';
import VariableBreakdownCard from './VariableBreakdownCard';
import { bucketTransactions } from '@/utils/fixedVariable';
import { variableByCategory } from '@/utils/expenseCategory';
import { useCategoriesVersion } from '@/store/categoriesStore';
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
// 2026-11-22 (user: "kilka miejsc z tymi danymi — jedzenie, zmienne, stałe, excel —
// ujednolicić; przeskakuje wysokością między zakładkami"): JEDNO okno wydatków. Zakładki
// Stałe / Zmienne / Jedzenie / Wpływy, w każdej: rozbicie miesiąca (karta jak dotąd) →
// trend 12 miesięcy (TrendCard, dawny osobny arkusz Trend) → tabela wszystkich wydatków.
// Arkusz ma STAŁĄ wysokość (`fixedHeight`), więc przełączanie zakładek nie skacze.
export type WydatkiTab = 'fixed' | 'variable' | 'food' | 'income';
// Kolejność i odcienie jak na kaflu Finansów (2026-11-23, user: "po wejściu duża zakładka
// podzielona na 3 z możliwością wejścia i zobaczenia szczegółów").
const TABS: { key: Exclude<WydatkiTab, 'income'>; label: string }[] = [
  { key: 'fixed', label: 'Stałe' },
  { key: 'food', label: 'Jedzenie' },
  { key: 'variable', label: 'Zmienne' },
];
const TAB_GRAY = grayRamp(3);

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
  const openTable = useRef(false);
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
  // 2026-11-14: jedna lista kategorii Zmiennych (pozycje paragonu + reszta wydatku).
  const catVersion = useCategoriesVersion();
  const nonFoodCats = useMemo(() => variableByCategory(expenses, monthKey), [expenses, monthKey, catVersion]);
  // Rozrywka/Transport/itp. (2026-11-10) — kategoria CAŁEGO wydatku, ten sam
  // reużyty drill-down co Higiena/Chemia wyżej.
  const expenseCats: typeof nonFoodCats = [];
  const incomeCats = useMemo(() => incomeByCategory(expenses, monthKey), [expenses, monthKey]);
  const incomeTotal = incomeCats.reduce((a, c) => a + c.amount, 0);
  const incomeMax = Math.max(1, ...incomeCats.map((c) => c.amount));

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
      {/* 3 duże pola = podział miesiąca i wybór szczegółów; Wpływy osobno pod spodem. */}
      <View style={s.tabsRow}>
        {TABS.map((t, i) => {
          const on = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={[s.bigTab, on && s.bigTabOn]} onPress={() => { haptic.tap(); setTab(t.key); }} activeOpacity={0.7}>
              <View style={s.bigTabTop}>
                <View style={[s.bigTabPin, { backgroundColor: TAB_GRAY[i] }]} />
                <Text style={[s.bigTabLabel, on && s.bigTabLabelOn]}>{t.label}</Text>
              </View>
              <Text style={[s.bigTabVal, on && s.bigTabValOn]} numberOfLines={1} adjustsFontSizeToFit>{data[t.key].total}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity style={[s.incomeTab, tab === 'income' && s.bigTabOn]} onPress={() => { haptic.tap(); setTab('income'); }} activeOpacity={0.7}>
        <Text style={[s.bigTabLabel, tab === 'income' && s.bigTabLabelOn]}>Wpływy</Text>
        <Text style={[s.incomeVal, tab === 'income' && s.bigTabValOn]}>+{zl(incomeTotal)}</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <>
      <AppBottomSheet visible={visible} onClose={onClose} header={header} fixedHeight maxHeightRatio={0.88}
        onClosed={() => { if (openTable.current) { openTable.current = false; router.push('/expense-table' as any); } }}>
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
            days={data.food.days}
            months={data.food.months}
            categories={data.food.categories}
            onSelectCategory={setSelectedCategory}
          />
        )}
        {tab === 'income' && (
          <SheetCard title={`Wpływy · ${data.month}`} right={<Text style={s.incTotal}>{zl(incomeTotal)}</Text>}>
            {incomeCats.length === 0 ? <Text style={s.incEmpty}>Brak wpływów w tym miesiącu</Text> : incomeCats.map((c) => (
              <TouchableOpacity key={c.tag} style={s.incRow} onPress={() => { haptic.tap(); setSelectedCategory(c); }} activeOpacity={0.7}>
                <View style={[s.incDot, { backgroundColor: c.color }]} />
                <Text style={s.incName} numberOfLines={1}>{c.label}</Text>
                <View style={s.incTrack}><View style={[s.incFill, { width: `${(c.amount / incomeMax) * 100}%`, backgroundColor: c.color }]} /></View>
                <Text style={s.incVal}>{zl(c.amount)}</Text>
                <ChevronRight size={14} color={colors.text.muted} />
              </TouchableOpacity>
            ))}
          </SheetCard>
        )}
        {/* trend 12 miesięcy tej zakładki (zawsze do bieżącego miesiąca) */}
        <TrendCard bucket={tab} />
        {/* Tabela jak w Sheets (2026-11-16) — kategorie × miesiące, app/expense-table.tsx.
          Nawigacja dopiero po zamknięciu sheeta (onClosed), inaczej zostaje puste okno. */}
        <TouchableOpacity style={s.tableBtn} onPress={() => { haptic.tap(); openTable.current = true; onClose(); }} activeOpacity={0.8} accessibilityLabel="Tabela wszystkich wydatków">
        <Table2 size={15} color={colors.text.primary} />
        <Text style={s.tableBtnLabel}>Tabela wszystkich wydatków</Text>
        <ChevronRight size={15} color={colors.text.muted} />
        </TouchableOpacity>
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
  tabsRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] },
  bigTab: { flex: 1, paddingVertical: spacing[3], paddingHorizontal: spacing[2], borderRadius: radius.lg, backgroundColor: c.ui.in, borderWidth: 1, borderColor: 'transparent', gap: 6 },
  bigTabOn: { borderColor: c.text.bright, backgroundColor: c.ui.in2 },
  bigTabTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bigTabPin: { width: 8, height: 8, borderRadius: 4 },
  bigTabLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted },
  bigTabLabelOn: { color: c.text.bright },
  bigTabVal: { fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.secondary, fontVariant: ['tabular-nums'] },
  bigTabValOn: { color: c.text.bright },
  incomeTab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: radius.lg, backgroundColor: c.ui.in, borderWidth: 1, borderColor: 'transparent', marginBottom: spacing[1] },
  incomeVal: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.accent.green, fontVariant: ['tabular-nums'] },
  incTotal: { fontSize: 15, fontFamily: 'Inter_900Black', color: c.text.bright },
  incEmpty: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  incRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  incDot: { width: 9, height: 9, borderRadius: 5 },
  incName: { width: 96, fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  incTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.ui.in2, overflow: 'hidden' },
  incFill: { height: '100%', borderRadius: 3 },
  incVal: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.text.primary, fontVariant: ['tabular-nums'] },
  tableBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[3], marginBottom: spacing[1], paddingHorizontal: spacing[3], paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  tableBtnLabel: { flex: 1, fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },
}));
