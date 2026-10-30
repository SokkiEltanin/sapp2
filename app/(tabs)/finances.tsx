import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Briefcase, Repeat } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import ComingSoonRow from '@/components/ui/ComingSoonRow';

// Szkielet struktury (2026-10-29, "zacznij budować szkielet pod finanse, kalendarz,
// zadania" — lekka struktura, pełna logika w ustalonej kolejności faz: Kalendarz/
// Zadania UI PRZED Finansami, patrz NEXT_STEPS.md "Następna wielka faza"). Sekcje
// wg ARCHITECTURE.md §FINANSE: duża liczba (saldo), historia transakcji (max 3-4,
// nie cała lista), Praca, Subskrypcje. POJAZDY/PRODUKTY świadomie POMINIĘTE —
// ARCHITECTURE.md: "odłożone na koniec", nawet jako wiersz "Wkrótce" to na razie
// za wcześnie. "Jeden ujednolicony dodaj" (FAB) — też pominięty na razie, czeka na
// rozstrzygnięcie "Kolizja lewy dolny róg" w NEXT_STEPS.md, żeby nie dublować
// miejsca z Ustawieniami.
export default function FinancesScreen() {
  const s = makeS();
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Finanse</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Saldo</Text>
          <Text style={[s.balanceValue, { color: colors.text.bright }]}>0,00 zł</Text>
        </View>

        <Text style={s.sectionTitle}>Ostatnie transakcje</Text>
        <View style={s.card}>
          <Text style={s.empty}>Brak transakcji — pojawią się tutaj po Fazie 2 (parsery).</Text>
        </View>

        <Text style={s.sectionTitle}>Obszary</Text>
        <View style={s.card}>
          <ComingSoonRow icon={Briefcase} label="Praca" description="zmiany, godziny, wypłaty" />
          <ComingSoonRow icon={Repeat} label="Subskrypcje" description="cykliczne płatności" isLast />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  title: { fontSize: 22, fontFamily: 'Inter_900Black', color: c.text.primary },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[8], gap: spacing[2] },
  balanceCard: {
    backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', paddingVertical: spacing[5], marginBottom: spacing[4],
  },
  balanceLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  // `colors.text.bright` (2026-10-30, redesign Dashboardu na monochromatyczny) —
  // zamiast `colors.stat.finanse`, spójnie z dużymi liczbami kafli Dashboardu
  // (StatTile.tsx).
  balanceValue: { fontSize: 36, fontFamily: 'Inter_900Black', marginTop: spacing[1] },
  sectionTitle: {
    fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2], marginTop: spacing[2],
  },
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    overflow: 'hidden', marginBottom: spacing[4],
  },
  empty: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, padding: spacing[4], textAlign: 'center' },
}));
