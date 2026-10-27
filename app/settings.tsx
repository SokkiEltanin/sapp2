import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { ChevronLeft, Search, X, LogIn, Database, CalendarDays, AlertTriangle } from 'lucide-react-native';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, withTimeout } from '@/firebase';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';

// Build metadata wstrzyknięty przez CI (`.github/workflows/build.yml`, krok "Build
// release APK") jako EXPO_PUBLIC_* — Expo inline'uje te zmienne w bundlu JS na etapie
// budowania. W Expo Go / dev (gdzie tych zmiennych nikt nie ustawia) spadamy na "dev"
// — to NORMALNE, nie błąd (user to zobaczy wyłącznie uruchamiając appkę przez Expo Go,
// nie w prawdziwym APK z CI). Dodane po tym jak user kilka razy z rzędu nie mógł
// stwierdzić czy zainstalowany APK faktycznie jest najnowszym buildem (2026-10-27) —
// patrz też fix `versionCode` w tym samym commicie/NEXT_STEPS.md.
const BUILD_INFO = {
  version: Constants.expoConfig?.version ?? '?',
  buildNumber: process.env.EXPO_PUBLIC_BUILD_NUMBER ?? 'dev',
  buildDate: process.env.EXPO_PUBLIC_BUILD_DATE ?? 'dev',
  commit: process.env.EXPO_PUBLIC_BUILD_COMMIT ?? 'dev',
};

type SettingsItem = {
  key: string;
  label: string;
  description: string; // nie pokazywana — tylko do dopasowania wyszukiwarki
  icon: ComponentType<{ size?: number; color?: string }>;
  accent: string;
};

type SettingsSection = { title: string; items: SettingsItem[] };

// Jedna sekcja na razie — "Diagnostyka" (dawne TEST_ITEMS) — to WCIĄŻ tylko
// infrastruktura testowa (patrz komentarz przy handlerach niżej), nie prawdziwe
// Ustawienia z ARCHITECTURE.md. Struktura sekcje+wyszukiwarka jest już gotowa pod
// kolejne sekcje, gdy realne Ustawienia zaczną powstawać — dojdzie kolejny obiekt do
// tej tablicy, zero zmian w layoucie/filtrze.
const SECTIONS: SettingsSection[] = [
  {
    title: 'DIAGNOSTYKA (TEST)',
    items: [
      { key: 'google', label: 'Zaloguj przez Google', description: 'logowanie konto sign-in', icon: LogIn, accent: colors.stat.woda },
      { key: 'firestore', label: 'Test Firestore', description: 'baza danych synchronizacja', icon: Database, accent: colors.stat.finanse },
      { key: 'calendar', label: 'Test Kalendarza Google', description: 'wydarzenia kalendarz', icon: CalendarDays, accent: colors.stat.event },
      { key: 'alert', label: 'Test alertu (max priorytet)', description: 'powiadomienia alert notification', icon: AlertTriangle, accent: colors.accent.red },
    ],
  },
];

// Ekran Ustawień — wyszukiwarka + pogrupowane karty w naszym systemie wizualnym
// (Inter, kolorowe odznaki ikon, kafle jak na Dashboardzie). Pod spodem WCIĄŻ tylko
// testy infrastruktury (Firebase/Google Sign-in/Calendar/alert) — WYŁĄCZNIE do
// sprawdzenia czy są dobrze poustawione po stronie Google Cloud/Firebase Console,
// zanim zaczniemy dokładać prawdziwe sekcje Ustawień. `@react-native-google-signin`
// importowany DYNAMICZNIE w środku handlerów (natywny moduł, którego nie ma w Expo
// Go — statyczny import na starcie appki wywaliłby cały ekran, może i appkę, zanim
// user zdążyłby cokolwiek kliknąć). Błąd stąd ("Native module... cannot be null" /
// podobny) = normalne, oczekiwane w Expo Go, wyjaśnione userowi wprost w UI.
export default function SettingsScreen() {
  const s = makeS();
  const [log, setLog] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const append = (line: string) => setLog((prev) => [line, ...prev].slice(0, 12));

  const testGoogleSignIn = async () => {
    append('⏳ Logowanie Google…');
    try {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      GoogleSignin.configure({
        webClientId: '237061417548-pent1blbeebj8kov67f8f5focr98usgr.apps.googleusercontent.com',
        offlineAccess: true,
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
      });
      await GoogleSignin.hasPlayServices();
      const result = await GoogleSignin.signIn();
      append(`✅ Zalogowano: ${result.data?.user?.email ?? 'brak e-maila w odpowiedzi'}`);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes('Native module') || msg.includes('cannot be null') || msg.includes('TurboModule')) {
        append('⚠️ Ten natywny moduł nie działa w Expo Go — potrzebny dev-client build.');
      } else {
        append(`❌ Błąd logowania: ${msg}`);
      }
    }
  };

  const testFirestore = async () => {
    append('⏳ Firestore…');
    try {
      const ref = doc(db, '_test', 'ping');
      await withTimeout(setDoc(ref, { at: new Date().toISOString() }));
      const snap = await withTimeout(getDoc(ref));
      append(`✅ Firestore ok, zapisano/odczytano: ${snap.data()?.at}`);
    } catch (e: any) {
      append(`❌ Błąd Firestore: ${String(e?.message ?? e)}`);
    }
  };

  const testCalendar = async () => {
    append('⏳ Kalendarz Google…');
    try {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      const tokens = await GoogleSignin.getTokens();
      const resp = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5',
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
      );
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error?.message ?? `HTTP ${resp.status}`);
      append(`✅ Kalendarz ok, ${json.items?.length ?? 0} nadchodzących wydarzeń`);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes('Native module') || msg.includes('cannot be null') || msg.includes('TurboModule')) {
        append('⚠️ Ten natywny moduł nie działa w Expo Go — potrzebny dev-client build.');
      } else {
        append(`❌ Błąd kalendarza (zaloguj się najpierw): ${msg}`);
      }
    }
  };

  // Test "full-screen alertu" (user chce sprawdzić jak bardzo customowe da się zrobić
  // powiadomienia na Androidzie). UCZCIWIE: to SUFIT tego co daje goły
  // `expo-notifications` (kanał o najwyższym priorytecie, dźwięk, wibracja, heads-up)
  // — NIE prawdziwy full-screen-intent blokujący ekran jak budzik (to wymaga `notifee`
  // albo natywnego kodu, patrz NEXT_STEPS.md).
  const testFullScreenAlert = async () => {
    append('⏳ Alert (max priorytet)…');
    try {
      const Notifications = await import('expo-notifications');
      // BEZ TEGO appka w ogóle nie pokazuje powiadomienia gdy jest na pierwszym planie
      // (domyślne zachowanie Expo od kilku SDK) — realna przyczyna "nic się nie
      // dzieje": `scheduleNotificationAsync` mógł się udać (✅ w logu), ale bez
      // handlera system nie wiedział że ma cokolwiek wyświetlić.
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      await Notifications.setNotificationChannelAsync('alerts-max', {
        name: 'Alerty (test)',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#EF4444',
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      // `as any` — `NotificationPermissionsStatus`'s re-eksportowany `PermissionResponse`
      // z pakietu `expo` nie rozwiązuje się poprawnie w tej wersji (status/granted "nie
      // istnieją" wg tsc mimo że runtime je zwraca) — niegroźne dla testowego
      // przycisku, nie warto walczyć z typami dla tego.
      const permResult: any = await Notifications.requestPermissionsAsync();
      if (!permResult?.granted && permResult?.status !== 'granted') {
        throw new Error('Brak zgody na powiadomienia');
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔴 Test alertu',
          body: 'To sufit zwykłego expo-notifications (max priorytet) — nie prawdziwy full-screen jak budzik.',
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        // `{ channelId }` (bez `type`) = dostarcz NATYCHMIAST, ale przez ten kanał
        // (to kanał, nie content, niesie priorytet/dźwięk/wibrację na Androidzie 8+).
        trigger: { channelId: 'alerts-max' },
      });
      append('✅ Wysłano — oceń jak wygląda/brzmi na urządzeniu.');
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes('Native module') || msg.includes('cannot be null') || msg.includes('TurboModule')) {
        append('⚠️ Ten natywny moduł nie działa w Expo Go — potrzebny dev-client build.');
      } else {
        append(`❌ Błąd alertu: ${msg}`);
      }
    }
  };

  const handlers: Record<string, () => void> = {
    google: testGoogleSignIn,
    firestore: testFirestore,
    calendar: testCalendar,
    alert: testFullScreenAlert,
  };

  const q = query.trim().toLowerCase();
  const filteredSections = useMemo(() => {
    if (!q) return SECTIONS;
    return SECTIONS
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [q]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={colors.text.primary} /></TouchableOpacity>
        <Text style={s.title}>Ustawienia</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.searchBar}>
        <Search size={16} color={colors.text.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Szukaj w ustawieniach…"
          placeholderTextColor={colors.text.muted}
          style={s.searchInput}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <X size={15} color={colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {filteredSections.length === 0 && (
          <Text style={s.noResults}>Brak wyników dla „{query}”.</Text>
        )}

        {filteredSections.map((section) => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <View style={s.sectionCard}>
              {section.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[s.item, i !== section.items.length - 1 && s.itemDivider]}
                    onPress={handlers[item.key]}
                    activeOpacity={0.7}
                  >
                    <View style={[s.itemIcon, { backgroundColor: `${item.accent}33` }]}>
                      <Icon size={16} color={item.accent} />
                    </View>
                    <Text style={s.itemLabel}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <View style={s.logBox}>
          {log.length === 0 && <Text style={s.logEmpty}>Wyniki testów pojawią się tutaj.</Text>}
          {log.map((line, i) => <Text key={i} style={s.logLine}>{line}</Text>)}
        </View>

        {/* Statyczny blok info — POZA systemem sekcji/wyszukiwarki (nic tu nie jest
            klikalne ani nie pasuje do konceptu "ustawienia do znalezienia"), żeby user
            zawsze mógł jednym spojrzeniem sprawdzić czy zainstalowany APK to faktycznie
            najnowszy build, niezależnie od tego co wpisze w wyszukiwarkę wyżej. */}
        <View style={s.aboutBox}>
          <Text style={s.aboutRow}>Wersja <Text style={s.aboutValue}>{BUILD_INFO.version}</Text></Text>
          <Text style={s.aboutRow}>Build <Text style={s.aboutValue}>#{BUILD_INFO.buildNumber}</Text></Text>
          <Text style={s.aboutRow}>Zbudowano <Text style={s.aboutValue}>{BUILD_INFO.buildDate}</Text></Text>
          <Text style={s.aboutRow}>Commit <Text style={s.aboutValue}>{BUILD_INFO.commit}</Text></Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 15, fontFamily: 'Inter_900Black', color: c.text.primary },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], height: 42,
  },
  searchInput: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_500Medium', color: c.text.primary, padding: 0 },

  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[4] },
  noResults: { fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', marginTop: spacing[4] },

  section: { gap: spacing[2] },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, letterSpacing: 0.5, marginLeft: spacing[1] },
  sectionCard: {
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  itemDivider: { borderBottomWidth: 1, borderBottomColor: c.border.subtle },
  itemIcon: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },

  logBox: { backgroundColor: c.bg.elevated, borderRadius: radius.lg, padding: spacing[3], gap: 6 },
  logEmpty: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted },
  logLine: { fontSize: 11.5, color: c.text.secondary, fontFamily: 'monospace' },

  aboutBox: { alignItems: 'center', gap: 4, paddingVertical: spacing[2] },
  aboutRow: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted },
  aboutValue: { fontFamily: 'Inter_700Bold', color: c.text.secondary },
}));
