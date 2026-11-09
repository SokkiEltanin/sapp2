import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Repeat, TrendingUp, TrendingDown, Pencil } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { haptic } from '@/utils/haptics';
import type { FixedItem, FixedDeviation, FvTransaction } from '@/utils/fixedVariable';

function fmtTxDate(ymd: string): string {
  const [y, m, d] = (ymd || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' });
}

// Zakładka "Stałe" w popupie Wydatki (Faza 2.4, 2026-11-01) — bliźniak
// `FoodBreakdownCard.tsx`, ten sam układ karty (nagłówek+suma, porównanie do
// poprzedniego miesiąca, lista pozycji z paskiem). Bez tygodniowego wykresu —
// rachunki stałe to już miesięczne kwoty, nie ma sensownego podziału na tygodnie
// (w odróżnieniu od Jedzenia). Odznaka odchylenia (`fixedDeviations`, już
// przetestowane w `fixedVariable.ts`) pokazuje się TYLKO przy pozycji z
// rozpoznanym, nietypowym skokiem względem jej własnej historii — reszta pozycji
// bez odznaki, nie "0%" wszędzie.
//
// "Wszystkie transakcje" DOŁĄCZONE 2026-11-09 — ten sam fix/uzasadnienie co
// `VariableBreakdownCard.tsx` (user: "nie moge edytowac tam i klikać co jest
// zmienna a co nie") — `bucketTransactions` była gotowa i przetestowana, nigdy
// nie podpięta do żadnego ekranu.
export default function FixedBreakdownCard({
  month, total, changePercent, previousTotal, items, deviations, transactions, onSelectTransaction,
}: {
  month: string;
  total: string;
  changePercent: number;
  previousTotal: string;
  items: FixedItem[];
  deviations: FixedDeviation[];
  transactions: FvTransaction[];
  onSelectTransaction: (id: string) => void;
}) {
  const s = makeS();
  const maxAmount = Math.max(1, ...items.map((i) => i.amount));
  const deviationByLabel = new Map(deviations.map((d) => [d.label, d]));

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <Repeat size={14} color={colors.text.secondary} />
          <Text style={s.headerLabel}>STAŁE · {month.toUpperCase()}</Text>
        </View>
        <Text style={s.total}>{total}</Text>
      </View>
      <Text style={s.compare}>
        {changePercent > 0 ? '+' : ''}{changePercent}% vs miesiąc temu ({previousTotal})
      </Text>

      <Text style={s.hint}>Rachunki tego miesiąca</Text>

      {items.length === 0 ? (
        <Text style={s.empty}>Brak rozpoznanych rachunków stałych w tym miesiącu.</Text>
      ) : (
        <View style={s.items}>
          {items.map((it) => {
            const dev = deviationByLabel.get(it.label);
            return (
              <View key={it.label} style={s.itemRow}>
                <Text style={s.itemLabel} numberOfLines={1}>{it.label}</Text>
                <View style={s.itemBarTrack}>
                  <View style={[s.itemBar, { width: `${Math.max(3, (it.amount / maxAmount) * 100)}%` }]} />
                </View>
                <Text style={s.itemAmount}>{it.amount} zł</Text>
                {dev && (
                  <View style={[s.deviationBadge, dev.deltaPct > 0 ? s.deviationUp : s.deviationDown]}>
                    {dev.deltaPct > 0 ? <TrendingUp size={10} color={colors.accent.red} /> : <TrendingDown size={10} color={colors.accent.green} />}
                    <Text style={[s.deviationLabel, dev.deltaPct > 0 ? s.deviationLabelUp : s.deviationLabelDown]}>
                      {dev.deltaPct > 0 ? '+' : ''}{Math.round(dev.deltaPct * 100)}%
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
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
  itemLabel: { width: 90, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  itemBarTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  itemBar: { height: '100%', borderRadius: 999, backgroundColor: c.text.bright },
  itemAmount: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary, minWidth: 48, textAlign: 'right' },

  deviationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: radius.full,
  },
  deviationUp: { backgroundColor: `${colors.accent.red}1A` },
  deviationDown: { backgroundColor: `${colors.accent.green}1A` },
  deviationLabel: { fontSize: 9.5, fontFamily: 'Inter_700Bold' },
  deviationLabelUp: { color: colors.accent.red },
  deviationLabelDown: { color: colors.accent.green },

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
