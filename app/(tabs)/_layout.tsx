import { View, StyleSheet } from 'react-native';
import { Tabs, usePathname, router } from 'expo-router';
import TabBar, { TABS } from '@/components/ui/TabBar';
import { colors } from '@/theme/colors';

const ROUTES: Record<string, string> = {
  index: '/', daily: '/daily', tasks: '/tasks', finances: '/finances', pupil: '/pupil',
};

// BUG (2026-10-28, user: "jak klikam to nic się nie dzieje") — `ROUTES['index']` to
// `'/'`, czyli PREFIKS KAŻDEJ ścieżki. Skoro `'index'` jest sprawdzane jako PIERWSZE w
// `TABS.find`, `pathname.startsWith('/')` wychodziło `true` dla KAŻDEGO pathname
// (`/daily`, `/tasks`, ...), więc funkcja zawsze zwracała `'index'` — ekran realnie się
// zmieniał (`router.navigate` działał poprawnie), ale podświetlenie w navbarze nigdy
// nie ruszało się z Dashboardu. Fix: `'index'` wyłączone z pętli prefiksowej (ma już
// własny wczesny `return` wyżej), reszta kluczy sprawdzana normalnie.
function activeKey(pathname: string): string {
  if (pathname === '/') return 'index';
  const found = TABS.find((t) => t.key !== 'index' && pathname.startsWith(ROUTES[t.key]));
  return found?.key ?? 'index';
}

// 5 korzeni, tap-only (patrz komentarz w TabBar.tsx) — `animation: 'none'` jest tu
// CELOWE, nie przeoczone: to jest dokładnie ta decyzja o której rozmawialiśmy.
export default function TabsLayout() {
  const pathname = usePathname();
  const active = activeKey(pathname);
  return (
    <View style={s.root}>
      <Tabs
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
          animation: 'none',
          sceneStyle: { backgroundColor: colors.bg.primary },
        }}
      />
      <TabBar
        active={active}
        onPress={(key) => router.navigate(ROUTES[key] as any)}
        onSettingsPress={() => router.push('/settings' as any)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.primary },
});
