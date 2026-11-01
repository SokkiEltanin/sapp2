import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ShoppingBasket } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import type { FoodCategory } from './FoodBreakdownCard';

// Drill-down popup "co konkretnie się na to złożyło" (2026-11-01, user: "jak
// klikam w jedzenie nie mam tam zrobione na popupie jak w sap na dashboardzie") —
// stuknięcie w kategorię w `FoodBreakdownCard` (wewnątrz WydatkiModal) STACKUJE ten
// modal NA WIERZCHU, ten sam wzorzec co TransactionsModal→AddExpenseModal (drugi
// modal nie zamyka pierwszego pod spodem). Lista pozycji jest już policzona razem
// z sumą kafla w `foodByCategory` (utils/foodStats.ts) — jedno przejście po
// wydatkach, zero szansy by suma i lista drill-down się rozjechały.
function fmtDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' });
}

export default function FoodCategoryItemsModal({
  visible,
  onClose,
  month,
  category,
}: {
  visible: boolean;
  onClose: () => void;
  month: string;
  category: FoodCategory | null;
}) {
  const s = makeS();
  if (!category) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={[s.dot, { backgroundColor: category.color }]} />
            <Text style={s.title}>{category.label}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={s.closeBtn}>
            <X size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
        <Text style={s.subtitle}>{category.amount} zł · {month.toLowerCase()}</Text>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {category.items.length === 0 ? (
            <View style={s.empty}>
              <ShoppingBasket size={28} color={colors.text.muted} />
              <Text style={s.emptyText}>Brak pozycji w tym miesiącu.</Text>
            </View>
          ) : (
            category.items.map((it, i) => (
              <View key={`${it.expenseId}_${i}`} style={s.row}>
                <View style={s.rowLeft}>
                  <Text style={s.itemName} numberOfLines={1}>{it.name}</Text>
                  <Text style={s.itemMeta}>
                    {it.storeName ? `${it.storeName} · ` : ''}{fmtDate(it.date)}
                    {it.quantity > 1 ? ` · ${it.quantity}×` : ''}
                  </Text>
                </View>
                <Text style={s.itemPrice}>{it.price.toFixed(2)} zł</Text>
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingTop: spacing[3],
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  title: { fontSize: 19, fontFamily: 'Inter_900Black', color: c.text.primary, flexShrink: 1 },
  subtitle: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.muted, paddingHorizontal: spacing[4], marginTop: 4, marginBottom: spacing[3] },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] },
  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  emptyText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.muted },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3],
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginBottom: spacing[2],
  },
  rowLeft: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  itemMeta: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted },
  itemPrice: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.text.secondary },
}));
