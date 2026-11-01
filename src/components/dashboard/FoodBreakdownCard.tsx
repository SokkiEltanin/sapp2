import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Utensils, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import type { FoodCategoryItem } from '@/utils/foodStats';

// Szkielet "Jedzenie — rozkład wydatków" (2026-10-30, user podesłał screenshot
// analogicznego widoku z sapp: "musimy na dashbordzie w naszym stylu dodać takie coś
// — tylko teraz pewnie szkielet tego żeby nie zapomnieć, pasujący ile tam miejsca
// tyle weźmie ten widget" + "zapiszmy żeby wrócić jak zrobimy parser paragonów").
//
// 2026-11-01 (user: "jak klikam w jedzenie nie mam tam zrobione na popupie jak w
// sap na dashboardzie") — wiersze kategorii NIE są już mockiem/dekoracją: dane są
// realne (Faza 2.4, `foodByCategory`), więc strzałka ">" teraz faktycznie otwiera
// `FoodCategoryItemsModal` z konkretnymi pozycjami paragonów przez `onSelectCategory`
// (stan drill-down popupu żyje w WydatkiModal.tsx, wspólnym rodzicu). Przełącznik
// Tygodnie/Dni/Miesiące WCIĄŻ nieinteraktywny (zakres zawsze "ten miesiąc") — osobna,
// nieproszona jeszcze funkcja, nie udajemy klikalności której nie ma (ten sam powód
// co ComingSoonRow).
//
// Kolory kropek/pasków per-kategoria ZOSTAJĄ (nie monochromatyczne) — to funkcjonalny
// legend-akcent rozróżniający wiele pozycji na liście, dokładnie ta sama zasada co
// kolor chipa taga zadania / kolor wydarzenia z Google Calendar (patrz audyt
// monochromatyczny, NEXT_STEPS.md) — nie "kolor kategorii ekranu", tylko etykieta
// pojedynczej pozycji.
const PERIOD_TABS = ['Tygodnie', 'Dni', 'Miesiące'] as const;

export type FoodWeek = { label: string; value: number };
export type FoodCategory = { label: string; amount: number; color: string; items: FoodCategoryItem[] };

export default function FoodBreakdownCard({
  month,
  total,
  changePercent,
  previousTotal,
  weeks,
  categories,
  onSelectCategory,
}: {
  month: string;
  total: string;
  changePercent: number;
  previousTotal: string;
  weeks: FoodWeek[];
  categories: FoodCategory[];
  onSelectCategory: (category: FoodCategory) => void;
}) {
  const s = makeS();
  // `Math.max(1, ...)` — jak w FoodBarsTile, zapobiega `NaN%` wysokości/szerokości
  // słupka gdy realne dane (zamiast mocka) są w danym miesiącu zerowe.
  const maxWeek = Math.max(1, ...weeks.map((w) => w.value));
  const maxCategory = Math.max(1, ...categories.map((c) => c.amount));

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <Utensils size={14} color={colors.text.secondary} />
          <Text style={s.headerLabel}>JEDZENIE · {month.toUpperCase()}</Text>
        </View>
        <Text style={s.total}>{total}</Text>
      </View>
      <Text style={s.compare}>
        {changePercent > 0 ? '+' : ''}{changePercent}% vs miesiąc temu ({previousTotal})
      </Text>

      <View style={s.tabs}>
        {PERIOD_TABS.map((tab, i) => (
          <View key={tab} style={[s.tab, i === 0 && s.tabActive]}>
            <Text style={[s.tabLabel, i === 0 && s.tabLabelActive]}>{tab}</Text>
          </View>
        ))}
      </View>

      <View style={s.weekRow}>
        {weeks.map((w) => (
          <View key={w.label} style={s.weekCol}>
            <Text style={s.weekValue}>{w.value}</Text>
            <View style={s.weekBarTrack}>
              <View style={[s.weekBar, { height: `${Math.max(12, (w.value / maxWeek) * 100)}%` }]} />
            </View>
            <Text style={s.weekLabel}>{w.label}</Text>
          </View>
        ))}
      </View>

      <Text style={s.hint}>Co składa się na jedzenie ({month.toLowerCase()})</Text>

      <View style={s.categories}>
        {categories.map((c) => (
          <TouchableOpacity key={c.label} style={s.categoryRow} onPress={() => onSelectCategory(c)} activeOpacity={0.7}>
            <View style={[s.dot, { backgroundColor: c.color }]} />
            <Text style={s.categoryLabel} numberOfLines={1}>{c.label}</Text>
            <View style={s.categoryBarTrack}>
              <View style={[s.categoryBar, { width: `${Math.max(3, (c.amount / maxCategory) * 100)}%`, backgroundColor: c.color }]} />
            </View>
            <Text style={s.categoryAmount}>{c.amount} zł</Text>
            <ChevronRight size={14} color={colors.text.muted} />
          </TouchableOpacity>
        ))}
      </View>
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

  tabs: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1, borderColor: 'transparent' },
  tabActive: { borderColor: c.border.default, backgroundColor: c.bg.elevated },
  tabLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted },
  tabLabelActive: { color: c.text.primary },

  weekRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], marginTop: spacing[4], height: 90 },
  weekCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 4 },
  weekValue: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  weekBarTrack: { width: '70%', flex: 1, justifyContent: 'flex-end' },
  weekBar: { width: '100%', borderRadius: 6, backgroundColor: c.bg.elevated },
  weekLabel: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted },

  hint: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[4], marginBottom: spacing[2] },

  categories: { gap: spacing[3] },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dot: { width: 8, height: 8, borderRadius: 999 },
  categoryLabel: { width: 78, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  categoryBarTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  categoryBar: { height: '100%', borderRadius: 999 },
  categoryAmount: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary, minWidth: 42, textAlign: 'right' },
}));
