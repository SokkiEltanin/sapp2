import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';

// Szkielet struktury (2026-10-29, "zacznij budować szkielet pod finanse, kalendarz,
// zadania" — lekka struktura wg ARCHITECTURE.md §ZADANIA, pełna logika dopiero w
// ustalonej kolejności faz: ta zakładka jest PIERWSZA w kolejce po warstwie danych
// kalendarza — Faza 1b, patrz NEXT_STEPS.md — ale wciąż po zweryfikowaniu Fazy 1a na
// urządzeniu). Pasek kalendarza = statyczny podgląd BIEŻĄCEGO tygodnia (żadnych
// prawdziwych wydarzeń/kropek jeszcze — to wymaga realnego podpięcia
// `calendarStore`, nie jest tu). Sekcje TERAZ/Bezterminowe/Terminowe — logika z
// sapp (zadanie #42 tam), UI/UX od zera (jeszcze nieporobione, tylko nagłówki).
const DAY_LABELS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];

function getCurrentWeek(): { label: string; dayNum: number; isToday: boolean }[] {
  const today = new Date();
  const dow = today.getDay(); // 0=Nd..6=Sob
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  return DAY_LABELS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label, dayNum: d.getDate(), isToday: d.toDateString() === today.toDateString() };
  });
}

const SECTIONS = [
  { key: 'teraz', title: 'Teraz', hint: 'Aktywne zadania na dziś.' },
  { key: 'bezterminowe', title: 'Bezterminowe', hint: 'Bez deadline’u, robione kiedy jest czas.' },
  { key: 'terminowe', title: 'Terminowe', hint: 'Z konkretnym terminem.' },
] as const;

export default function TasksScreen() {
  const s = makeS();
  const week = useMemo(getCurrentWeek, []);
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Zadania</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.weekStrip}>
          {week.map((d) => (
            <View key={d.label} style={[s.dayCell, d.isToday && s.dayCellToday]}>
              <Text style={[s.dayLabel, d.isToday && s.dayLabelToday]}>{d.label}</Text>
              <Text style={[s.dayNum, d.isToday && s.dayLabelToday]}>{d.dayNum}</Text>
            </View>
          ))}
        </View>

        {SECTIONS.map((section) => (
          <View key={section.key} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <View style={s.card}>
              <Text style={s.empty}>{section.hint} Lista wkrótce.</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  title: { fontSize: 22, fontFamily: 'Inter_900Black', color: c.text.primary },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] },
  weekStrip: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[2], marginBottom: spacing[4],
  },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: spacing[2], borderRadius: radius.md, gap: 2 },
  dayCellToday: { backgroundColor: colors.accent.blue },
  dayLabel: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted, textTransform: 'uppercase' },
  dayNum: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  dayLabelToday: { color: c.bg.primary },
  section: { marginBottom: spacing[4] },
  sectionTitle: {
    fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2],
  },
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    overflow: 'hidden',
  },
  empty: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, padding: spacing[4], textAlign: 'center' },
}));
