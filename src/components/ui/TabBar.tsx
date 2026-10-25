import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, Flame, CheckSquare, Wallet, PawPrint } from 'lucide-react-native';
import { spacing, radius, themedStyles } from '@/theme';

// Pasek zakładek — WŁASNY komponent (nie domyślny `Tabs` UI) dla pełnej kontroli nad
// wyglądem, ten sam wzorzec co w sapp. Tap-only, ZERO animacji przejścia między
// zakładkami (ustalone jako bezpieczny start — prawdziwy "jedzie za palcem" slide był w
// sapp udokumentowanym źródłem bugów/szarpania, bo wszystkie ciężkie ekrany zostają
// zamontowane naraz i muszą się przeliczać w trakcie animacji). Jak appka okaże się
// solidna/szybka, tani fade można dorzucić później jako polish — nie teraz.
export const TABS = [
  { key: 'index', label: 'Dashboard', icon: LayoutDashboard, accent: '#6C9EFF' },
  { key: 'daily', label: 'Daily', icon: Flame, accent: '#FB923C' },
  { key: 'tasks', label: 'Zadania', icon: CheckSquare, accent: '#6C9EFF' },
  { key: 'finances', label: 'Finanse', icon: Wallet, accent: '#2AC68F' },
  { key: 'pupil', label: 'Pupil', icon: PawPrint, accent: '#EF4444' },
] as const;

export default function TabBar({ active, onPress }: { active: string; onPress: (key: string) => void }) {
  const insets = useSafeAreaInsets();
  const { styles: s, inactiveColor } = makeS();
  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom + spacing[2] }]}>
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
  );
}

// `inactiveColor` ŚWIADOMIE poza `StyleSheet.create` (nie-stylowa wartość w środku
// mieszałaby się z RN-ową walidacją obiektów stylów) — `themedStyles` nie wymusza że
// buduje WYŁĄCZNIE arkusz stylów, więc zwracamy oba razem z jednego cache'u.
const makeS = themedStyles((c) => ({
  styles: StyleSheet.create({
    wrap: {
      flexDirection: 'row', backgroundColor: c.bg.elevated, borderTopWidth: 1, borderTopColor: c.border.default,
      paddingTop: spacing[2], paddingHorizontal: spacing[2],
    },
    item: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: spacing[1], borderRadius: radius.md },
    label: { fontSize: 10.5, fontWeight: '700' },
  }),
  inactiveColor: c.text.muted,
}));
