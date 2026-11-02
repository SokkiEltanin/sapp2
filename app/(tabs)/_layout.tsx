import { Tabs, router } from 'expo-router';
import { NavBar } from '@/ui/NavBar';
import { colors } from '@/theme/colors';

// Faza 3.9 (design/rn kit) — dolny pasek podmieniony na NavBar z kitu (1:1 z makietą:
// kwadrat ustawień osobno + grupa 4 ikon), Tabs bez pagera/swipe (`animation: 'none'`,
// jak poprzednio) renderuje go sam przez `tabBar`, więc nie trzeba już ręcznie liczyć
// aktywnej trasy z `usePathname()` jak stary TabBar.tsx robił — expo-router/
// `@react-navigation` dają to przez `state` w `BottomTabBarProps`.
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(p) => <NavBar {...p} onSettingsPress={() => router.push('/settings' as any)} />}
      screenOptions={{
        headerShown: false,
        animation: 'none',
        sceneStyle: { backgroundColor: colors.bg.primary },
      }}
    >
      {/* Kolejność jawna (bez tego expo-router rejestruje trasy w kolejności
          wczytywania plików, nie alfabetycznej ani wg designu) — ma być
          Dashboard/Daily/Finanse/Zadania, 1:1 z makietą. */}
      <Tabs.Screen name="index" />
      <Tabs.Screen name="daily" />
      <Tabs.Screen name="finances" />
      <Tabs.Screen name="tasks" />
    </Tabs>
  );
}
