import { View, StyleSheet } from 'react-native';
import { Tabs, usePathname, router } from 'expo-router';
import TabBar, { TABS } from '@/components/ui/TabBar';
import { colors } from '@/theme/colors';

const ROUTES: Record<string, string> = {
  index: '/', daily: '/daily', tasks: '/tasks', finances: '/finances', pupil: '/pupil',
};

function activeKey(pathname: string): string {
  if (pathname === '/') return 'index';
  const found = TABS.find((t) => pathname.startsWith(ROUTES[t.key]));
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
      <TabBar active={active} onPress={(key) => router.navigate(ROUTES[key] as any)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.primary },
});
