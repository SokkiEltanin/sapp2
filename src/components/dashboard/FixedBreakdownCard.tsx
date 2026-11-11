import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Repeat, TrendingUp, TrendingDown, Pencil, ChevronRight, ChevronDown } from 'lucide-react-native';
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
// Paski KLIKALNE, osobna lista "Wszystkie transakcje" USUNIĘTA (2026-11-11, user
// zrzutem: "te z paskami zrób klikalne i odnoszące do płatności, bo teraz się
// powiela... wywalamy listę z dołu żeby się nie dublować"). Pasek = suma
// transakcji o tej samej etykiecie (`fixedBreakdown` i `bucketTransactions`
// liczą etykietę tym samym `labelFor`, zbiór transakcji identyczny — nic nie
// ginie). Jedna płatność → tap otwiera jej edycję ("Rozlicz jako" itd.); kilka →
// pasek rozwija się i pokazuje je pod sobą. Ołówek = któraś ręcznie
// przeklasyfikowana.
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
  const txByLabel = new Map<string, FvTransaction[]>();
  for (const tx of transactions) txByLabel.set(tx.label, [...(txByLabel.get(tx.label) ?? []), tx]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const onItemPress = (label: string) => {
    const txs = txByLabel.get(label) ?? [];
    haptic.tap();
    if (txs.length === 1) onSelectTransaction(txs[0].id);
    else if (txs.length > 1) setExpanded((cur) => (cur === label ? null : label));
  };

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
            const txs = txByLabel.get(it.label) ?? [];
            const isOpen = expanded === it.label;
            return (
              <View key={it.label}>
              <TouchableOpacity style={s.itemRow} onPress={() => onItemPress(it.label)} activeOpacity={0.7} disabled={txs.length === 0}>
                <View style={s.itemLabelCol}>
                  <Text style={s.itemLabel} numberOfLines={1}>{it.label}</Text>
                  <Text style={s.itemSub} numberOfLines={1}>
                    {txs.length === 1 ? fmtTxDate(txs[0].date) : `${txs.length} płatności`}
                  </Text>
                </View>
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
                {txs.some((t) => t.overridden) ? <Pencil size={11} color={colors.text.muted} /> : null}
                {txs.length > 1
                  ? (isOpen ? <ChevronDown size={14} color={colors.text.muted} /> : <ChevronRight size={14} color={colors.text.muted} />)
                  : <ChevronRight size={14} color={colors.text.muted} />}
              </TouchableOpacity>
              {isOpen && (
                <View style={s.txList}>
                  {txs.map((tx) => (
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
              )}
              </View>
            );
          })}
        </View>
      )}
      {items.length > 0 && <Text style={s.footHint}>Stuknij rachunek, żeby go edytować albo przeklasyfikować.</Text>}
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
  itemLabelCol: { width: 96 },
  itemLabel: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  itemSub: { fontSize: 10, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 1 },
  footHint: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[3] },
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

  txList: { gap: spacing[1], marginTop: spacing[1], paddingLeft: spacing[3] },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: c.border.default,
  },
  txDate: { width: 44, fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted },
  txLabel: { flex: 1, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  txPencil: { marginRight: 2 },
  txAmount: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
}));
