import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StatTile, { getTilePosition } from '@/components/dashboard/StatTile';
import FactTile from '@/components/dashboard/FactTile';
import SleepTile from '@/components/dashboard/SleepTile';
import TaskListTile, { type Task, type TaskTag } from '@/components/dashboard/TaskListTile';
import FoodBarsTile, { type BarColumn } from '@/components/dashboard/FoodBarsTile';
import WydatkiModal from '@/components/dashboard/WydatkiModal';
import { type FoodWeek, type FoodCategory } from '@/components/dashboard/FoodBreakdownCard';
import { colors } from '@/theme/colors';
import { spacing, themedStyles } from '@/theme';
import { useCalendarStore } from '@/store/calendarStore';
import { todayISO } from '@/utils/date';

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
// Kafelek Zadań i "najbliższy termin" ZASTĄPIONE realnymi danymi z `calendarStore`
// (2026-11-01, user: "zadania które dodaję żeby pokazywały się już realnie na
// dashboardzie") — patrz `dashboardTasks`/`nextDeadlineTask` w komponencie niżej.
// Pokazują te same 4 stany systemu tagów (2026-10-27) co dawny mock, tylko liczone
// z prawdziwych zadań: nazwany skrót (pierwszy tag), pilne (termin dziś/po terminie),
// przypomnienie (ma termin w przyszłości), bez taga (ani jedno, ani drugie).
const MOCK_FOOD_COLUMNS: BarColumn[] = [
  { label: '~ŚR', value: 843, display: '843', kind: 'average' },
  { label: 'MAJ', value: 940, display: '940', kind: 'bar' },
  { label: 'CZER', value: 793, display: '793', kind: 'bar' },
  { label: 'LIP', value: 820, display: '820', kind: 'bar' },
  { label: 'SIER', value: 452, display: '452', kind: 'highlight' },
];

// Szczegóły wydatków na jedzenie — NIE na Dashboardzie na stałe (2026-10-31, user:
// "mieliśmy robić nieskrollowalny ekran żeby nie było chaosu... lepiej mniej
// informacji ale popup po kliknięciu na zakładkę #wydatki" — poprzednia wersja
// wrzuciła pełną `FoodBreakdownCard` jako piąty rząd i zmusiła Dashboard do scrolla,
// co było świadomie odrzucone wcześniej ustalenie). Mock 1:1 z tego co user pokazał
// ze screenshota sapp, ale teraz renderowany w `WydatkiModal` (pełnoekranowy popup),
// otwieranym tapem w ISTNIEJĄCY kafel "22,4 PLN DZIENNIE #JEDZENIE" niżej — zero
// NOWEGO elementu na samym Dashboardzie, patrz komentarz w WydatkiModal.tsx.
const MOCK_FOOD_WEEKS: FoodWeek[] = [
  { label: 'T1', value: 147 },
  { label: 'T2', value: 197 },
  { label: 'T3', value: 166 },
  { label: 'T4', value: 208 },
  { label: 'T5', value: 105 },
];
const MOCK_FOOD_CATEGORIES: FoodCategory[] = [
  { label: 'Pieczywo', amount: 177, color: '#E0A458' },
  { label: 'Nabiał', amount: 166, color: '#E0C040' },
  { label: 'Słodycze', amount: 144, color: '#A78BFA' },
  { label: 'Mięso', amount: 79, color: '#E06A6A' },
  { label: 'Warzywa', amount: 73, color: '#4CC38A' },
  { label: 'Napoje', amount: 44, color: '#4FC3E0' },
  { label: 'Inne jedzenie', amount: 40, color: '#8A8A8A' },
  { label: 'Przekąski', amount: 40, color: '#E0A458' },
  { label: 'Owoce', amount: 26, color: '#E06A6A' },
  { label: 'Sosy', amount: 25, color: '#E0914A' },
  { label: 'Mąka i produkty', amount: 5, color: '#D8C9A0' },
  { label: 'Ryż i kasze', amount: 4, color: '#B98A5A' },
];

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const s = makeS();
  const [wydatkiOpen, setWydatkiOpen] = useState(false);
  const calendarTasks = useCalendarStore((st) => st.tasks);
  const today = todayISO();

  // Do 4 pozycji: najpierw z terminem (rosnąco), potem bez terminu (najnowsze
  // pierwsze) — ten sam porządek co sekcje Teraz/Terminowe w tasks.tsx.
  const dashboardTasks = useMemo<Task[]>(() => {
    const pending = calendarTasks.filter((t) => t.status === 'pending');
    const withDeadline = pending.filter((t) => t.deadline).sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));
    const withoutDeadline = pending.filter((t) => !t.deadline).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return [...withDeadline, ...withoutDeadline].slice(0, 4).map((t) => {
      const deadlineYmd = t.deadline?.slice(0, 10);
      let tag: TaskTag;
      if (deadlineYmd && deadlineYmd <= today) tag = { kind: 'urgent' };
      else if (t.tags.length > 0) tag = { kind: 'label', text: t.tags[0], color: colors.accent.blue };
      else if (deadlineYmd) tag = { kind: 'bell', color: colors.stat.event };
      else tag = { kind: 'empty' };
      return { id: t.id, title: t.title, tag };
    });
  }, [calendarTasks, today]);

  const nextDeadlineTask = useMemo(
    () => calendarTasks
      .filter((t) => t.status === 'pending' && t.deadline)
      .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))[0],
    [calendarTasks],
  );
  const daysUntilDeadline = useMemo(() => {
    if (!nextDeadlineTask?.deadline) return null;
    const d = nextDeadlineTask.deadline.slice(0, 10);
    const diff = Math.round((new Date(`${d}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
    return Math.max(0, diff);
  }, [nextDeadlineTask, today]);

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
        <TaskListTile position={getTilePosition(0, 2)} tasks={dashboardTasks} />
        <StatTile
          position={getTilePosition(1, 2)}
          value={daysUntilDeadline != null ? String(daysUntilDeadline) : '–'}
          unit="DNI"
          variant="event"
          detail={nextDeadlineTask?.title ?? 'Brak terminów'}
        />
      </View>

      <View style={[s.row, s.rowGap]}>
        <StatTile
          position={getTilePosition(0, 2)}
          value="22,4"
          unit="PLN"
          label={'DZIENNIE\n#JEDZENIE'}
          onPress={() => setWydatkiOpen(true)}
        />
        <FoodBarsTile
          position={getTilePosition(1, 2)}
          title="#JedzeniePerMiesiąc"
          columns={MOCK_FOOD_COLUMNS}
        />
      </View>

      <WydatkiModal
        visible={wydatkiOpen}
        onClose={() => setWydatkiOpen(false)}
        month="Październik"
        total="823 zł"
        changePercent={-38}
        previousTotal="1321 zł"
        weeks={MOCK_FOOD_WEEKS}
        categories={MOCK_FOOD_CATEGORIES}
      />
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  // Dashboard WRACA do nieprzewijalnego ekranu (2026-10-31, user: "mieliśmy robić
  // nieskrollowalny ekran żeby nie było chaosu" — ScrollView dodany w poprzedniej
  // rundzie dla pełnej `FoodBreakdownCard` był błędem, usunięty razem z tamtym
  // kaflem; szczegóły żyją teraz w `WydatkiModal`, osobnym popupie z WŁASNYM
  // scrollem). Stałe 4 rzędy zawsze mieszczą się na ekranie, jak przed tą zmianą.
  safe: { flex: 1, backgroundColor: c.bg.primary, paddingHorizontal: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[1] },
  rowGap: { marginTop: spacing[1] },
}));
