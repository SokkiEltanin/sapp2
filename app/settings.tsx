import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, LogIn, Database, CalendarDays, AlertTriangle } from 'lucide-react-native';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, withTimeout } from '@/firebase';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';

const TEST_ITEMS = [
  { key: 'google', label: 'Zaloguj przez Google', icon: LogIn, accent: colors.stat.woda },
  { key: 'firestore', label: 'Test Firestore', icon: Database, accent: colors.stat.finanse },
  { key: 'calendar', label: 'Test Kalendarza Google', icon: CalendarDays, accent: colors.stat.event },
  { key: 'alert', label: 'Test alertu (max priorytet)', icon: AlertTriangle, accent: colors.accent.red },
] as const;

// Ekran-tymczasowy (patrz dashboard) — WYŁĄCZNIE do sprawdzenia czy Firebase/Google
// Sign-in/Calendar są dobrze poustawiane po stronie Google Cloud/Firebase Console, zanim
// zaczniemy projektować prawdziwe Ustawienia (patrz nasze ustalone "Ustawienia — wersja
// robocza" z rozmowy). `@react-native-google-signin` importowany DYNAMICZNIE (`await
// import(...)`) w środku handlerów, nie na górze pliku — to natywny moduł, którego nie ma
// w Expo Go; statyczny import na starcie appki wywaliłby cały ekran (a przez eagerowy
// routing expo-routera, być może i całą appkę) zanim user zdążyłby cokolwiek kliknąć.
// Błąd stąd ("Native module... cannot be null" / podobny) = normalne, oczekiwane w Expo
// Go, wyjaśnione userowi wprost w UI zamiast suchego stack trace'u.
export default function SettingsScreen() {
  const s = makeS();
  const [log, setLog] = useState<string[]>([]);

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

  // Test "full-screen alertu" (2026-10-27, user chce sprawdzić jak bardzo customowe
  // da się zrobić powiadomienia na Androidzie — "ja sprawdzę jak działa"). UCZCIWIE:
  // to jest SUFIT tego co daje goły `expo-notifications` (kanał o najwyższym priorytecie
  // Androida, dźwięk, wibracja, heads-up) — NIE prawdziwy full-screen-intent blokujący
  // ekran jak budzik. Ten drugi wymaga `notifee` albo natywnego kodu (patrz NEXT_STEPS.md)
  // — dopiero po tym jak user oceni ten test, warto inwestować w cięższą zależność.
  const testFullScreenAlert = async () => {
    append('⏳ Alert (max priorytet)…');
    try {
      const Notifications = await import('expo-notifications');
      // BEZ TEGO appka w ogóle nie pokazuje powiadomienia gdy jest na pierwszym planie
      // (domyślne zachowanie Expo od kilku SDK) — to najpewniej prawdziwa przyczyna
      // "nic się nie dzieje" (2026-10-27): `scheduleNotificationAsync` mógł się udać
      // (✅ w logu), ale bez handlera system nie wiedział że ma cokolwiek wyświetlić.
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
      // istnieją" wg tsc mimo że runtime je zwraca, udokumentowane pola Expo) —
      // niegroźne dla testowego przycisku, nie warto walczyć z typami dla tego.
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

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={colors.text.primary} /></TouchableOpacity>
        <Text style={s.title}>Ustawienia (test infra)</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {TEST_ITEMS.map((item) => {
          const Icon = item.icon;
          const onPress = {
            google: testGoogleSignIn,
            firestore: testFirestore,
            calendar: testCalendar,
            alert: testFullScreenAlert,
          }[item.key];
          return (
            <TouchableOpacity key={item.key} style={s.btn} onPress={onPress} activeOpacity={0.7}>
              <View style={[s.btnIcon, { backgroundColor: `${item.accent}33` }]}>
                <Icon size={16} color={item.accent} />
              </View>
              <Text style={s.btnTxt}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}

        <View style={s.logBox}>
          {log.length === 0 && <Text style={s.logEmpty}>Wyniki testów pojawią się tutaj.</Text>}
          {log.map((line, i) => <Text key={i} style={s.logLine}>{line}</Text>)}
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
  scroll: { padding: spacing[4], gap: spacing[2] },

  btn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: c.bg.card,
    borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3],
  },
  btnIcon: {
    width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
  },
  btnTxt: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },

  logBox: { backgroundColor: c.bg.elevated, borderRadius: radius.lg, padding: spacing[3], gap: 6, marginTop: spacing[2] },
  logEmpty: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted },
  logLine: { fontSize: 11.5, color: c.text.secondary, fontFamily: 'monospace' },
}));
