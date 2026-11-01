import { View, Text, StyleSheet } from 'react-native';
import { ShoppingCart } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import type { VariableContributor } from '@/utils/fixedVariable';

// Zakładka "Zmienne" w popupie Wydatki (Faza 2.4, 2026-11-01) — trzeci kubeł obok
// Stałe/Jedzenie, ten sam układ karty co `FixedBreakdownCard.tsx`. "Top wydatki"
// (`topVariableContributors`, już przetestowane) zamiast pełnej listy — to
// dyskrecjonalne zakupy, zwykle dużo drobnych pozycji; pokazujemy co faktycznie
// przeważyło, nie każdą pojedynczą transakcję (ta jest dostępna w pełnej liście
// "Ostatnie transakcje" → "Zobacz wszystkie" na ekranie Finanse).
export default function VariableBreakdownCard({
  month, total, changePercent, previousTotal, top,
}: {
  month: string;
  total: string;
  changePercent: number;
  previousTotal: string;
  top: VariableContributor[];
}) {
  const s = makeS();
  const maxAmount = Math.max(1, ...top.map((i) => i.amount));

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
  itemLabel: { width: 100, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  itemBarTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  itemBar: { height: '100%', borderRadius: 999, backgroundColor: c.text.bright },
  itemAmount: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary, minWidth: 48, textAlign: 'right' },
}));
