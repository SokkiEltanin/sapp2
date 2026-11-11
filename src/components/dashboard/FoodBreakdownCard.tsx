import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Utensils, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import type { FoodCategoryItem } from '@/utils/foodStats';
import { haptic } from '@/utils/haptics';

// Szkielet "Jedzenie — rozkład wydatków" (2026-10-30, user podesłał screenshot
// analogicznego widoku z sapp: "musimy na dashbordzie w naszym stylu dodać takie coś
// — tylko teraz pewnie szkielet tego żeby nie zapomnieć, pasujący ile tam miejsca
// tyle weźmie ten widget" + "zapiszmy żeby wrócić jak zrobimy parser paragonów").
//
// 2026-11-01 (user: "jak klikam w jedzenie nie mam tam zrobione na popupie jak w
// sap na dashboardzie") — wiersze kategorii NIE są już mockiem/dekoracją: dane są
// realne (Faza 2.4, `foodByCategory`), więc strzałka ">" teraz faktycznie otwiera
// `FoodCategoryItemsModal` z konkretnymi pozycjami paragonów przez `onSelectCategory`
// (stan drill-down popupu żyje w WydatkiModal.tsx, wspólnym rodzicu).
//
// Przełącznik Tygodnie/Dni/Miesiące DZIAŁA (2026-11-11, user: "na jedzeniu nie
// działa per dzień i per miesiąc" — wcześniej był atrapą): Tygodnie = T1–T5
// oglądanego miesiąca, Dni = każdy dzień oglądanego miesiąca (wartość tylko nad
// najwyższym słupkiem, reszta byłaby nieczytelna przy 31 słupkach), Miesiące =
// ostatnie 6 kończąc na oglądanym (bieżący jaśniejszy).
//
// Kolory kropek/pasków per-kategoria ZOSTAJĄ (nie monochromatyczne) — to funkcjonalny
// legend-akcent rozróżniający wiele pozycji na liście, dokładnie ta sama zasada co
// kolor chipa taga zadania / kolor wydarzenia z Google Calendar (patrz audyt
// monochromatyczny, NEXT_STEPS.md) — nie "kolor kategorii ekranu", tylko etykieta
// pojedynczej pozycji.
const PERIOD_TABS = [
  { key: 'weeks', label: 'Tygodnie' },
  { key: 'days', label: 'Dni' },
  { key: 'months', label: 'Miesiące' },
] as const;
type Period = (typeof PERIOD_TABS)[number]['key'];

export type FoodWeek = { label: string; value: number };
export type FoodCategory = { label: string; amount: number; color: string; items: FoodCategoryItem[] };

export default function FoodBreakdownCard({
  month,
  total,
  changePercent,
  previousTotal,
  weeks,
  days,
  months,
  categories,
  onSelectCategory,
}: {
  month: string;
  total: string;
  changePercent: number;
  previousTotal: string;
  weeks: FoodWeek[];
  days: FoodWeek[];
  months: FoodWeek[];
  categories: FoodCategory[];
  onSelectCategory: (category: FoodCategory) => void;
}) {
  const s = makeS();
  // `Math.max(1, ...)` — jak w FoodBarsTile, zapobiega `NaN%` wysokości/szerokości
  // słupka gdy realne dane (zamiast mocka) są w danym miesiącu zerowe.
  const [period, setPeriod] = useState<Period>('weeks');
  const bars = period === 'weeks' ? weeks : period === 'days' ? days : months;
  const maxBar = Math.max(1, ...bars.map((w) => w.value));
  const maxCategory = Math.max(1, ...categories.map((c) => c.amount));
  const isDays = period === 'days';
  const peakIdx = bars.reduce((best, b, i) => (b.value > bars[best].value ? i : best), 0);
  const daysWithFood = days.filter((d) => d.value > 0);
  const dayAvg = daysWithFood.length ? Math.round(daysWithFood.reduce((a, d) => a + d.value, 0) / days.length) : 0;

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
        {PERIOD_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, period === tab.key && s.tabActive]}
            onPress={() => { haptic.tap(); setPeriod(tab.key); }}
            activeOpacity={0.7}
          >
            <Text style={[s.tabLabel, period === tab.key && s.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[s.weekRow, isDays && s.dayRow]}>
        {bars.map((w, i) => {
          const isLastMonth = period === 'months' && i === bars.length - 1;
          return (
            <View key={`${period}_${w.label}_${i}`} style={s.weekCol}>
              {!isDays && <Text style={s.weekValue} numberOfLines={1}>{w.value}</Text>}
              <View style={[s.weekBarTrack, isDays && s.dayBarTrack]}>
                <View style={[
                  s.weekBar,
                  isDays && s.dayBar,
                  isLastMonth && s.barCurrent,
                  { height: `${Math.max(isDays ? 4 : 12, (w.value / maxBar) * 100)}%` },
                ]} />
              </View>
              {!isDays && <Text style={s.weekLabel} numberOfLines={1}>{w.label}</Text>}
            </View>
          );
        })}
      </View>
      {/* Dni: 28–31 wąskich słupków — etykieta pod każdym się nie mieści, więc
          oś pod spodem (1 / połowa / ostatni), a wartość szczytu w podpisie. */}
      {isDays && (
        <View style={s.dayAxis}>
          <Text style={s.weekLabel}>1</Text>
          <Text style={s.weekLabel}>{Math.ceil(days.length / 2)}</Text>
          <Text style={s.weekLabel}>{days.length}</Text>
        </View>
      )}
      {isDays && (
        <Text style={s.periodNote}>
          średnio {dayAvg} zł/dzień · najwięcej {bars[peakIdx]?.value ?? 0} zł ({bars[peakIdx]?.label}. dzień)
        </Text>
      )}

      <Text style={s.hint}>Co składa się na jedzenie ({month.toLowerCase()})</Text>

      <View style={s.categories}>
        {categories.map((c) => (
          <TouchableOpacity key={c.label} style={s.categoryRow} onPress={() => { haptic.tap(); onSelectCategory(c); }} activeOpacity={0.7}>
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
  dayRow: { gap: 2 },
  dayBarTrack: { width: '100%' },
  dayBar: { borderRadius: 2, backgroundColor: c.text.muted },
  dayAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  barCurrent: { backgroundColor: c.text.secondary },
  periodNote: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2] },

  hint: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[4], marginBottom: spacing[2] },

  categories: { gap: spacing[3] },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dot: { width: 8, height: 8, borderRadius: 999 },
  categoryLabel: { width: 78, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  categoryBarTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  categoryBar: { height: '100%', borderRadius: 999 },
  categoryAmount: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary, minWidth: 42, textAlign: 'right' },
}));
