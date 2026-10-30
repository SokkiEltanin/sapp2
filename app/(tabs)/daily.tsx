import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Droplet, Dumbbell, Footprints, Scale, Smile } from 'lucide-react-native';
import { spacing, radius, themedStyles } from '@/theme';
import ComingSoonRow from '@/components/ui/ComingSoonRow';

// Szkielet struktury (2026-10-29, user: "zacznij budować szkielet pod finanse,
// kalendarz, zadania, itp", potwierdzone: lekka struktura wg ARCHITECTURE.md, bez
// głębokiej logiki — ta wchodzi dopiero w ustalonej kolejności faz, Daily nie jest
// nawet w tej kolejce jeszcze). Sekcje 1:1 z ARCHITECTURE.md §DAILY: ZDROWIE/
// ĆWICZENIA/KROKI/WAGA/HUMOR. JEDZENIE świadomie POMINIĘTE — user: "nie sprawdzała
// się w SAPP... zostawiamy potencjał/miejsce, NIE dodajemy jej teraz" — więc żadnej
// karty tutaj, nie tylko wyłączonej.
//
// `accent` per-sekcja USUNIĘTY (2026-10-30, monochromatyczny redesign — patrz
// ComingSoonRow.tsx) — odznaki ikon teraz neutralne, tak jak wszędzie indziej.
const SECTIONS = [
  { key: 'zdrowie', label: 'Zdrowie', description: 'woda', icon: Droplet },
  { key: 'cwiczenia', label: 'Ćwiczenia', description: 'treningi, powiązane z Pupilem', icon: Dumbbell },
  { key: 'kroki', label: 'Kroki', description: 'z zegarka', icon: Footprints },
  { key: 'waga', label: 'Waga', icon: Scale },
  { key: 'humor', label: 'Humor', icon: Smile },
] as const;

export default function DailyScreen() {
  const s = makeS();
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Daily</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.card}>
          {SECTIONS.map((section, i) => (
            <ComingSoonRow
              key={section.key}
              icon={section.icon}
              label={section.label}
              description={'description' in section ? section.description : undefined}
              isLast={i === SECTIONS.length - 1}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  title: { fontSize: 22, fontFamily: 'Inter_900Black', color: c.text.primary },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] },
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    overflow: 'hidden',
  },
}));
