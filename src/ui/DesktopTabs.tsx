import React, { useState } from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { router, usePathname } from 'expo-router';
import { Settings, LayoutGrid, Activity, CreditCard, CalendarDays, Search, StickyNote, Keyboard, type LucideIcon } from 'lucide-react-native';
import { SHORTCUT_HELP } from '@/utils/desktopShortcuts';
import { AppWidthContext } from './layout';
import { C, R } from './theme';
import { DESKTOP_GAP, DESKTOP_RAIL_W, visibleTabs, tabFromPath, type DesktopLayout, type DesktopTab } from '@/utils/desktopColumns';

// Wersja na komputer — zakładki jako kolumny obok siebie (2026-11-14, user: "kafelki
// takie same tylko wszystkie ekrany obok siebie"). Te same ekrany co w telefonie
// (app/(tabs)/*), każdy w kolumnie o szerokości telefonu; nawigator `expo-router/ui`
// renderuje wszystkie naraz (TabSlot.renderFn), zamiast tylko aktywnej. Pasek po lewej:
// ustawienia, zakładki (podświetlone = widoczne; niewidoczna wskakuje w ostatnią
// kolumnę), notatki, szukaj. Matematyka: utils/desktopColumns.ts.
const TABS: { name: DesktopTab; href: '/' | '/finances' | '/tasks' | '/daily'; Icon: LucideIcon; label: string }[] = [
  { name: 'index', href: '/', Icon: LayoutGrid, label: 'Dashboard' },
  { name: 'finances', href: '/finances', Icon: CreditCard, label: 'Finanse' },
  { name: 'tasks', href: '/tasks', Icon: CalendarDays, label: 'Zadania' },
  { name: 'daily', href: '/daily', Icon: Activity, label: 'Daily' },
];

export function DesktopTabs({ layout }: { layout: DesktopLayout }) {
  const pathname = usePathname();
  const focused = tabFromPath(pathname) ?? 'index';
  const shown = visibleTabs(layout.cols, focused);
  const [help, setHelp] = useState(false);

  return (
    <Tabs style={st.root}>
      {/* Pasek = sam TabList: expo-router/ui szuka TabTriggerów tylko jako
          bezpośrednich dzieci TabList (bezpośredniego dziecka Tabs). */}
      <TabList style={st.rail}>
        <RailButton Icon={Settings} label="Ustawienia" onPress={() => router.push('/settings' as any)} boxed />
        {TABS.map(({ name, href, Icon, label }, i) => {
          const on = shown.includes(name);
          return (
            <TabTrigger
              key={name}
              name={name}
              href={href}
              accessibilityLabel={label}
              style={StyleSheet.flatten([st.btn, st.tab, i === 0 && st.tabFirst, i === TABS.length - 1 && st.tabLast, on && st.btnOn])}
            >
              <Icon size={20} strokeWidth={2.2} color={on ? '#000' : C.mut} />
              <Text style={StyleSheet.flatten([st.btnLabel, on && { color: '#000' }])} numberOfLines={1}>{label}</Text>
            </TabTrigger>
          );
        })}
        <RailButton Icon={StickyNote} label="Notatki" onPress={() => router.push('/notes' as any)} />
        <RailButton Icon={Search} label="Szukaj" onPress={() => router.push('/search' as any)} />
        <View style={{ flex: 1 }} />
        <RailButton Icon={Keyboard} label="Skróty" onPress={() => setHelp((h) => !h)} />
      </TabList>
      {help && (
        <Pressable style={st.help} onPress={() => setHelp(false)} accessibilityLabel="Zamknij skróty">
          <Text style={st.helpTitle}>Skróty klawiszowe</Text>
          {SHORTCUT_HELP.map(([k, v]) => (
            <View key={k} style={st.helpRow}>
              <Text style={st.helpKey}>{k}</Text>
              <Text style={st.helpVal}>{v}</Text>
            </View>
          ))}
        </Pressable>
      )}
      <TabSlot
        detachInactiveScreens={false}
        style={st.cols}
        renderFn={(descriptor) => {
          const name = descriptor.route.name as DesktopTab;
          const at = shown.indexOf(name);
          if (at < 0) return null;
          return (
            <View key={descriptor.route.key} style={[st.col, { width: layout.colW, order: at } as any]}>
              <AppWidthContext.Provider value={layout.colW}>{descriptor.render()}</AppWidthContext.Provider>
            </View>
          );
        }}
      />
    </Tabs>
  );
}

function RailButton({ Icon, label, onPress, boxed }: { Icon: LucideIcon; label: string; onPress: () => void; boxed?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.btn, boxed && st.boxed, pressed && { backgroundColor: C.tilePressed }]} accessibilityLabel={label}>
      <Icon size={20} strokeWidth={2} color={C.txt} />
      <Text style={st.btnLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#050505' },
  rail: { width: DESKTOP_RAIL_W, flexDirection: 'column', justifyContent: 'flex-start', paddingVertical: 12, paddingHorizontal: 6, gap: 6, alignItems: 'stretch' },
  tab: { backgroundColor: C.tile, borderRadius: 13 },
  tabFirst: { marginTop: 6 },
  tabLast: { marginBottom: 6 },
  btn: { height: 56, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 3 },
  boxed: { backgroundColor: C.tile, borderRadius: R.tile, height: 60 },
  btnOn: { backgroundColor: C.txt },
  btnLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', color: C.mut },
  cols: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: DESKTOP_GAP, paddingRight: DESKTOP_RAIL_W / 2 },
  col: { height: '100%', backgroundColor: C.bg, overflow: 'hidden' },
  help: { position: 'absolute', left: DESKTOP_RAIL_W + 8, bottom: 12, zIndex: 10, width: 300, padding: 14, gap: 8, borderRadius: R.tile, backgroundColor: C.tile, borderWidth: 1, borderColor: '#2a2a2a' },
  helpTitle: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: C.txt, marginBottom: 2 },
  helpRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  helpKey: { minWidth: 92, fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: '#000', backgroundColor: C.txt, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, textAlign: 'center' },
  helpVal: { flex: 1, fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: C.mut },
});
