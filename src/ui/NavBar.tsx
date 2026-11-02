import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Settings, LayoutGrid, Activity, CreditCard, CalendarDays, LucideIcon } from 'lucide-react-native';
import { haptic } from '@/utils/haptics';
import { C, R } from './theme';

/**
 * Dolny pasek 1:1 z makietą: osobny kwadrat ustawień po lewej + grupa 4 zakładek.
 * Użycie (expo-router):  <Tabs tabBar={(p) => <NavBar {...p} />} screenOptions={{ headerShown: false, animation: 'none' }}>
 * Bottom tabs NIE są swipowalne – nie używaj material-top-tabs / PagerView
 * (to one powodują, że krawędzie sąsiednich ekranów wchodzą w kadr).
 *
 * Dopasuj nazwy tras do swoich plików w app/(tabs)/.
 */
const SETTINGS = 'settings';
// Nazwy tras dopasowane do app/(tabs)/*.tsx tej appki (sapp2): index/daily/
// finances/tasks — kit miał "finance" (bez "s"), stąd ta jedna zmiana.
const ICONS: Record<string, LucideIcon> = {
  index: LayoutGrid,
  daily: Activity,
  finances: CreditCard,
  tasks: CalendarDays,
};

// `onSettingsPress` (dopasowanie do app/(tabs)/, jak prosi komentarz w kicie) —
// Ustawienia w tej appce to STACK-route POZA grupą `(tabs)` (app/settings.tsx), nie
// piąta zakładka w tym Tabs navigatorze, więc `navigation.navigate('settings')` w
// obrębie tego navigatora nie miałoby dokąd trafić. Reszta kitu (grid, ikony,
// podświetlenie) zostaje 1:1.
export function NavBar({ state, navigation, onSettingsPress }: BottomTabBarProps & { onSettingsPress: () => void }) {
  const insets = useSafeAreaInsets();
  const active = state.routes[state.index]?.name;
  const go = (name: string) => {
    haptic.tap();
    if (name !== active) navigation.navigate(name as never);
  };
  const main = state.routes.filter((r) => r.name !== SETTINGS);

  return (
    <View style={[st.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Pressable onPress={() => { haptic.tap(); onSettingsPress(); }} style={st.settings}>
        <Settings size={20} strokeWidth={2} color={C.txt} />
      </Pressable>
      <View style={st.group}>
        {main.map((r) => {
          const Icon = ICONS[r.name] ?? LayoutGrid;
          const on = r.name === active;
          return (
            <Pressable key={r.key} onPress={() => go(r.name)} style={[st.btn, on && st.on]}>
              <Icon size={20} strokeWidth={2.2} color={on ? '#000' : C.mut} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 6, backgroundColor: C.bg },
  settings: { width: 62, height: 62, borderRadius: R.tile, backgroundColor: C.tile, alignItems: 'center', justifyContent: 'center' },
  group: { flex: 1, height: 62, flexDirection: 'row', gap: 4, padding: 5, borderRadius: R.tile, backgroundColor: C.tile },
  btn: { flex: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: C.txt },
});
