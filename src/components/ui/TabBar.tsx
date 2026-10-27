import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, Flame, Wallet, CheckSquare, PawPrint, Settings } from 'lucide-react-native';
import { spacing, radius, themedStyles } from '@/theme';

// Pasek zakładek — WŁASNY komponent (nie domyślny `Tabs` UI) dla pełnej kontroli nad
// wyglądem, ten sam wzorzec co w sapp. Tap-only, ZERO animacji przejścia między
// zakładkami (ustalone jako bezpieczny start — prawdziwy "jedzie za palcem" slide był w
// sapp udokumentowanym źródłem bugów/szarpania, bo wszystkie ciężkie ekrany zostają
// zamontowane naraz i muszą się przeliczać w trakcie animacji). Jak appka okaże się
// solidna/szybka, tani fade można dorzucić później jako polish — nie teraz.
//
// Kolejność i pozycja (2026-10-26, NEXT_STEPS.md) — klaster ściśnięty do PRAWEJ
// krawędzi, nie pełna szerokość: prawy skraj = najbliżej kciuka = najkrótszy ruch, więc
// najczęściej używany ekran (Pupil) jest skrajnie po prawej, najrzadziej używany
// (Dashboard — i tak zawsze pierwszy po starcie appki) najdalej. "Notatki" z pierwotnej
// notatki w NEXT_STEPS.md zastąpione realnie istniejącym "Zadania" (ten sam slot w
// kolejności częstości). Ustawienia NIE są jedną z 5 głównych zakładek — osobny, mały
// przycisk w lewym dolnym rogu, z dala od klastra (wcześniej pływający na Dashboardzie,
// nachodził na kafelek pogody — przeniesiony tutaj na stałe).
export const TABS = [
  { key: 'index', label: 'Dashboard', icon: LayoutDashboard, accent: '#6C9EFF' },
  { key: 'daily', label: 'Daily', icon: Flame, accent: '#FB923C' },
  { key: 'finances', label: 'Finanse', icon: Wallet, accent: '#2AC68F' },
  { key: 'tasks', label: 'Zadania', icon: CheckSquare, accent: '#6C9EFF' },
  { key: 'pupil', label: 'Pupil', icon: PawPrint, accent: '#EF4444' },
] as const;

export default function TabBar({
  active,
  onPress,
  onSettingsPress,
}: {
  active: string;
  onPress: (key: string) => void;
  onSettingsPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { styles: s, inactiveColor } = makeS();
  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom + spacing[2] }]}>
      {/* Ustawienia + kreska-separator jako JEDNA grupa, żeby `justifyContent:
          'space-between'` na `wrap` rozdzielał tylko DWIE rzeczy (tę grupę i klaster
          zakładek), nie trzy — kreska wizualnie czyta się jako "to osobny przycisk,
          nie szósta zakładka", ale nadal żyje w tym samym pasku (user, 2026-10-27). */}
      <View style={s.settingsGroup}>
        <TouchableOpacity onPress={onSettingsPress} style={s.settingsBtn} activeOpacity={0.7}>
          <Settings size={17} color={inactiveColor} />
        </TouchableOpacity>
        <View style={s.divider} />
      </View>
      <View style={s.cluster}>
        {TABS.map((t) => {
          const isActive = t.key === active;
          const Icon = t.icon;
          return (
            <TouchableOpacity key={t.key} onPress={() => onPress(t.key)} style={s.item} activeOpacity={0.7}>
              <Icon size={22} color={isActive ? t.accent : inactiveColor} />
              <Text style={[s.label, { color: isActive ? t.accent : inactiveColor }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// `inactiveColor` ŚWIADOMIE poza `StyleSheet.create` (nie-stylowa wartość w środku
// mieszałaby się z RN-ową walidacją obiektów stylów) — `themedStyles` nie wymusza że
// buduje WYŁĄCZNIE arkusz stylów, więc zwracamy oba razem z jednego cache'u.
const makeS = themedStyles((c) => ({
  styles: StyleSheet.create({
    wrap: {
      flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
      backgroundColor: c.bg.elevated, borderTopWidth: 1, borderTopColor: c.border.default,
      paddingTop: spacing[2], paddingHorizontal: spacing[2],
    },
    settingsGroup: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    // Tło + obramowanie jak karty/przyciski gdzie indziej w appce (np. Ustawienia same
    // w sobie) — żeby Ustawienia czytały się jako samodzielny przycisk, nie 6. zakładka
    // bez tła wtopiona w resztę klastra.
    settingsBtn: {
      width: 38, height: 38, borderRadius: radius.full,
      backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
      alignItems: 'center', justifyContent: 'center',
    },
    divider: { width: 1, height: 24, backgroundColor: c.border.default, marginLeft: spacing[2] },
    cluster: { flexDirection: 'row', gap: spacing[1] },
    item: {
      alignItems: 'center', gap: 3, minWidth: 56,
      paddingVertical: spacing[1], paddingHorizontal: spacing[1], borderRadius: radius.md,
    },
    label: { fontSize: 10.5, fontFamily: 'Inter_700Bold' },
  }),
  inactiveColor: c.text.muted,
}));
