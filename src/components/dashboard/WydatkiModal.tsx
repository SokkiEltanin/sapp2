import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import FoodBreakdownCard, { type FoodWeek, type FoodCategory } from './FoodBreakdownCard';
import FixedBreakdownCard from './FixedBreakdownCard';
import VariableBreakdownCard from './VariableBreakdownCard';
import type { FixedItem, FixedDeviation, VariableContributor } from '@/utils/fixedVariable';

// Popup "#wydatki" (2026-10-31, user: "lepiej mniej informacji ale popup po kliknięciu
// na zakładkę #wydatki, w której będzie scroll już jakby bo to popup będzie ze
// wszystkim co związane z wydatkami i wtedy tam przeniesie gdzie jest kategoria
// jedzenie") — poprawka po tym jak pełna `FoodBreakdownCard` wylądowała NA STAŁE na
// Dashboardzie i zmusiła go do scrolla (user to jednoznacznie odrzucił: "mieliśmy
// robić nie scrollowalny ekran żeby nie było chaosu"). Dashboard/Finanse NIGDY nie
// dostają scrolla, szczegóły żyją TUTAJ — w pełnoekranowym modalu. Scroll żyje
// TYLKO tutaj, w popupie, nie na głównym ekranie.
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
type WydatkiTab = 'fixed' | 'variable' | 'food';
const TABS: { key: WydatkiTab; label: string }[] = [
  { key: 'fixed', label: 'Stałe' },
  { key: 'variable', label: 'Zmienne' },
  { key: 'food', label: 'Jedzenie' },
];

export default function WydatkiModal({
  visible,
  onClose,
  month,
  initialTab = 'food',
  food,
  fixed,
  variable,
}: {
  visible: boolean;
  onClose: () => void;
  month: string;
  initialTab?: WydatkiTab;
  food: { total: string; changePercent: number; previousTotal: string; weeks: FoodWeek[]; categories: FoodCategory[] };
  fixed: { total: string; changePercent: number; previousTotal: string; items: FixedItem[]; deviations: FixedDeviation[] };
  variable: { total: string; changePercent: number; previousTotal: string; top: VariableContributor[] };
}) {
  const s = makeS();
  const [tab, setTab] = useState<WydatkiTab>(initialTab);

  useEffect(() => {
    if (visible) setTab(initialTab);
  }, [visible, initialTab]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Text style={s.title}>Wydatki</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={s.closeBtn}>
            <X size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
        <View style={s.tabsRow}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabBtnLabel, tab === t.key && s.tabBtnLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {tab === 'fixed' && (
            <FixedBreakdownCard
              month={month}
              total={fixed.total}
              changePercent={fixed.changePercent}
              previousTotal={fixed.previousTotal}
              items={fixed.items}
              deviations={fixed.deviations}
            />
          )}
          {tab === 'variable' && (
            <VariableBreakdownCard
              month={month}
              total={variable.total}
              changePercent={variable.changePercent}
              previousTotal={variable.previousTotal}
              top={variable.top}
            />
          )}
          {tab === 'food' && (
            <FoodBreakdownCard
              month={month}
              total={food.total}
              changePercent={food.changePercent}
              previousTotal={food.previousTotal}
              weeks={food.weeks}
              categories={food.categories}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  title: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.primary },
  tabsRow: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[4], marginBottom: spacing[2] },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  tabBtnActive: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  tabBtnLabel: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  tabBtnLabelActive: { color: c.bg.primary },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] },
}));
