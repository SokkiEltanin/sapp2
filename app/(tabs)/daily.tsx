import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Droplet, Dumbbell, Footprints, Scale, Smile } from 'lucide-react-native';
import { spacing, radius, themedStyles } from '@/theme';
import { todayISO } from '@/utils/date';
import { MOOD_EMOJIS } from '@/types/mood';
import { useMoodStore } from '@/store/moodStore';
import ComingSoonRow from '@/components/ui/ComingSoonRow';
import LiveSectionRow from '@/components/ui/LiveSectionRow';
import MoodModal from '@/components/mood/MoodModal';

// Szkielet struktury (2026-10-29) + HUMOR podpięty jako pierwsza realna sekcja
// (2026-10-31, user: "dodawanie humoru... z taką siatką jak w sapp"). Reszta sekcji
// 1:1 z ARCHITECTURE.md §DAILY, wciąż "Wkrótce" — JEDZENIE świadomie POMINIĘTE (user:
// "nie sprawdzała się w SAPP... zostawiamy potencjał/miejsce, NIE dodajemy jej teraz").
const PLACEHOLDER_SECTIONS = [
  { key: 'zdrowie', label: 'Zdrowie', description: 'woda', icon: Droplet },
  { key: 'cwiczenia', label: 'Ćwiczenia', description: 'treningi, powiązane z Pupilem', icon: Dumbbell },
  { key: 'kroki', label: 'Kroki', description: 'z zegarka', icon: Footprints },
  { key: 'waga', label: 'Waga', icon: Scale },
] as const;

export default function DailyScreen() {
  const s = makeS();
  const entries = useMoodStore((st) => st.entries);
  const [moodOpen, setMoodOpen] = useState(false);

  const todayEntries = useMemo(() => entries.filter((e) => e.date === todayISO()), [entries]);
  const lastToday = todayEntries[todayEntries.length - 1];
  const humorStatus = lastToday ? `${MOOD_EMOJIS[lastToday.mood]} zapisane` : 'Zapisz →';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Daily</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.card}>
          <LiveSectionRow icon={Smile} label="Humor" status={humorStatus} onPress={() => setMoodOpen(true)} />
          {PLACEHOLDER_SECTIONS.map((section, i) => (
            <ComingSoonRow
              key={section.key}
              icon={section.icon}
              label={section.label}
              description={'description' in section ? section.description : undefined}
              isLast={i === PLACEHOLDER_SECTIONS.length - 1}
            />
          ))}
        </View>
      </ScrollView>

      <MoodModal visible={moodOpen} onClose={() => setMoodOpen(false)} />
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
