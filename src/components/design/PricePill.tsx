import { Text, StyleSheet } from 'react-native';
import { radius, themedStyles } from '@/theme';

// `PricePill` — design/app-design.html §Komponenty: "bg txt, tekst czarny 10/800,
// minWidth 56, wyrównanie do prawej; wpływ = obrys zielony" (`.price.p` — przychód,
// transparentne tło + zielony obrys zamiast wypełnienia, odróżnia "+" od zwykłego
// wydatku bez używania czerwieni — appka nie czerwieni wydatków, tylko wyróżnia
// przychody).
export default function PricePill({ amount, income = false }: { amount: string; income?: boolean }) {
  const s = makeS();
  return (
    <Text style={[s.base, income ? s.income : s.expense]} numberOfLines={1}>
      {income ? '+' : '−'}{amount}
    </Text>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  base: {
    fontSize: 10, fontFamily: 'Inter_800ExtraBold', paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, minWidth: 56, textAlign: 'right', flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
  expense: { backgroundColor: c.text.primary, color: c.bg.primary },
  income: { backgroundColor: 'transparent', color: c.accent.green, borderWidth: 1, borderColor: '#1e4d2e' },
}));
