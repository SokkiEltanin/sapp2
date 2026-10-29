import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, BackHandler, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import {
  ChevronLeft, ChevronRight, Search, X,
  Info, Stethoscope, Wallet, Clock, Bell, Copy,
  LogIn, LogOut, User as UserIcon, Database, CalendarDays, AlertTriangle, Rocket,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, withTimeout } from '@/firebase';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { useAuthUser } from '@/hooks/useAuthUser';
import { GOOGLE_WEB_CLIENT_ID, signOutGoogle } from '@/services/googleAuth';
import { calendarService } from '@/services/calendarService';
import { googleCalendarService } from '@/services/googleCalendarService';
import { todayISO } from '@/utils/date';

// Build metadata wstrzyknięty przez CI (`.github/workflows/build.yml`, krok "Build
// release APK") jako EXPO_PUBLIC_* — Expo inline'uje te zmienne w bundlu JS na etapie
// budowania. W Expo Go / dev (gdzie tych zmiennych nikt nie ustawia) spadamy na "dev"
// — to NORMALNE, nie błąd. Dodane po tym jak user kilka razy z rzędu nie mógł
// stwierdzić czy zainstalowany APK faktycznie jest najnowszym buildem (2026-10-27).
const BUILD_INFO = {
  version: Constants.expoConfig?.version ?? '?',
  buildNumber: process.env.EXPO_PUBLIC_BUILD_NUMBER ?? 'dev',
  buildDate: process.env.EXPO_PUBLIC_BUILD_DATE ?? 'dev',
  commit: process.env.EXPO_PUBLIC_BUILD_COMMIT ?? 'dev',
};

type Icon = ComponentType<{ size?: number; color?: string }>;

type SettingsItem =
  | { kind: 'action'; key: string; label: string; description: string; icon: Icon; accent: string }
  | { kind: 'value'; key: string; label: string; description: string; icon: Icon; accent: string; value: string };

type SettingsSection = { id: string; title: string; icon: Icon; color: string; items: SettingsItem[] };

function plCount(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

// Sekcje Ustawień (2026-10-28, user: "ustawienia jak w sap musimy podzielić żeby mieć
// INFO, DIAGNOSTYKĘ, FINANSE itp") — ten sam dwupoziomowy wzorzec co w sapp
// (`SettingsSectionDef`/`SettingsCategoryRow`): lista kategorii na głównym ekranie,
// kliknięcie przełącza widok na pełną listę TEJ kategorii (stan `activeSectionId`
// niżej w komponencie, nie osobna trasa routera — dokładnie jak w sapp, patrz
// komentarz przy `SettingsCategoryRow` tam: "kliknięcie woła openSection(section.id)").
// FINANSE ma na razie jeden statyczny item "W budowie" — appka nie ma jeszcze żadnej
// funkcji finansowej do wystawienia tutaj (patrz ARCHITECTURE.md); sekcja istnieje
// żeby struktura była gotowa, nie żeby udawać gotową funkcję.
//
// Funkcja, nie stała — sekcja "Konto" potrzebuje realnego e-maila zalogowanego usera
// (`useAuthUser()`), więc cała lista musi przeliczać się w komponencie, nie raz na
// moduł (patrz `useMemo(() => buildSections(...))` niżej).
function buildSections(email: string | null): SettingsSection[] {
  return [
  {
    id: 'konto', title: 'Konto', icon: UserIcon, color: colors.accent.blue,
    items: [
      { kind: 'value', key: 'account-email', label: 'Zalogowano jako', description: 'konto google', icon: UserIcon, accent: colors.accent.blue, value: email ?? '—' },
      { kind: 'action', key: 'account-logout', label: 'Wyloguj', description: 'wyloguj z konta google', icon: LogOut, accent: colors.accent.red },
    ],
  },
  {
    id: 'info', title: 'Info', icon: Info, color: colors.stat.woda,
    items: [
      { kind: 'value', key: 'info-version', label: 'Wersja', description: 'wersja aplikacji', icon: Info, accent: colors.stat.woda, value: BUILD_INFO.version },
      { kind: 'value', key: 'info-build', label: 'Build', description: 'numer builda github actions', icon: Info, accent: colors.stat.woda, value: `#${BUILD_INFO.buildNumber}` },
      { kind: 'value', key: 'info-date', label: 'Zbudowano', description: 'data builda', icon: Clock, accent: colors.stat.woda, value: BUILD_INFO.buildDate },
      { kind: 'value', key: 'info-commit', label: 'Commit', description: 'git commit sha', icon: Info, accent: colors.stat.woda, value: BUILD_INFO.commit },
    ],
  },
  {
    id: 'diagnostyka', title: 'Diagnostyka', icon: Stethoscope, color: colors.accent.red,
    items: [
      { kind: 'action', key: 'google', label: 'Zaloguj przez Google', description: 'logowanie konto sign-in', icon: LogIn, accent: colors.stat.woda },
      { kind: 'action', key: 'firestore', label: 'Test Firestore', description: 'baza danych synchronizacja', icon: Database, accent: colors.stat.finanse },
      { kind: 'action', key: 'calendar', label: 'Test Kalendarza Google', description: 'wydarzenia kalendarz', icon: CalendarDays, accent: colors.stat.event },
      { kind: 'action', key: 'calendar-sync', label: 'Sync kalendarza (dane)', description: 'test warstwy danych firestore i google calendar round-trip', icon: CalendarDays, accent: colors.stat.event },
    ],
  },
  // Sandbox do porównania kilku podejść do prawdziwych full-screen-intent alertów
  // (2026-10-28, user: "potraktujmy sapp2 jako pole do manewrów... kilka opcji osobno
  // testować, ja powiem która działa"). Dwa NIEZALEŻNE testy, celowo osobno:
  // `expo` = sufit gołego expo-notifications (MAX priorytet, heads-up — już wcześniej
  // sprawdzone, NIE przebija blokady ekranu); `notifee` = prawdziwy natywny
  // `fullScreenIntent` (patrz `plugins/withFullScreenAlert.js`), który POWINIEN
  // wybudzić telefon i pokazać appkę NAD blokadą jak budzik/połączenie przychodzące.
  {
    id: 'alerty', title: 'Alerty', icon: Bell, color: colors.accent.red,
    items: [
      { kind: 'action', key: 'alert-expo', label: 'Expo (MAX priorytet)', description: 'powiadomienia alert notification heads-up', icon: AlertTriangle, accent: colors.accent.red },
      { kind: 'action', key: 'alert-notifee', label: 'Notifee (bez przycisku)', description: 'powiadomienia alert notification pelny ekran budzik', icon: Rocket, accent: colors.accent.purple },
      { kind: 'action', key: 'alert-notifee-buttons', label: 'Notifee (Tak/Nie)', description: 'powiadomienia alert notification pelny ekran budzik przyciski akcji', icon: Rocket, accent: colors.accent.green },
      { kind: 'action', key: 'alert-notifee-5min', label: 'Notifee za 5 min (test OLED)', description: 'sprawdza czy ekran faktycznie sie wybudza z glebokiego usypiania, nie tylko gra w ciemno', icon: Rocket, accent: colors.accent.orange },
    ],
  },
  {
    id: 'finanse', title: 'Finanse', icon: Wallet, color: colors.stat.finanse,
    items: [
      { kind: 'value', key: 'finanse-soon', label: 'Wkrótce', description: 'parser paragonów budżety limity kategorie', icon: Clock, accent: colors.stat.finanse, value: 'W budowie' },
    ],
  },
  ];
}

// Ekran Ustawień — kategorie + wyszukiwarka w naszym systemie wizualnym (Inter,
// kolorowe odznaki ikon, karty jak na Dashboardzie). Logika testów Diagnostyki
// (Firebase/Google Sign-in/Calendar/alert) — WYŁĄCZNIE do sprawdzenia czy są dobrze
// poustawione po stronie Google Cloud/Firebase Console. `@react-native-google-signin`
// importowany DYNAMICZNIE w środku handlerów (natywny moduł, którego nie ma w Expo
// Go — statyczny import na starcie appki wywaliłby cały ekran, może i appkę, zanim
// user zdążyłby cokolwiek kliknąć). Błąd stąd ("Native module... cannot be null" /
// podobny) = normalne, oczekiwane w Expo Go, wyjaśnione userowi wprost w UI.
export default function SettingsScreen() {
  const s = makeS();
  const { user } = useAuthUser();
  const [log, setLog] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const append = (line: string) => setLog((prev) => [line, ...prev].slice(0, 12));

  // User: "dodaj tam kopiowanie logów, będzie szybciej" — zamiast screenshotów przy
  // każdej rundzie diagnostyki. Kopiuje dokładnie to co widać (najnowsze na górze,
  // ten sam porządek co `log`), żeby wklejona treść 1:1 odpowiadała ekranowi.
  const copyLog = async () => {
    await Clipboard.setStringAsync(log.join('\n'));
    append('Log skopiowany do schowka.');
  };

  // Ekran Ustawień żyje WYŁĄCZNIE pod bramką logowania (app/_layout.tsx) — `user` tu
  // jest więc zawsze ustawiony, ale `?? null` i tak jest bezpieczne dla typów i dla
  // ułamka sekundy między wylogowaniem a przekierowaniem bramki na /login.
  const sections = useMemo(() => buildSections(user?.email ?? null), [user?.email]);

  const handleLogout = async () => {
    append('Wylogowywanie…');
    try {
      await signOutGoogle();
      append('Wylogowano — przekieruje na ekran logowania.');
    } catch (e: any) {
      append(`Błąd wylogowania: ${String(e?.message ?? e)}`);
    }
  };

  const testGoogleSignIn = async () => {
    append('Logowanie Google…');
    try {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        offlineAccess: true,
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
      });
      await GoogleSignin.hasPlayServices();
      const result = await GoogleSignin.signIn();
      append(`Zalogowano: ${result.data?.user?.email ?? 'brak e-maila w odpowiedzi'}`);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes('Native module') || msg.includes('cannot be null') || msg.includes('TurboModule')) {
        append('Ten natywny moduł nie działa w Expo Go — potrzebny dev-client build.');
      } else {
        append(`Błąd logowania: ${msg}`);
      }
    }
  };

  const testFirestore = async () => {
    append('Firestore…');
    try {
      const ref = doc(db, '_test', 'ping');
      await withTimeout(setDoc(ref, { at: new Date().toISOString() }));
      const snap = await withTimeout(getDoc(ref));
      append(`Firestore ok, zapisano/odczytano: ${snap.data()?.at}`);
    } catch (e: any) {
      append(`Błąd Firestore: ${String(e?.message ?? e)}`);
    }
  };

  const testCalendar = async () => {
    append('Kalendarz Google…');
    try {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      const tokens = await GoogleSignin.getTokens();
      const resp = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5',
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
      );
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error?.message ?? `HTTP ${resp.status}`);
      append(`Kalendarz ok, ${json.items?.length ?? 0} nadchodzących wydarzeń`);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes('Native module') || msg.includes('cannot be null') || msg.includes('TurboModule')) {
        append('Ten natywny moduł nie działa w Expo Go — potrzebny dev-client build.');
      } else {
        append(`Błąd kalendarza (zaloguj się najpierw): ${msg}`);
      }
    }
  };

  // Weryfikacja warstwy danych portu kalendarza (Faza 1a, 2026-10-28) — PRZED
  // jakimkolwiek UI (user: "z głową, nie burdel pod przyszłość"). Round-trip
  // dodaj→odczytaj→zmień→usuń, osobno dla Firestore (calendarService) i dla
  // prawdziwego Google Calendar (googleCalendarService) — oba kończą się usunięciem
  // testowego eventu, więc nie zaśmiecają ani bazy, ani realnego kalendarza usera.
  const testCalendarSync = async () => {
    append('Sync kalendarza: Firestore…');
    try {
      const created = await calendarService.addEvent({
        title: '[TEST] sapp2 sync', date: todayISO(), allDay: true, priority: 'normal',
      });
      const all = await calendarService.getAllEvents();
      await calendarService.updateEvent(created.id, { title: '[TEST] sapp2 sync (zmieniono)' });
      await calendarService.deleteEvent(created.id);
      append(`Firestore ok — dodano/odczytano (${all.length} eventów)/zmieniono/usunięto.`);
    } catch (e: any) {
      append(`Błąd Firestore: ${String(e?.message ?? e)}`);
    }

    append('Sync kalendarza: Google Calendar…');
    try {
      const gcalId = await googleCalendarService.createEvent({ title: '[TEST] sapp2 sync', date: todayISO(), allDay: true });
      if (!gcalId) throw new Error('Brak tokenu Google — najpierw "Zaloguj przez Google" wyżej.');
      const appId = `gcal-${gcalId}`;
      const updated = await googleCalendarService.updateEvent(appId, { title: '[TEST] sapp2 sync (zmieniono)' });
      const fetched = await googleCalendarService.fetchEvents(1, 1);
      const deleted = await googleCalendarService.deleteEvent(appId);
      append(`Google ok — dodano/zmieniono (${updated})/fetchEvents znalazł ${fetched.length}/usunięto (${deleted}).`);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes('Native module') || msg.includes('cannot be null') || msg.includes('TurboModule')) {
        append('Ten natywny moduł nie działa w Expo Go — potrzebny dev-client build.');
      } else {
        append(`Błąd Google Calendar: ${msg}`);
      }
    }
  };

  // Opcja 1/2 sandboxa alertów: SUFIT tego co daje goły `expo-notifications` (kanał o
  // najwyższym priorytecie, dźwięk, wibracja, heads-up) — NIE prawdziwy
  // full-screen-intent blokujący ekran jak budzik (już sprawdzone wcześniej przez
  // usera — nie przebija blokady ekranu). Zostaje jako punkt odniesienia do porównania
  // z opcją notifee niżej.
  const testExpoAlert = async () => {
    append('Alert (max priorytet)…');
    try {
      const Notifications = await import('expo-notifications');
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
      const permResult: any = await Notifications.requestPermissionsAsync();
      if (!permResult?.granted && permResult?.status !== 'granted') {
        throw new Error('Brak zgody na powiadomienia');
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test alertu',
          body: 'To sufit zwykłego expo-notifications (max priorytet) — nie prawdziwy full-screen jak budzik.',
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: { channelId: 'alerts-max' },
      });
      append('Wysłano — oceń jak wygląda/brzmi na urządzeniu.');
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes('Native module') || msg.includes('cannot be null') || msg.includes('TurboModule')) {
        append('Ten natywny moduł nie działa w Expo Go — potrzebny dev-client build.');
      } else {
        append(`Błąd alertu: ${msg}`);
      }
    }
  };

  // Opcje 2-3: `notifee` z natywnym `fullScreenAction` (patrz
  // `plugins/withFullScreenAlert.js` — bez flag `showWhenLocked`/`turnScreenOn` na
  // docelowej Activity w manifeście, Android pokaże to WYŁĄCZNIE jako zwykłe
  // heads-up, nie nad blokadą ekranu). Na Androidzie 14+ `USE_FULL_SCREEN_INTENT`
  // może też wymagać ręcznego włączenia przez usera w ustawieniach systemowych
  // appki ("Pełnoekranowe powiadomienia") — jeśli test "nic nie robi" mimo sukcesu w
  // logu, to pierwsze miejsce do sprawdzenia, nie bug w kodzie. Wspólna funkcja dla
  // dwóch wariantów do porównania (2026-10-28, user: "spróbuj dodać tak i nie [i]
  // bez przycisku") — `withActions` dokleja dwa przyciski akcji "Tak"/"Nie" na
  // powiadomieniu (jak odbierz/odrzuć w połączeniu przychodzącym), bez tego
  // powiadomienie ma tylko domyślną akcję (tap = otwórz appkę).
  // 2026-10-28 — user po SCHEDULE_EXACT_ALARM fixie: DALEJ kompletnie cicho, nawet z
  // pełnymi zgodami w systemowych ustawieniach. Zamiast zgadywać CZWARTY fix na ślepo,
  // test teraz robi DWIE NIEZALEŻNE rzeczy jedną komendą, żeby log sam powiedział gdzie
  // dokładnie się psuje:
  //   1. `displayNotification` NATYCHMIAST (zero triggera/AlarmManager/exact-alarm) —
  //      jeśli TEGO nie widać/słychać od razu (appka wciąż na wierzchu), problem jest w
  //      zgodzie/kanale/samym notifee, NIE w opóźnionym planowaniu.
  //   2. `createTriggerNotification` jak dotąd (za 5s, do testu zablokowanego ekranu) +
  //      `getTriggerNotificationIds()` zaraz po, żeby log pokazał czy system W OGÓLE
  //      przyjął ten trigger (pusta lista = cicho odrzucony, mimo že `await` nie rzucił).
  // `delayMs` (2026-10-29, user: "musimy sprawdzić czy np po 5 min ekran się
  // wybudzi sam... czy będzie ciemny, bo to OLED screen") — domyślnie 5s do
  // szybkich testów, ale parametryzowane żeby dało się odpalić realny test na
  // dłuższym opóźnieniu (patrz item "Test alertu za 5 min" w Alerty) — krótki 5s
  // test nie sprawdza czy ekran FIZYCZNIE się wybudza z głębokiego uśpienia/OLED
  // całkowicie czarnego ekranu, tylko czy mechanizm w ogóle działa zanim telefon
  // zdąży zejść w głębszy stan oszczędzania energii.
  const sendNotifeeAlert = async (withActions: boolean, delayMs = 5000) => {
    const delayLabel = delayMs >= 60000 ? `${Math.round(delayMs / 60000)} min` : `${Math.round(delayMs / 1000)}s`;
    append(`Alert notifee (za ${delayLabel}): start…`);
    try {
      const notifeeModule = await import('@notifee/react-native');
      const notifee = notifeeModule.default;
      const { AndroidImportance, AndroidCategory, AndroidVisibility, AuthorizationStatus, TriggerType } = notifeeModule;
      const settings = await notifee.requestPermission();
      append(`Zgoda na powiadomienia: status=${settings.authorizationStatus}`);
      if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
        throw new Error('Brak zgody na powiadomienia');
      }
      // UWAGA: kanał na Androidzie jest NIEMUTOWALNY po utworzeniu — build #29 rzucał
      // błąd walidacji na starym `vibrationPattern` W TRAKCIE `createChannel`, co mogło
      // zdążyć zarejestrować kanał z domyślnymi (cichymi) ustawieniami zanim doszło do
      // walidacji. Każda kolejna zmiana konfiguracji musi iść pod NOWYM id, inaczej
      // system trzyma się pierwszej (zepsutej) rejestracji — złapane na urządzeniu
      // (2026-10-28, user: "bez wibracji czy dźwięku" mimo poprawnej konfiguracji w
      // kodzie). `-v2` tutaj, podbijać przy kolejnej zmianie configu kanału.
      const channelId = await notifee.createChannel({
        id: 'alerts-fullscreen-v2',
        name: 'Alerty pełnoekranowe (test) v2',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        vibrationPattern: [300, 500, 300, 500],
        lights: true,
        lightColor: '#EF4444',
        bypassDnd: true,
      });
      append(`Kanał gotowy: ${channelId}`);

      // `loopSound: true` (2026-10-29, user: "dodaj na razie domyślny [dźwięk],
      // żeby potem customowy cały ekran") — zero nowego pliku audio do
      // zbundlowania: to ustawia `FLAG_INSISTENT`, czyli DOMYŚLNY systemowy dźwięk
      // kanału (`sound: 'default'`) powtarza się w pętli aż notyfikacja zostanie
      // otwarta/anulowana, zamiast zagrać raz i ucichnąć (łatwo przegapić
      // pojedynczy krótki "ding" w trakcie przejścia na pełny ekran — to
      // prawdopodobnie dlaczego wcześniej wyglądało na "brak dźwięku"). Docelowo
      // (gdy user poda/wybierze własny plik audio) to miejsce PRZEJDZIE na
      // zapętlone odtwarzanie customowego dźwięku z poziomu `app/alert-test.tsx`
      // (tak jak już robi to wibracja tam) zamiast systemowego dźwięku kanału —
      // rozdzielenie "warstwa notyfikacji" (ten plik) vs "warstwa ekranu alarmu"
      // (alert-test.tsx) jest już naturalne, więc ta zmiana będzie izolowana, nie
      // przepisywaniem całości.
      const android = {
        channelId,
        category: AndroidCategory.CALL,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        fullScreenAction: { id: 'default', launchActivity: 'default' },
        pressAction: { id: 'default' },
        sound: 'default',
        loopSound: true,
        ...(withActions && {
          actions: [
            { title: 'Nie', pressAction: { id: 'no' } },
            { title: 'Tak', pressAction: { id: 'yes' } },
          ],
        }),
      };

      // `data: { route: 'alert-test' }` — łapane przez
      // src/hooks/useNotifeeAlertLaunch.ts, żeby tap/fullScreenAction na TYM alercie
      // (nie na jakimkolwiek innym powiadomieniu appki) przekierował na dedykowany
      // ekran alarmu (app/alert-test.tsx), nie zostawiał usera na ostatnim otwartym
      // ekranie appki (2026-10-29, user po teście: "żeby nie cała apka była tylko
      // alarm screen testowy").
      await notifee.displayNotification({
        title: 'Test NATYCHMIAST (notifee)',
        body: 'Jeśli TEGO nie widzisz/słyszysz od razu (appka wciąż otwarta), problem jest w zgodzie/kanale, nie w opóźnionym triggerze.',
        data: { route: 'alert-test' },
        android,
      });
      append('Natychmiastowe wysłane — POWINNO pokazać się OD RAZU, appka wciąż otwarta.');

      // Opóźnienie przez NATYWNY trigger (AlarmManager), NIE `setTimeout` w JS — przeżywa
      // zawieszenie JS/tło/zabicie appki, w przeciwieństwie do poprzedniej wersji tego
      // testu. `allowWhileIdle` = dokładny alarm (`setExactAndAllowWhileIdle`), co od
      // Androida 12 wymaga `SCHEDULE_EXACT_ALARM` w manifeście (dodane) — bez tego Android
      // NIE rzuca błędem, tylko cicho degraduje do niedokładnego/odłożonego alarmu.
      const notifId = await notifee.createTriggerNotification(
        {
          title: `Test alertu za ${delayLabel} (notifee)`,
          body: withActions
            ? 'Wybudzi ekran i pokaże appkę NAD blokadą, z przyciskami Tak/Nie.'
            : 'Wybudzi ekran i pokaże appkę NAD blokadą, bez przycisków (sam tap).',
          data: { route: 'alert-test' },
          android,
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: Date.now() + delayMs,
          alarmManager: { allowWhileIdle: true },
        },
      );
      const pending = await notifee.getTriggerNotificationIds();
      append(`Trigger zaplanowany za ${delayLabel} (id ${String(notifId)}) — system ma ${pending.length} aktywnych triggerów. Zablokuj ekran TERAZ.`);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const code = e?.code ? ` [${e.code}]` : '';
      if (msg.includes('Native module') || msg.includes('cannot be null') || msg.includes('TurboModule')) {
        append('notifee niedostępny w Expo Go — potrzebny build APK z tego CI.');
      } else {
        append(`Błąd notifee${code}: ${msg}`);
      }
    }
  };

  const handlers: Record<string, () => void> = {
    'account-logout': handleLogout,
    google: testGoogleSignIn,
    firestore: testFirestore,
    calendar: testCalendar,
    'calendar-sync': testCalendarSync,
    'alert-expo': testExpoAlert,
    'alert-notifee': () => sendNotifeeAlert(false),
    'alert-notifee-buttons': () => sendNotifeeAlert(true),
    'alert-notifee-5min': () => sendNotifeeAlert(false, 5 * 60 * 1000),
  };

  const q = query.trim().toLowerCase();
  // Szukanie jest GLOBALNE (przeszukuje wszystkie sekcje naraz, nie tylko aktywną) —
  // wpisanie czegokolwiek w pasek pokazuje płaską listę trafień ze WSZYSTKICH sekcji
  // (ten sam wzorzec co w sapp: `filterSections`), żeby user nie musiał wiedzieć w
  // której kategorii coś jest.
  const searchResults = useMemo(() => {
    if (!q) return null;
    return sections.flatMap((section) =>
      section.items.filter(
        (item) => item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
      ),
    );
  }, [q, sections]);

  const activeSection = activeSectionId ? sections.find((sec) => sec.id === activeSectionId) ?? null : null;

  const handleBack = () => {
    if (query) { setQuery(''); return; }
    if (activeSection) { setActiveSectionId(null); return; }
    router.back();
  };

  // Sprzętowy/gestowy przycisk "wstecz" na Androidzie POMIJA `handleBack` (ten reaguje
  // tylko na tap w `ChevronLeft` w nagłówku) — bez przechwycenia, expo-router po prostu
  // zdejmuje `/settings` ze stosu i wychodzi do Dashboardu, nawet gdy user jest w
  // rozwiniętej kategorii/szukaniu (2026-10-28, user na urządzeniu: "chcę cofnąć to
  // mnie cofa od razu do DASHBOARDU zamiast do głównych ustawień"). Ten sam dokładnie
  // bug i fix co w sapp (app/settings.tsx, `closeSection`/`BackHandler`).
  useEffect(() => {
    if (Platform.OS !== 'android' || (!activeSectionId && !query)) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (query) { setQuery(''); return true; }
      setActiveSectionId(null);
      return true;
    });
    return () => sub.remove();
  }, [activeSectionId, query]);

  const headerTitle = query ? 'Szukaj' : activeSection ? activeSection.title : 'Ustawienia';

  const renderItem = (item: SettingsItem, isLast: boolean) => {
    const Icon = item.icon;
    const inner = (
      <>
        <View style={[s.itemIcon, { backgroundColor: `${item.accent}33` }]}>
          <Icon size={16} color={item.accent} />
        </View>
        <Text style={s.itemLabel}>{item.label}</Text>
        {item.kind === 'value' && <Text style={s.itemValue} numberOfLines={1}>{item.value}</Text>}
      </>
    );
    if (item.kind === 'value') {
      return <View key={item.key} style={[s.item, !isLast && s.itemDivider]}>{inner}</View>;
    }
    return (
      <TouchableOpacity key={item.key} style={[s.item, !isLast && s.itemDivider]} onPress={handlers[item.key]} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={handleBack} style={s.backBtn}><ChevronLeft size={22} color={colors.text.primary} /></TouchableOpacity>
        <Text style={s.title}>{headerTitle}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.searchBar}>
        <Search size={16} color={colors.text.muted} />
        <TextInput
          value={query}
          onChangeText={(v) => { setQuery(v); if (v) setActiveSectionId(null); }}
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
        {searchResults ? (
          searchResults.length === 0 ? (
            <Text style={s.noResults}>Brak wyników dla „{query}”.</Text>
          ) : (
            <View style={s.sectionCard}>
              {searchResults.map((item, i) => renderItem(item, i === searchResults.length - 1))}
            </View>
          )
        ) : activeSection ? (
          <View style={s.sectionCard}>
            {activeSection.items.map((item, i) => renderItem(item, i === activeSection.items.length - 1))}
          </View>
        ) : (
          sections.map((section) => {
            const Icon = section.icon;
            return (
              <TouchableOpacity
                key={section.id}
                style={s.categoryRow}
                onPress={() => setActiveSectionId(section.id)}
                activeOpacity={0.7}
              >
                <View style={[s.categoryIcon, { backgroundColor: `${section.color}33` }]}>
                  <Icon size={18} color={section.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.categoryTitle}>{section.title}</Text>
                  <Text style={s.categorySubtitle}>
                    {section.items.length} {plCount(section.items.length, 'pozycja', 'pozycje', 'pozycji')}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.text.muted} />
              </TouchableOpacity>
            );
          })
        )}

        {/* Log testów — tylko w sekcjach gdzie testy/akcje coś robią (Konto, Diagnostyka,
            Alerty), nie zaśmieca listy kategorii ani innych sekcji/wyników szukania. */}
        {(activeSection?.id === 'konto' || activeSection?.id === 'diagnostyka' || activeSection?.id === 'alerty') && (
          <View style={s.logBox}>
            {log.length === 0 ? (
              <Text style={s.logEmpty}>Wyniki testów pojawią się tutaj.</Text>
            ) : (
              <TouchableOpacity style={s.logCopyBtn} onPress={copyLog} activeOpacity={0.7}>
                <Copy size={13} color={colors.text.muted} />
                <Text style={s.logCopyLabel}>Kopiuj log</Text>
              </TouchableOpacity>
            )}
            {log.map((line, i) => <Text key={i} style={s.logLine}>{line}</Text>)}
          </View>
        )}
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

  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[2] },
  noResults: { fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', marginTop: spacing[4] },

  // Wiersz kategorii na głównym ekranie Ustawień (2026-10-28, wzorzec z sapp:
  // `SettingsCategoryRow`) — karta z odznaką ikony, tytułem + liczbą pozycji, strzałką
  // w prawo. Kliknięcie wchodzi w pełną listę tej kategorii (`activeSectionId`).
  categoryRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[3],
  },
  categoryIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  categoryTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  categorySubtitle: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 1 },

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
  itemValue: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.secondary, maxWidth: 160 },

  logBox: { backgroundColor: c.bg.elevated, borderRadius: radius.lg, padding: spacing[3], gap: 6 },
  logEmpty: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted },
  logCopyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end',
    paddingHorizontal: spacing[2], paddingVertical: 4, marginBottom: 2,
  },
  logCopyLabel: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted },
  logLine: { fontSize: 11.5, color: c.text.secondary, fontFamily: 'monospace' },
}));
