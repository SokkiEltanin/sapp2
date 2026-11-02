import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Tile from '@/components/design/Tile';
import MoodPad from '@/components/design/MoodPad';
import { spacing, themedStyles } from '@/theme';
import { todayISO } from '@/utils/date';
import { useMoodStore } from '@/store/moodStore';
import MoodModal from '@/components/mood/MoodModal';

// Faza 3.3 (2026-11-01, "dawaj skończ wszystko") — Daily przebudowany na nowy
// system komponentów, układ z design/app-design.html's `#daily` (4 kolumny,
// `grid-template-rows: auto auto auto 1fr auto`). Ekran PRZESTAŁ być
// `ScrollView`-owym szkieletem (był jedyny tego typu w appce — reszta głównych
// ekranów od dawna nie scrolluje się).
//
// Realne vs stub — TA SAMA zasada co Dashboard (Faza 3.2, ARCHITECTURE.md
// §"REDESIGN RDZENIA UI"): Sen/Kroki/Tętno/Waga/Woda = Health Connect
// nieistniejący, uczciwy stub "Wkrótce" (bez `onPress`, nie udajemy
// interaktywności). Ćwiczenia = appka nie ma jeszcze store'a treningów (ten sam
// `PLACEHOLDER_SECTIONS` co wcześniej, teraz jako kafel zamiast wiersza listy).
// Nastrój = JEDYNA realna sekcja (`useMoodStore`, od 2026-10-31) — `MoodPad`
// (`mini`) pokazuje ostatni dzisiejszy wpis, tap na CAŁY wiersz otwiera
// `MoodModal.tsx` (2026-11-02: przebudowany na `AppBottomSheet`, patrz
// komentarz tam), który wewnątrz używa tego samego `MoodPad` (`big`) zamiast
// starego `MoodEnergyGrid` (USUNIĘTY, osierocony).
export default function DailyScreen() {
  const insets = useSafeAreaInsets();
  const s = makeS();
  const entries = useMoodStore((st) => st.entries);
  const [moodOpen, setMoodOpen] = useState(false);

  const todayEntries = useMemo(() => entries.filter((e) => e.date === todayISO()), [entries]);
  const lastToday = todayEntries[todayEntries.length - 1];
  const dayLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  return (
    <View style={[s.safe, { paddingTop: insets.top + spacing[2] }]}>
      <View style={s.header}>
        <Text style={s.title}>Daily</Text>
        <Text style={s.headerDate}>{dayLabel}</Text>
      </View>

      {/* Rząd 1: Sen (stub, s4) */}
      <View style={s.row}>
        <Tile style={s.sleepTile}>
          <View style={s.capRow}>
            <Text style={s.capLabel}>SEN</Text>
            <Text style={s.capUnit}>WKRÓTCE</Text>
          </View>
          <Text style={s.sleepNum}>—</Text>
        </Tile>
      </View>

      {/* Rząd 2: Kroki + Tętno (stub, s2 każdy) */}
      <View style={[s.row, s.rowGap]}>
        <StubTile label="KROKI" unit="Z ZEGARKA" />
        <StubTile label="TĘTNO" unit="WKRÓTCE" />
      </View>

      {/* Rząd 3: Waga + Woda (stub, s2 każdy) */}
      <View style={[s.row, s.rowGap]}>
        <StubTile label="WAGA" unit="WKRÓTCE" />
        <StubTile label="WODA" unit="WKRÓTCE" />
      </View>

      {/* Rząd 4 (flex): Ćwiczenia (stub, s4) */}
      <View style={[s.row, s.rowGap, s.rowFlex1]}>
        <Tile style={s.exTile} variant="static">
          <View style={s.capRow}>
            <Text style={s.capLabel}>ĆWICZENIA</Text>
          </View>
          <Text style={s.exEmpty}>Wkrótce — appka nie śledzi jeszcze treningów.</Text>
        </Tile>
      </View>

      {/* Rząd 5: Nastrój (realne, s4, cała wiersz tappable) */}
      <View style={[s.row, s.rowGap, s.moodRow]}>
        <Tile style={s.moodTile} row onPress={() => setMoodOpen(true)}>
          <MoodPad mood={lastToday?.mood} energy={lastToday?.energy} mini />
          <View style={s.moodTextCol}>
            <View style={s.capRow}>
              <Text style={s.capLabel}>NASTRÓJ</Text>
              <Text style={s.capUnit}>dotknij, by zapisać</Text>
            </View>
            <Text style={s.moodLabel} numberOfLines={1}>
              {lastToday ? 'Zapisane dziś' : 'Jeszcze nie zapisano'}
            </Text>
          </View>
        </Tile>
      </View>

      <MoodModal visible={moodOpen} onClose={() => setMoodOpen(false)} />
    </View>
  );
}

function StubTile({ label, unit }: { label: string; unit: string }) {
  const s = makeS();
  return (
    <Tile style={s.stubTile}>
      <Text style={s.stubNum}>—</Text>
      <Text style={s.stubUnit}>{unit}</Text>
      <Text style={s.stubLabel}>{label}</Text>
    </Tile>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary, paddingHorizontal: spacing[3] },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing[2], paddingHorizontal: spacing[1] },
  title: { fontSize: 22, fontFamily: 'Inter_900Black', letterSpacing: -0.5, color: c.text.bright },
  headerDate: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted, letterSpacing: 0.4 },

  row: { flexDirection: 'row', gap: spacing[2] },
  rowGap: { marginTop: spacing[2] },
  rowFlex1: { flex: 1 },

  capRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, color: c.text.primary },
  capUnit: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.text.muted },

  sleepTile: { flex: 1, justifyContent: 'space-between' },
  sleepNum: { fontSize: 30, fontFamily: 'Inter_800ExtraBold', letterSpacing: -1.2, color: c.text.bright, marginTop: spacing[2] },

  stubTile: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[3] },
  stubNum: { fontSize: 26, fontFamily: 'Inter_800ExtraBold', letterSpacing: -1, color: c.text.bright },
  stubUnit: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2, color: c.text.muted, textTransform: 'uppercase', marginTop: 4 },
  stubLabel: { fontSize: 10, fontFamily: 'Inter_800ExtraBold', letterSpacing: 0.6, textTransform: 'uppercase', color: c.text.primary, marginTop: spacing[2] },

  exTile: { flex: 1, justifyContent: 'center' },
  exEmpty: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', marginTop: spacing[2] },

  // `moodRow` (2026-11-02, bug user na urządzeniu: kafel "Nastrój" renderował się
  // jako wąski, prawie-zerowej-wysokości pasek — NIE ten sam bug co Tile.tsx fix
  // wcześniej, nowy: `s.row` tu jest JEDYNYM wierszem w tym layoucie bez `flex:1`
  // na SOBIE (w przeciwieństwie do Ćwiczeń) — jego wysokość miała wynikać z
  // auto-size na podstawie dziecka, ALE to dziecko (Tile, `flex:1` dla pełnej
  // szerokości wiersza) samo potrzebuje WYSOKOŚCI rodzica żeby się rozciągnąć —
  // krąg bez punktu zaczepienia, Yoga rozwiązuje to kolapsem do ~0. `minHeight`
  // tutaj daje konkretną liczbę do zaczepienia (76px MoodPad mini + padding
  // Tile'a), przerywa cykl. Kafle w gridach (2/3/4 w rzędzie) tego nie mają, bo
  // ICH rodzic (rząd) ma już konkretną wysokość z WYŻEJ (flex:1 na całej
  // kolumnie) — ten jeden wiersz jest inny, bo jest JEDYNYM dzieckiem swojego
  // auto-wysokościowego rodzica.
  moodRow: { minHeight: 100 },
  moodTile: { flex: 1, alignItems: 'center', gap: spacing[3] },
  moodTextCol: { flex: 1, minWidth: 0, gap: 4 },
  moodLabel: { fontSize: 15, fontFamily: 'Inter_800ExtraBold', color: c.text.bright },
}));
