import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StatTile, { getTilePosition } from '@/components/dashboard/StatTile';
import FactTile from '@/components/dashboard/FactTile';
import SleepTile from '@/components/dashboard/SleepTile';
import TaskListTile, { type Task } from '@/components/dashboard/TaskListTile';
import FoodBarsTile, { type BarColumn } from '@/components/dashboard/FoodBarsTile';
import { colors } from '@/theme/colors';
import { spacing, themedStyles } from '@/theme';

// Pierwsze cztery rzędy prawdziwego Dashboardu (2026-10-26) wg mockupów usera:
// rząd 1 — STREAK WODA > STREAK SŁODYCZE > INCOMING EVENT > STREAK ĆWICZENIA (kafle
// statystyk — pogoda wywalona, zastąpiona streakiem ćwiczeń, ten sam kafelek co
// WODA/SŁODYCZE); rząd 2 — CIEKAWOSTKA > SEN (kafle z dodatkowym wzorem koncentrycznym
// w tle); rząd 3 — ZADANIA (3/4 szerokości) > NAJBLIŻSZY TERMIN (1/4, patrz niżej);
// rząd 4 — FINANSE (1/4, kafel statystyk) > wykres wydatków na jedzenie per miesiąc
// (3/4). Dane na sztywno (mock) — jeszcze nie podpięte do żadnego store'a, tylko
// weryfikacja stylu na urządzeniu.
//
// Kafelek obok Zadań (2026-10-30, user: "tam gdzie lvl27 kafelek przy zadaniach
// robimy tak jak na górze mamy z tym 27 min do, tylko na zadania, np 2 dni, do
// końca, i nazwa zadania") — placeholder LevelTile/Pupil ZASTĄPIONY tym samym
// wzorcem co kafelek "INCOMING EVENT" w rzędzie 1 (StatTile `variant="event"`,
// wartość+jednostka+detail), tylko licząc czas do najbliższego terminu zadania
// zamiast do eventu. Zero nowego komponentu — to dokładnie ten sam `StatTile`,
// inne dane. `LevelTile.tsx` USUNIĘTY (nic już go nie używa) — koncept
// Pupil/poziomu wraca jako osobna, świadoma decyzja, nie jako martwy plik tutaj.
//
// MONOCHROMATYCZNY REDESIGN (2026-10-30) — user podesłał dokładny SVG-referencję:
// "wywaliłem gradienty i poprawiłem monochromatyczność... taki styl przyjmujemy dla
// całej aplikacji". Wszystkie gradienty tła (per-kategoria, po skosie/pionowe) oraz
// kolorowanie dużych liczb/etykiet/ikon kaflom `accent`-em USUNIĘTE — patrz
// StatTile.tsx/PatternTileBackground.tsx/FactTile.tsx/SleepTile.tsx/FoodBarsTile.tsx/
// TaskListTile.tsx. Jedyny kolor który ZOSTAŁ to funkcjonalne akcenty (np. kolor
// chipa taga w MOCK_TASKS niżej) — dokładnie jak w referencyjnym SVG, gdzie jedynym
// nie-neutralnym elementem był niebieski chip "UR".
// Pokazuje wszystkie 4 stany systemu tagów (2026-10-27): nazwany skrót, pilne
// (czerwone, wykrzyknik), bez taga (puste kropeczki), przypomnienie (dzwonek).
const MOCK_TASKS: Task[] = [
  { id: '1', title: 'Prezentacja Trzyna - 15 slajdów', tag: { kind: 'label', text: 'UR', color: '#1B36AF' } },
  { id: '2', title: 'Projekt Marchewka', tag: { kind: 'urgent' } },
  { id: '3', title: 'Wyrzucić śmieci !!', tag: { kind: 'empty' } },
  { id: '4', title: 'Jutro zabrać klucze!', tag: { kind: 'bell', color: colors.stat.event } },
];
const MOCK_FOOD_COLUMNS: BarColumn[] = [
  { label: '~ŚR', value: 843, display: '843', kind: 'average' },
  { label: 'MAJ', value: 940, display: '940', kind: 'bar' },
  { label: 'CZER', value: 793, display: '793', kind: 'bar' },
  { label: 'LIP', value: 820, display: '820', kind: 'bar' },
  { label: 'SIER', value: 452, display: '452', kind: 'highlight' },
];
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const s = makeS();

  return (
    <View style={[s.safe, { paddingTop: insets.top + spacing[2] }]}>
      <View style={s.row}>
        <StatTile
          position={getTilePosition(0, 4)}
          value="74"
          unit="DNI"
          label="WODA"
        />
        <StatTile
          position={getTilePosition(1, 4)}
          value="4"
          unit="DNI"
          label="SŁODYCZE"
        />
        <StatTile
          position={getTilePosition(2, 4)}
          value="27"
          unit="MINUT"
          variant="event"
          detail={'[JD] 15:00\n-21:00 (6h)'}
        />
        <StatTile
          position={getTilePosition(3, 4)}
          value="12"
          unit="DNI"
          label="ĆWICZENIA"
        />
      </View>

      <View style={[s.row, s.rowGap]}>
        <FactTile
          position={getTilePosition(0, 2)}
          text="Mózg zużywa jedną piątą energii twojego organizmu"
        />
        <SleepTile
          position={getTilePosition(1, 2)}
          duration="7h 50m"
          window="23:05 - 06:06"
        />
      </View>

      <View style={[s.row, s.rowGap]}>
        <TaskListTile position={getTilePosition(0, 2)} tasks={MOCK_TASKS} />
        <StatTile
          position={getTilePosition(1, 2)}
          value="2"
          unit="DNI"
          variant="event"
          detail={'Projekt\nMarchewka'}
        />
      </View>

      <View style={[s.row, s.rowGap]}>
        <StatTile
          position={getTilePosition(0, 2)}
          value="22,4"
          unit="PLN"
          label={'DZIENNIE\n#JEDZENIE'}
        />
        <FoodBarsTile
          position={getTilePosition(1, 2)}
          title="#JedzeniePerMiesiąc"
          columns={MOCK_FOOD_COLUMNS}
        />
      </View>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary, paddingHorizontal: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[1] },
  rowGap: { marginTop: spacing[1] },
}));
