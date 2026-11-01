import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, BackHandler, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import {
  ChevronLeft, ChevronRight, Search, X,
  Info, Stethoscope, Wallet, Clock, Bell, Copy,
  LogIn, LogOut, User as UserIcon, Database, CalendarDays, AlertTriangle, Rocket,
  BatteryWarning, AlarmClock, Landmark, Zap, Vibrate,
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
import { useBankQueue } from '@/store/bankQueueStore';
import { isHapticsEnabled, setHapticsEnabled, haptic } from '@/utils/haptics';

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
  | { kind: 'action'; key: string; label: string; description: string; icon: Icon }
  | { kind: 'value'; key: string; label: string; description: string; icon: Icon; value: string };

type SettingsSection = { id: string; title: string; icon: Icon; items: SettingsItem[] };

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
//
// `color`/`accent` per-sekcja i per-item USUNIĘTE (2026-10-30, user zaznaczył to
// explicite: "ustawienia tez [maja byc w nowym stylu]... ogarnij to teraz" —
// monochromatyczny redesign, patrz colors.ts). Odznaki ikon teraz neutralne
// (`c.bg.elevated` + `c.text.secondary`), tak samo dla wszystkich kategorii/pozycji —
// kolor nie niesie już znaczenia kategorii, tylko funkcjonalne akcenty (tagi zadań)
// zostają kolorowe.
function buildSections(email: string | null, bank: { enabled: boolean; autoAll: boolean; pending: number }, hapticsEnabled: boolean): SettingsSection[] {
  return [
  {
    id: 'konto', title: 'Konto', icon: UserIcon,
    items: [
      { kind: 'value', key: 'account-email', label: 'Zalogowano jako', description: 'konto google', icon: UserIcon, value: email ?? '—' },
      { kind: 'action', key: 'account-logout', label: 'Wyloguj', description: 'wyloguj z konta google', icon: LogOut },
    ],
  },
  // Faza 2.6 (2026-11-01) — JEDEN globalny przełącznik, nie per-ekran (ustalone
  // 2026-10-26, patrz ARCHITECTURE.md §Ogólne "Wibracje").
  {
    id: 'ogolne', title: 'Ogólne', icon: Vibrate,
    items: [
      {
        kind: 'action', key: 'haptics-enabled', label: 'Wibracje',
        description: hapticsEnabled ? 'WŁĄCZONE — stuknij, żeby wyłączyć' : 'wyłączone — stuknij, żeby włączyć',
        icon: Vibrate,
      },
    ],
  },
  {
    id: 'info', title: 'Info', icon: Info,
    items: [
      { kind: 'value', key: 'info-version', label: 'Wersja', description: 'wersja aplikacji', icon: Info, value: BUILD_INFO.version },
      { kind: 'value', key: 'info-build', label: 'Build', description: 'numer builda github actions', icon: Info, value: `#${BUILD_INFO.buildNumber}` },
      { kind: 'value', key: 'info-date', label: 'Zbudowano', description: 'data builda', icon: Clock, value: BUILD_INFO.buildDate },
      { kind: 'value', key: 'info-commit', label: 'Commit', description: 'git commit sha', icon: Info, value: BUILD_INFO.commit },
    ],
  },
  {
    id: 'diagnostyka', title: 'Diagnostyka', icon: Stethoscope,
    items: [
      { kind: 'action', key: 'google', label: 'Zaloguj przez Google', description: 'logowanie konto sign-in', icon: LogIn },
      { kind: 'action', key: 'firestore', label: 'Test Firestore', description: 'baza danych synchronizacja', icon: Database },
      { kind: 'action', key: 'calendar', label: 'Test Kalendarza Google', description: 'wydarzenia kalendarz', icon: CalendarDays },
      { kind: 'action', key: 'calendar-sync', label: 'Sync kalendarza (dane)', description: 'test warstwy danych firestore i google calendar round-trip', icon: CalendarDays },
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
    id: 'alerty', title: 'Alerty', icon: Bell,
    items: [
      { kind: 'action', key: 'alert-expo', label: 'Expo (MAX priorytet)', description: 'powiadomienia alert notification heads-up', icon: AlertTriangle },
      { kind: 'action', key: 'alert-notifee', label: 'Notifee (bez przycisku)', description: 'powiadomienia alert notification pelny ekran budzik', icon: Rocket },
      { kind: 'action', key: 'alert-notifee-buttons', label: 'Notifee (Tak/Nie)', description: 'powiadomienia alert notification pelny ekran budzik przyciski akcji', icon: Rocket },
      { kind: 'action', key: 'alert-notifee-5min', label: 'Notifee za 5 min (test OLED)', description: 'sprawdza czy ekran faktycznie sie wybudza z glebokiego usypiania, nie tylko gra w ciemno', icon: Rocket },
      { kind: 'action', key: 'alert-battery', label: 'Optymalizacja baterii', description: 'sprawdza i prosi o wylaczenie — najczestsza przyczyna ciszy po dlugim opoznieniu', icon: BatteryWarning },
      { kind: 'action', key: 'alert-exact-alarm', label: 'Dokladne alarmy', description: 'otwiera systemowe ustawienia "Alarmy i przypomnienia" wymagane dla terminowego budzenia', icon: AlarmClock },
    ],
  },
  // Sekcja "Finanse" miała dotąd tylko statyczne "W budowie" — stałe od Fazy 2.1,
  // zanim appka miała cokolwiek finansowego do wystawienia. Faza 2.5 (2026-11-01,
  // "najbardziej ryzykowny, natywny kawałek" z ARCHITECTURE.md §FINANSE) daje jej
  // pierwszą realną zawartość: włącznik auto-przechwytu płatności z banku (natywny
  // NotificationListenerService, patrz plugins/withBankNotificationListener.js) +
  // link do kolejki przeglądu (app/bank-review.tsx). Szablony powiadomień/dopasowania
  // (sapp miał to jako osobny krok dodany PO działającym MVP) świadomie odłożone —
  // patrz NEXT_STEPS.md.
  {
    id: 'finanse', title: 'Finanse', icon: Wallet,
    items: [
      {
        kind: 'action', key: 'bank-enabled', label: 'Powiadomienia z banku',
        description: bank.enabled
          ? 'WŁĄCZONE — płatności kartą/przelewy łapane automatycznie'
          : 'wyłączone — stuknij, żeby zacząć łapać płatności z Pekao/PKO automatycznie',
        icon: Landmark,
      },
      ...(bank.enabled ? [
        { kind: 'action' as const, key: 'bank-notif-access', label: 'Dostęp do powiadomień', description: 'otwiera systemowy ekran — przyznaj Sapp2 RAZ, inaczej nasłuch nic nie złapie', icon: Bell },
        { kind: 'action' as const, key: 'bank-auto-all', label: 'Dodawaj automatycznie', description: bank.autoAll ? 'WŁĄCZONE — każda płatność kartą księguje się bez przeglądu' : 'wyłączone — nowy sprzedawca czeka na Twoje zatwierdzenie, potem uczy się sam', icon: Zap },
        { kind: 'action' as const, key: 'bank-test', label: 'Sprawdź teraz (diagnostyka)', description: 'czy nasłuch w ogóle coś odbiera — log na dole ekranu', icon: Stethoscope },
        { kind: 'action' as const, key: 'bank-review', label: 'Płatności do zatwierdzenia', description: bank.pending > 0 ? `${bank.pending} czeka — stuknij, żeby przejrzeć` : 'pusto — nic nie czeka na zatwierdzenie', icon: Rocket },
      ] : []),
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
  const bankEnabled = useBankQueue((st) => st.enabled);
  const bankAutoAll = useBankQueue((st) => st.autoAll);
  const bankPending = useBankQueue((st) => st.pending.length);
  const setBankEnabled = useBankQueue((st) => st.setEnabled);
  const setBankAutoAll = useBankQueue((st) => st.setAutoAll);
  // `isHapticsEnabled()` to zwykły, synchroniczny getter (utils/haptics.ts) — nie jest
  // reaktywny sam w sobie, więc lokalny stan tutaj (ten sam wzorzec co `offset` w
  // finances.tsx dla `getBalanceOffset()`), żeby opis w `buildSections` odświeżał się
  // po tapie.
  const [hapticsEnabled, setHapticsEnabledState] = useState(isHapticsEnabled());
  const sections = useMemo(
    () => buildSections(user?.email ?? null, { enabled: bankEnabled, autoAll: bankAutoAll, pending: bankPending }, hapticsEnabled),
    [user?.email, bankEnabled, bankAutoAll, bankPending, hapticsEnabled],
  );

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
      // `-v2` (2026-11-01, user: "nie słychać dźwięku w żadnym" z czterech testów) —
      // ten kanał NIGDY wcześniej nie był wersjonowany, w odróżnieniu od notifee
      // niżej (`alerts-fullscreen-v3`, bumpowany dwa razy po dokładnie tym objawie).
      // Kanały na Androidzie są NIEMUTOWALNE po utworzeniu — jeśli 'alerts-max'
      // powstał w którejś WCZEŚNIEJSZEJ rundzie testów (przed tym jak `sound`
      // wylądował w konfiguracji), telefon trzyma się tamtej, cichej rejestracji na
      // zawsze, niezależnie od aktualnego kodu. Nowe id usuwa tę możliwość.
      await Notifications.setNotificationChannelAsync('alerts-max-v2', {
        name: 'Alerty (test) v2',
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
        trigger: { channelId: 'alerts-max-v2' },
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
  // `includeInstant` (2026-10-29, user: test "za 5 min" odpalał się OD RAZU) — BUG:
  // funkcja zawsze najpierw wysyłała powiadomienie NATYCHMIASTOWE (część
  // diagnostyczna z wcześniejszej rundy, do izolowania problemu zgoda/kanał vs
  // trigger), niezależnie od `delayMs` — to ONO przekierowywało na ekran alarmu
  // natychmiast, maskując to że prawdziwy test opóźnienia (5 min) w ogóle się nie
  // wykonał. Test OLED musi iść BEZ instant-części, inaczej nie testuje tego co ma.
  const sendNotifeeAlert = async (withActions: boolean, delayMs = 5000, includeInstant = true) => {
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
      // Diagnostyka dla długich opóźnień (2026-11-01, user: "ten OLED ni dziala" —
      // test za 5s działał, test za 5 MIN nie) — `allowWhileIdle` prosi system o
      // dokładny alarm, ale na Androidzie 12+ to NIE jest automatycznie
      // gwarantowane: jeśli optymalizacja baterii jest WŁĄCZONA dla appki, system
      // może cicho zdegradować/opóźnić alarm podczas Doze, zamiast go odrzucić z
      // błędem — dokładnie taki objaw ("log pokazuje sukces, nic nie przychodzi po
      // czasie") jak zgłoszony. Tylko LOGUJEMY tutaj (nie blokujemy testu) — fix to
      // osobne przyciski "Optymalizacja baterii"/"Dokładne alarmy" niżej w Alertach,
      // bo to decyzja/zgoda usera w systemowych ustawieniach, nie coś co appka może
      // cicho włączyć sama.
      if (delayMs >= 60000) {
        try {
          const batteryRestricted = await notifee.isBatteryOptimizationEnabled();
          if (batteryRestricted) {
            append('UWAGA: optymalizacja baterii WŁĄCZONA dla appki — to najczęstsza przyczyna ciszy po dłuższym opóźnieniu. Użyj "Optymalizacja baterii" w Alertach, potem powtórz ten test.');
          } else {
            append('Optymalizacja baterii: appka już wykluczona, ok.');
          }
        } catch {
          // starszy Android (<23) albo niedostępne — pomijamy diagnostykę, nie test.
        }
      }
      // UWAGA: kanał na Androidzie jest NIEMUTOWALNY po utworzeniu — build #29 rzucał
      // błąd walidacji na starym `vibrationPattern` W TRAKCIE `createChannel`, co mogło
      // zdążyć zarejestrować kanał z domyślnymi (cichymi) ustawieniami zanim doszło do
      // walidacji. Każda kolejna zmiana konfiguracji musi iść pod NOWYM id, inaczej
      // system trzyma się pierwszej (zepsutej) rejestracji — złapane na urządzeniu
      // (2026-10-28, user: "bez wibracji czy dźwięku" mimo poprawnej konfiguracji w
      // kodzie). `-v3` (2026-10-29, `loopSound` dalej cicho mimo poprawnego kodu —
      // ten sam objaw co poprzednio, ten sam fix: nowy id na wszelki wypadek stałej
      // rejestracji).
      const channelId = await notifee.createChannel({
        id: 'alerts-fullscreen-v3',
        name: 'Alerty pełnoekranowe (test) v3',
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
      if (includeInstant) {
        await notifee.displayNotification({
          title: 'Test NATYCHMIAST (notifee)',
          body: 'Jeśli TEGO nie widzisz/słyszysz od razu (appka wciąż otwarta), problem jest w zgodzie/kanale, nie w opóźnionym triggerze.',
          data: { route: 'alert-test' },
          android,
        });
        append('Natychmiastowe wysłane — POWINNO pokazać się OD RAZU, appka wciąż otwarta.');
      }

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

  // Dwa jednorazowe przyciski do wykluczenia najczęstszej, device-side przyczyny
  // "log mówi sukces, nic nie przychodzi po czasie" na Androidzie 12+ (patrz
  // komentarz w `sendNotifeeAlert` przy diagnostyce `isBatteryOptimizationEnabled`):
  // obie zgody appka może tylko POPROSIĆ o nie (systemowy dialog/ekran), nie
  // włączyć sama. `openPowerManagerSettings` (OEM-specific, np. MIUI "autostart")
  // tylko gdy notifee rozpoznaje DANY telefon (`getPowerManagerInfo().activity` —
  // na czystym Androidzie/Pixelu zwykle `null`, wtedy nie ma co pokazywać, nie błąd.
  const checkBatteryOptimization = async () => {
    append('Optymalizacja baterii: sprawdzam…');
    try {
      const notifeeModule = await import('@notifee/react-native');
      const notifee = notifeeModule.default;
      const restricted = await notifee.isBatteryOptimizationEnabled();
      if (restricted) {
        append('WŁĄCZONA — otwieram systemowy dialog, zgódź się na "Zezwól"/"Nie optymalizuj".');
        await notifee.openBatteryOptimizationSettings();
      } else {
        append('Appka już jest wykluczona z optymalizacji baterii — to nie jest przyczyna.');
      }
      const powerInfo = await notifee.getPowerManagerInfo();
      if (powerInfo.activity) {
        append(`Ten telefon (${powerInfo.manufacturer}) ma dodatkowy menadżer energii — otwieram jego ustawienia (np. "autostart"), włącz appkę tam też.`);
        await notifee.openPowerManagerSettings();
      }
    } catch (e: any) {
      append(`Błąd: ${String(e?.message ?? e)}`);
    }
  };

  const openExactAlarmSettings = async () => {
    append('Otwieram systemowe "Alarmy i przypomnienia" — włącz dla Sapp2, jeśli wyłączone.');
    try {
      const notifeeModule = await import('@notifee/react-native');
      await notifeeModule.default.openAlarmPermissionSettings();
    } catch (e: any) {
      append(`Błąd: ${String(e?.message ?? e)}`);
    }
  };

  // Faza 2.5 (2026-11-01) — przełączniki (enabled/autoAll) jako zwykłe 'action' itemy,
  // nie prawdziwy switch — settings.tsx nie ma typu/renderera dla kontrolki switch
  // (tylko 'action'/'value'), a dodawanie go dla jednego miejsca byłoby przerostem
  // formy nad treścią. Tap po prostu odwraca stan, opis w `buildSections` wyżej od razu
  // pokazuje nowy.
  const toggleHaptics = () => {
    haptic.tap(); // ostatni/pierwszy "spróbuj" — odpala się po STARYM stanie, więc buczy i przy włączaniu, i przy wyłączaniu
    const next = !hapticsEnabled;
    setHapticsEnabled(next).catch(() => {});
    setHapticsEnabledState(next);
  };
  const toggleBankEnabled = () => { setBankEnabled(!bankEnabled); append(bankEnabled ? 'Powiadomienia z banku: wyłączone.' : 'Powiadomienia z banku: włączone — przyznaj dostęp do powiadomień niżej.'); };
  const toggleBankAutoAll = () => { setBankAutoAll(!bankAutoAll); append(bankAutoAll ? 'Auto-dodawanie: wyłączone.' : 'Auto-dodawanie: włączone — płatności kartą księgują się bez przeglądu.'); };
  const openNotificationAccess = () => {
    Linking.sendIntent('android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS').catch(() => {
      append('Nie udało się otworzyć ustawień — znajdź "Dostęp do powiadomień" ręcznie w Ustawieniach → Aplikacje.');
    });
  };
  const testBankCapture = async () => {
    append('Sprawdzam przechwyt powiadomień z banku…');
    try {
      const { peekBankCapture, drainBankNotifications } = await import('@/services/bankNotificationDrain');
      const peek = await peekBankCapture();
      const queued = await drainBankNotifications();
      if (!peek.fileExists || peek.count === 0) {
        if (peek.seen.length === 0) {
          append('Nasłuch NIC nie odbiera (nawet z innych apek) — sprawdź "Dostęp do powiadomień" i baterię Sapp2.');
        } else {
          append(`Nasłuch działa, ale nic nie wyglądało na płatność bankową. Widziane apki: ${peek.seen.join(', ')}`);
        }
      } else {
        append(`Przechwycono ${peek.count} powiadomień. ${queued > 0 ? `Dodano ${queued} do zatwierdzenia.` : 'Żadne nie wyglądało na nową płatność.'}`);
        peek.samples.forEach((s) => append(`• ${s}`));
      }
    } catch (e: any) {
      append(`Błąd diagnostyki: ${String(e?.message ?? e)}`);
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
    'alert-notifee-5min': () => sendNotifeeAlert(false, 5 * 60 * 1000, false),
    'alert-battery': checkBatteryOptimization,
    'alert-exact-alarm': openExactAlarmSettings,
    'bank-enabled': toggleBankEnabled,
    'bank-notif-access': openNotificationAccess,
    'bank-auto-all': toggleBankAutoAll,
    'bank-test': testBankCapture,
    'bank-review': () => router.push('/bank-review' as any),
    'haptics-enabled': toggleHaptics,
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
        <View style={s.itemIcon}>
          <Icon size={16} color={colors.text.secondary} />
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
                <View style={s.categoryIcon}>
                  <Icon size={18} color={colors.text.secondary} />
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
  categoryIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.elevated },
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
  itemIcon: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.elevated },
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
