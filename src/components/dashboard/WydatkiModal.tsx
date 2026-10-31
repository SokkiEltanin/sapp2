import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import FoodBreakdownCard, { type FoodWeek, type FoodCategory } from './FoodBreakdownCard';

// Popup "#wydatki" (2026-10-31, user: "lepiej mniej informacji ale popup po kliknięciu
// na zakładkę #wydatki, w której będzie scroll już jakby bo to popup będzie ze
// wszystkim co związane z wydatkami i wtedy tam przeniesie gdzie jest kategoria
// jedzenie") — poprawka po tym jak pełna `FoodBreakdownCard` wylądowała NA STAŁE na
// Dashboardzie i zmusiła go do scrolla (user to jednoznacznie odrzucił: "mieliśmy
// robić nie scrollowalny ekran żeby nie było chaosu"). Teraz: Dashboard WRACA do
// bycia nieprzewijalnym (patrz index.tsx), szczegóły żyją TUTAJ — w pełnoekranowym
// modalu otwieranym tapem z kompaktowego kafla (ten sam `StatTile` co już tam był,
// "22,4 PLN DZIENNIE #JEDZENIE" — zero NOWEGO elementu na Dashboardzie, tylko
// dodany `onPress`). Scroll żyje TYLKO tutaj, w popupie, nie na głównym ekranie.
//
// Na razie JEDNA kategoria (Jedzenie, mock) — to jedyna z realną treścią. Kolejne
// kategorie wydatków (gdy powstaną, Faza 2) dojdą jako kolejne `FoodBreakdownCard`-
// podobne sekcje pod spodem w tym samym scrollu, nie jako osobne ekrany/nawigacja —
// stąd "tam przeniesie gdzie jest kategoria jedzenie": to scroll w obrębie jednego
// popupu "wszystko o wydatkach", nie głębsza nawigacja do osobnego ekranu.
export default function WydatkiModal({
  visible,
  onClose,
  month,
  total,
  changePercent,
  previousTotal,
  weeks,
  categories,
}: {
  visible: boolean;
  onClose: () => void;
  month: string;
  total: string;
  changePercent: number;
  previousTotal: string;
  weeks: FoodWeek[];
  categories: FoodCategory[];
}) {
  const s = makeS();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Text style={s.title}>Wydatki</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={s.closeBtn}>
            <X size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <FoodBreakdownCard
            month={month}
            total={total}
            changePercent={changePercent}
            previousTotal={previousTotal}
            weeks={weeks}
            categories={categories}
          />
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
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] },
}));
