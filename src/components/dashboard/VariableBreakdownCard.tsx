import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ShoppingCart, Pencil, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { haptic } from '@/utils/haptics';
import type { VariableContributor, FvTransaction } from '@/utils/fixedVariable';
import type { FoodCategoryItem } from '@/utils/foodStats';

function fmtTxDate(ymd: string): string {
  const [y, m, d] = (ymd || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' });
}

// Zakładka "Zmienne" w popupie Wydatki (Faza 2.4, 2026-11-01) — trzeci kubeł obok
// Stałe/Jedzenie, ten sam układ karty co `FixedBreakdownCard.tsx`. "Top wydatki"
// (`topVariableContributors`, już przetestowane) — co faktycznie przeważyło,
// pogrupowane, nie każda transakcja osobno.
//
// "Wszystkie transakcje" DOŁĄCZONE 2026-11-09 (user: "nie moge edytowac tam i
// klikać co jest zmienna a co nie") — `bucketTransactions` (fixedVariable.ts)
// JUŻ ISTNIAŁA, w pełni przetestowana, ale nigdy nie była podpięta do żadnego
// ekranu — czysty "backend gotowy, UI zapomniane". Lista pojedynczych
// transakcji, tappable → `onSelectTransaction(id)` (WydatkiModal.tsx otwiera
// AddExpenseModal z jej "Rozlicz jako" — tam user faktycznie przełącza
// Stałe/Zmienne/Jedzenie/Transfer dla KONKRETNEGO wydatku). `overridden`
// (ręcznie ustawione przez usera, nie automatyczne rozpoznanie) dostaje małą
// ikonkę ołówka — widoczny ślad że ktoś już tu grzebał.
export default function VariableBreakdownCard({
  month, total, changePercent, previousTotal, top, transactions, onSelectTransaction,
  nonFoodCategories, expenseCategories, onSelectCategory,
}: {
  month: string;
  total: string;
  changePercent: number;
  previousTotal: string;
  top: VariableContributor[];
  transactions: FvTransaction[];
  onSelectTransaction: (id: string) => void;
  // Higiena/Chemia itp. (2026-11-10, user: "daj możliwość dodania... higiena...
  // zostają w Zmiennych, ale z własną etykietą/rozbiciem jak Jedzenie ma") —
  // ten sam kształt/wzorzec co Jedzenie's `categories` (`utils/nonFood.ts`'s
  // `nonFoodByCategory`, zwraca DOKŁADNIE kształt `FoodCategoryBar`), tap →
  // reużyty `FoodCategoryItemsModal` (WydatkiModal.tsx).
  nonFoodCategories: { label: string; amount: number; color: string; items: FoodCategoryItem[] }[];
  // Rozrywka/Transport/itp. (2026-11-10, user: "zróbmy to drugie... żeby były
  // na przykład rozrywka i tak dalej") — kategoria CAŁEGO wydatku (bez
  // rozbicia na pozycje paragonu), `utils/expenseCategory.ts`'s
  // `expenseCategoryByCategory`, ten sam kształt/wzorzec/reużycie co wyżej.
  expenseCategories: { label: string; amount: number; color: string; items: FoodCategoryItem[] }[];
  onSelectCategory: (category: { label: string; amount: number; color: string; items: FoodCategoryItem[] }) => void;
}) {
  const s = makeS();
  const maxAmount = Math.max(1, ...top.map((i) => i.amount));
  const maxCategory = Math.max(1, ...nonFoodCategories.map((c) => c.amount));
  const maxExpenseCategory = Math.max(1, ...expenseCategories.map((c) => c.amount));

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <ShoppingCart size={14} color={colors.text.secondary} />
          <Text style={s.headerLabel}>ZMIENNE · {month.toUpperCase()}</Text>
        </View>
        <Text style={s.total}>{total}</Text>
      </View>
      <Text style={s.compare}>
        {changePercent > 0 ? '+' : ''}{changePercent}% vs miesiąc temu ({previousTotal})
      </Text>

      <Text style={s.hint}>Co najbardziej przeważyło</Text>

      {top.length === 0 ? (
        <Text style={s.empty}>Brak zmiennych wydatków w tym miesiącu.</Text>
      ) : (
        <View style={s.items}>
          {top.map((it) => (
            <View key={it.label} style={s.itemRow}>
              <Text style={s.itemLabel} numberOfLines={1}>{it.label}</Text>
              <View style={s.itemBarTrack}>
                <View style={[s.itemBar, { width: `${Math.max(3, (it.amount / maxAmount) * 100)}%` }]} />
              </View>
              <Text style={s.itemAmount}>{it.amount} zł</Text>
            </View>
          ))}
        </View>
      )}

      {nonFoodCategories.length > 0 && (
        <>
          <Text style={s.hint}>Higiena i chemia</Text>
          <View style={s.items}>
            {nonFoodCategories.map((c) => (
              <TouchableOpacity key={c.label} style={s.categoryRow} onPress={() => { haptic.tap(); onSelectCategory(c); }} activeOpacity={0.7}>
                <View style={[s.dot, { backgroundColor: c.color }]} />
                <Text style={s.itemLabel} numberOfLines={1}>{c.label}</Text>
                <View style={s.itemBarTrack}>
                  <View style={[s.itemBar, { width: `${Math.max(3, (c.amount / maxCategory) * 100)}%`, backgroundColor: c.color }]} />
                </View>
                <Text style={s.itemAmount}>{c.amount} zł</Text>
                <ChevronRight size={14} color={colors.text.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {expenseCategories.length > 0 && (
        <>
          <Text style={s.hint}>Inne kategorie</Text>
          <View style={s.items}>
            {expenseCategories.map((c) => (
              <TouchableOpacity key={c.label} style={s.categoryRow} onPress={() => { haptic.tap(); onSelectCategory(c); }} activeOpacity={0.7}>
                <View style={[s.dot, { backgroundColor: c.color }]} />
                <Text style={s.itemLabel} numberOfLines={1}>{c.label}</Text>
                <View style={s.itemBarTrack}>
                  <View style={[s.itemBar, { width: `${Math.max(3, (c.amount / maxExpenseCategory) * 100)}%`, backgroundColor: c.color }]} />
                </View>
                <Text style={s.itemAmount}>{c.amount} zł</Text>
                <ChevronRight size={14} color={colors.text.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {transactions.length > 0 && (
        <>
          <Text style={s.hint}>Wszystkie transakcje · stuknij, żeby przeklasyfikować</Text>
          <View style={s.txList}>
            {transactions.map((tx) => (
              <TouchableOpacity
                key={tx.id}
                style={s.txRow}
                activeOpacity={0.7}
                onPress={() => { haptic.tap(); onSelectTransaction(tx.id); }}
              >
                <Text style={s.txDate}>{fmtTxDate(tx.date)}</Text>
                <Text style={s.txLabel} numberOfLines={1}>{tx.label}</Text>
                {tx.overridden ? <Pencil size={11} color={colors.text.muted} style={s.txPencil} /> : null}
                <Text style={s.txAmount}>{tx.amount} zł</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[4], marginBottom: spacing[4],
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  headerLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary, letterSpacing: 0.5 },
  total: { fontSize: 22, fontFamily: 'Inter_900Black', color: c.text.bright },
  compare: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 4 },

  hint: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[4], marginBottom: spacing[2] },
  empty: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, paddingVertical: spacing[3] },

  items: { gap: spacing[3] },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  itemLabel: { width: 100, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  itemBarTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  itemBar: { height: '100%', borderRadius: 999, backgroundColor: c.text.bright },
  itemAmount: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary, minWidth: 48, textAlign: 'right' },

  txList: { gap: spacing[1] },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: c.border.default,
  },
  txDate: { width: 44, fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted },
  txLabel: { flex: 1, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  txPencil: { marginRight: 2 },
  txAmount: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
}));
