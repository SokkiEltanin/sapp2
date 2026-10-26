import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, CloudSun } from 'lucide-react-native';
import StatTile, { getTilePosition } from '@/components/dashboard/StatTile';
import FactTile from '@/components/dashboard/FactTile';
import SleepTile from '@/components/dashboard/SleepTile';
import TaskListTile, { type Task } from '@/components/dashboard/TaskListTile';
import LevelTile from '@/components/dashboard/LevelTile';
import FoodBarsTile, { type BarColumn } from '@/components/dashboard/FoodBarsTile';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';

// Tymczasowa ikonka Ustawień (prawy górny róg) — Settings docelowo nie będzie osobną
// zakładką, ale na razie to jedyne wejście żeby przetestować logowanie Google/Firebase/
// Calendar. Zniknie/przeniesie się jak zaprojektujemy prawdziwy dashboard.
//
// Pierwsze cztery rzędy prawdziwego Dashboardu (2026-10-26) wg mockupów usera:
// rząd 1 — STREAK WODA > STREAK SŁODYCZE > INCOMING EVENT > POGODA (kafle statystyk,
// gradient pionowy); rząd 2 — CIEKAWOSTKA > SEN (kafle z dodatkowym wzorem koncentrycznym
// w tle + gradient po skosie); rząd 3 — ZADANIA (3/4 szerokości) > PUPIL/LVL (1/4,
// placeholder, nieustalone jeszcze); rząd 4 — FINANSE (1/4, kafel statystyk) > wykres
// wydatków na jedzenie per miesiąc (3/4). Dane na sztywno (mock) — jeszcze nie podpięte
// do żadnego store'a, tylko weryfikacja stylu na urządzeniu.
const MOCK_TASKS: Task[] = [
  { id: '1', title: 'Prezentacja Trzyna - 15 slajdów', tag: { kind: 'label', text: 'UR', color: '#1B36AF' } },
  { id: '2', title: 'Projekt Marchewka', tag: { kind: 'label', text: 'UR', color: '#1B36AF' } },
  { id: '3', title: 'Wyrzucić śmieci !!', tag: { kind: 'dots', color: '#A7ADBD' } },
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
          accent={colors.stat.woda}
          value="74"
          unit="DNI"
          label="WODA"
        />
        <StatTile
          position={getTilePosition(1, 4)}
          accent={colors.stat.slodycze}
          value="4"
          unit="DNI"
          label="SŁODYCZE"
        />
        <StatTile
          position={getTilePosition(2, 4)}
          accent={colors.stat.event}
          value="27"
          unit="MINUT"
          variant="event"
          detail={'[JD]\n15:00-21:00\n(6h)'}
        />
        <StatTile
          position={getTilePosition(3, 4)}
          accent={colors.stat.pogoda}
          value="12°"
          variant="weather"
          icon={<CloudSun size={36} color={colors.stat.pogoda} />}
        />
      </View>

      <View style={[s.row, s.rowGap]}>
        <FactTile
          position={getTilePosition(0, 2)}
          accent={colors.stat.sen}
          text="Mózg zużywa jedną piątą energii twojego organizmu"
        />
        <SleepTile
          position={getTilePosition(1, 2)}
          accent={colors.stat.sen}
          duration="7h 50m"
          window="23:05 - 06:06"
        />
      </View>

      <View style={[s.row, s.rowGap]}>
        <TaskListTile position={getTilePosition(0, 2)} tasks={MOCK_TASKS} />
        <LevelTile position={getTilePosition(1, 2)} level={27} />
      </View>

      <View style={[s.row, s.rowGap]}>
        <StatTile
          position={getTilePosition(0, 2)}
          accent={colors.stat.finanse}
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

      <TouchableOpacity
        onPress={() => router.push('/settings' as any)}
        style={[s.gear, { top: insets.top + spacing[2] }]}
      >
        <Settings size={18} color="#A7ADBD" />
      </TouchableOpacity>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary, paddingHorizontal: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[1] },
  rowGap: { marginTop: spacing[1] },

  gear: {
    position: 'absolute', right: spacing[3], width: 38, height: 38, borderRadius: radius.full,
    backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
}));
