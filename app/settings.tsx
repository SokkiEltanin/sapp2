import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, BackHandler, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import {
  ChevronLeft, ChevronRight, Search, X,
  Info, Stethoscope, Clock, Bell, Copy,
  LogIn, LogOut, User as UserIcon, Database, CalendarDays, AlertTriangle, Rocket,
  BatteryWarning, AlarmClock, Landmark, Zap, Vibrate, ShieldCheck, History, Watch, Download,
  CloudUpload, CloudDownload, LayoutGrid,
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
import { useHealthStore } from '@/store/healthStore';
import { isHealthConnectAvailable, ensureHealthConnect, openHealthConnectSettings, readHealthDay } from '@/services/healthConnectService';
import { isHapticsEnabled, setHapticsEnabled } from '@/utils/haptics';
import Toggle from '@/components/design/Toggle';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import WidgetAppearanceSheet from '@/components/settings/WidgetAppearanceSheet';
import { useWidgetSettingsStore } from '@/store/widgetSettingsStore';
import { useSyncStatus } from '@/services/cloudSync';
import {
  uploadBackup, fetchBackupMeta, restoreBackup, getLastBackupAt, isAutoBackupEnabled, setAutoBackupEnabled,
  type BackupMeta,
} from '@/services/cloudBackup';

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

// `tier: 'sub'` (2026-11-01, user: "nie rozróżniam nazwy kategorii od podkategorii")
// — wcina/zmniejsza wiersz, żeby było widać że zależy od rodzica nad nim (np.
// przełączniki widoczne TYLKO gdy "Powiadomienia z banku" jest włączone). `permission`
// oznacza wiersz prowadzący do ekranu zgody systemowej (nie zwykłe ustawienie appki) —
// odznaka "Zgoda" + ikona tarczy, żeby user widział od razu co to za rodzaj akcji.
type SettingsItem =
  | { kind: 'action'; key: string; label: string; description: string; icon: Icon; tier?: 'sub'; permission?: boolean }
  | { kind: 'value'; key: string; label: string; description: string; icon: Icon; value: string; tier?: 'sub' }
  | { kind: 'switch'; key: string; label: string; description: string; icon: Icon; value: boolean; tier?: 'sub' };

// `icon`/`summary`/`group` (2026-11-11, user: "ustawienia ogarnij lepiej żeby były
// posegregowane i domyślnie zwinięte... albo jak inne od dołu wysuwane, bo teraz
// rozwija lista długa") — główny ekran pokazuje TYLKO kategorie (ikona + jedna
// linijka stanu), zawartość wysuwa się od dołu w `AppBottomSheet`, jak reszta appki.
type SettingsSection = {
  id: string; title: string; icon: Icon; summary: string; group: 'main' | 'advanced'; items: SettingsItem[];
};

// Sekcje Ustawień (2026-10-28, user: "ustawienia jak w sap musimy podzielić żeby mieć
// INFO, DIAGNOSTYKĘ, FINANSE itp") — podział na `SettingsSection`y, każda renderowana
// jako WŁASNA karta ZAWSZE widoczna na głównym ekranie (2026-11-02: usunięty
// dwupoziomowy "kategoria → pełna lista po tapie" wzorzec z sapp, patrz komentarz przy
// renderze niżej — mockup `design/app-design.html`'s `#set` nie ma koncepcji
// drugiego poziomu, sekcje-kafle są wszystkie naraz na ekranie).
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
function buildSections(
  email: string | null,
  bank: { enabled: boolean; autoAll: boolean; pending: number },
  hapticsEnabled: boolean,
  health: { connected: boolean; lastSyncedAt: string | null },
  backup: { auto: boolean; lastAt: string | null; busy: boolean; error: string | null },
  widget: { opacity: number; textScale: string },
  sync: string,
): SettingsSection[] {
  return [
  {
    id: 'konto', title: 'Konto', icon: UserIcon, group: 'main',
    summary: email ?? 'niezalogowany',
    items: [
      { kind: 'value', key: 'account-email', label: 'Zalogowano jako', description: 'konto google', icon: UserIcon, value: email ?? '—' },
      { kind: 'action', key: 'account-logout', label: 'Wyloguj', description: 'wyloguj z konta google', icon: LogOut },
    ],
  },
  // Faza 3.12 (2026-11-02, user: "masz w sapp jak były połączenia z health czemu
  // nie możesz tego zrobić na podstawie jak tam") — Health Connect, port z sapp
  // (patrz src/services/healthConnectService.ts). Jeden wiersz, `permission: true`
  // (jak bank-notif-access) bo to prowadzi do systemowego dialogu zgody, nie
  // zwykłego ustawienia appki które appka sama kontroluje.
  {
    id: 'polaczenia', title: 'Połączenia', icon: Watch, group: 'main',
    summary: health.connected ? 'Galaxy Watch / Health Connect połączony' : 'zegarek niepołączony',
    items: [
      {
        kind: 'action', key: 'health-connect', label: 'Galaxy Watch / Health Connect', permission: true,
        description: health.connected
          ? (health.lastSyncedAt ? `połączono — ostatnia sync. ${new Date(health.lastSyncedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}` : 'połączono')
          : 'stuknij, aby połączyć (sen, kroki, tętno, waga, woda)',
        icon: Watch,
      },
      { kind: 'action', tier: 'sub', key: 'health-diag', label: 'Test: wszystko z zegarka', description: 'co łapiemy z Health Connect (Samsung Health, zegarek…) — z kopiowaniem raportu', icon: Stethoscope },
    ],
  },
  // Sekcja "Finanse" miała dotąd tylko statyczne "W budowie" — stałe od Fazy 2.1,
  // zanim appka miała cokolwiek finansowego do wystawienia. Faza 2.5 (2026-11-01,
  // "najbardziej ryzykowny, natywny kawałek" z ARCHITECTURE.md §FINANSE) daje jej
  // pierwszą realną zawartość: włącznik auto-przechwytu płatności z banku (natywny
  // NotificationListenerService, patrz plugins/withBankNotificationListener.js) +
  // link do kolejki przeglądu (app/bank-review.tsx). Faza 2.7 (2026-11-01, user:
  // "historia żebym mógł cofnąć albo stworzyć szablon") dodaje "Historia i szablony"
  // (app/bank-history.tsx) — cofnij/"Stwórz szablon" opisane tam i w bank-review.tsx.
  {
    id: 'finanse', title: 'Finanse', icon: Landmark, group: 'main',
    summary: !bank.enabled ? 'powiadomienia z banku wyłączone · import z sapp'
      : bank.pending > 0 ? `${bank.pending} płatności z banku do zatwierdzenia` : 'powiadomienia z banku włączone',
    items: [
      {
        kind: 'switch', key: 'bank-enabled', label: 'Powiadomienia z banku',
        description: 'łap płatności kartą/przelewy z Pekao i PKO automatycznie',
        icon: Landmark, value: bank.enabled,
      },
      // `tier: 'sub'` (2026-11-01, user: "nie rozróżniam nazwy kategorii od
      // podkategorii") — te 4 wiersze istnieją/mają sens TYLKO gdy wyłącznik wyżej
      // jest włączony, więc wizualnie są wcięte/zmniejszone pod nim, nie na równi.
      ...(bank.enabled ? [
        { kind: 'action' as const, tier: 'sub' as const, permission: true, key: 'bank-notif-access', label: 'Dostęp do powiadomień', description: 'ekran systemowy — przyznaj Sapp2 RAZ, inaczej nasłuch nic nie złapie', icon: Bell },
        { kind: 'switch' as const, tier: 'sub' as const, key: 'bank-auto-all', label: 'Dodawaj automatycznie', description: 'każda płatność kartą księguje się bez przeglądu', icon: Zap, value: bank.autoAll },
        { kind: 'action' as const, tier: 'sub' as const, key: 'bank-test', label: 'Sprawdź teraz (diagnostyka)', description: 'czy nasłuch w ogóle coś odbiera — log na dole ekranu', icon: Stethoscope },
        { kind: 'action' as const, tier: 'sub' as const, key: 'bank-review', label: 'Płatności do zatwierdzenia', description: bank.pending > 0 ? `${bank.pending} czeka — stuknij, żeby przejrzeć` : 'pusto — nic nie czeka na zatwierdzenie', icon: Rocket },
        { kind: 'action' as const, tier: 'sub' as const, key: 'bank-history', label: 'Historia i szablony', description: 'co już złapaliśmy — cofnij błędną pozycję albo zapisz sklep jako szablon', icon: History },
      ] : []),
      // 2026-11-09, user: "musimy dodac zeby eksport zrobic z sapp danych do
      // sapp2 - glownie zalezy mi na finansach i paragonach wstecz oraz humor"
      // — sapp JUŻ ma gotowy eksport (Ustawienia → Dane → "Kopia zapasowa" →
      // eksportuje cały JSON snapshot), ta pozycja to WYŁĄCZNIE strona
      // IMPORTU w sapp2 (app/import-sapp.tsx), patrz src/services/
      // dataImportFromSapp.ts po pełny opis mapowania pól.
      { kind: 'action' as const, key: 'import-sapp', label: 'Importuj dane z sapp', description: 'wydatki/paragony, humor i stałe opłaty z eksportu sapp', icon: Download },
    ],
  },
  // Kopia zapasowa w chmurze (2026-11-11) — WSZYSTKIE dane sapp2 żyły dotąd
  // tylko w pamięci telefonu (patrz src/services/cloudBackup.ts).
  {
    id: 'dane', title: 'Dane', icon: CloudUpload, group: 'main',
    summary: backup.error ? `kopia: błąd — ${backup.error}` : backup.lastAt ? `kopia w chmurze: ${fmtBackupDate(backup.lastAt)}` : 'brak kopii w chmurze',
    items: [
      {
        kind: 'switch', key: 'backup-auto', label: 'Kopia w chmurze',
        description: `${backup.lastAt ? `ostatnia: ${fmtBackupDate(backup.lastAt)}` : 'jeszcze nie było kopii'}${backup.auto ? ' · automatycznie co 6h' : ' · automat wyłączony'}`,
        icon: CloudUpload, value: backup.auto,
      },
      { kind: 'action', tier: 'sub', key: 'backup-now', label: 'Zrób kopię teraz', description: backup.busy ? 'trwa…' : backup.error ? `nie udało się: ${backup.error}` : 'wszystkie dane appki na Twoje konto (Firestore)', icon: CloudUpload },
      { kind: 'action', tier: 'sub', key: 'backup-restore', label: 'Przywróć z kopii', description: 'np. po zmianie telefonu — najpierw pokaże, co jest w kopii', icon: CloudDownload },
      // Synchronizacja na żywo między urządzeniami (2026-11-13, services/cloudSync.ts).
      { kind: 'value', key: 'sync-status', label: 'Synchronizacja urządzeń', description: 'zadania, kalendarz i humor — telefon, komputer, zegarek', icon: CloudUpload, value: sync },
    ],
  },
  // Faza 3.13 (2026-11-02, user: "podziel ustawienia na kategorie porozmieszczaj to
  // żeby było czytelniej" + "popraw nasze alerty podziel je na kategorie") —
  // Alerty/Ogólne/Diagnostyka przeniesione NA KONIEC (po Finansach), żeby góra ekranu
  // (Konto/Połączenia/Finanse) niosła rzeczy których user faktycznie używa co dzień,
  // a testy/diagnostyka/build-info (rzadko potrzebne) nie zajmowały pierwszego ekranu.
  // Alerty skondensowane z 6 pozycji do dokładnie 4 presetów + 2 pomocnicze zgody
  // systemowe, jak user opisał 1:1: "tylko basic, tylko TAK/NIE, tylko fullscreen bez
  // powiadomienia [= cichy], tylko fullscreen bez powiadomienia z wakeup i muzyką i
  // wibracjami [= budzik]" — standalone "test OLED za 5 min" USUNIĘTY jako osobny
  // wiersz UI (funkcja/parametry w `sendNotifeeAlert` zostają, diagnostyka dalej
  // dostępna z kodu, po prostu nie zaśmieca listy czterema niemal identycznymi
  // przyciskami).
  {
    id: 'alerty', title: 'Alerty', icon: Bell, group: 'advanced',
    summary: 'testy powiadomień, bateria, dokładne alarmy',
    items: [
      { kind: 'action', key: 'alert-expo', label: 'Podstawowy', description: 'zwykłe powiadomienie (max priorytet), bez pełnego ekranu', icon: Bell },
      { kind: 'action', key: 'alert-notifee-buttons', label: 'Pełny ekran + Tak/Nie', description: 'nad blokadą ekranu, z przyciskami odpowiedzi', icon: AlertTriangle },
      { kind: 'action', key: 'alert-notifee-quiet', label: 'Pełny ekran (cichy)', description: 'nad blokadą ekranu, bez dźwięku i wibracji', icon: AlertTriangle },
      { kind: 'action', key: 'alert-notifee', label: 'Pełny ekran + budzik', description: 'nad blokadą ekranu, dźwięk w pętli + wibracje', icon: AlarmClock },
      { kind: 'action', tier: 'sub', permission: true, key: 'alert-battery', label: 'Optymalizacja baterii', description: 'wyklucz appkę, inaczej alerty mogą przychodzić z opóźnieniem/cicho', icon: BatteryWarning },
      { kind: 'action', tier: 'sub', permission: true, key: 'alert-exact-alarm', label: 'Dokładne alarmy', description: 'zgoda systemowa wymagana na Androidzie 12+', icon: AlarmClock },
    ],
  },
  // Widget pulpitu "Zadania" (2026-11-13, user: "ma ustawienia przezroczystości?").
  {
    id: 'widget', title: 'Widget na pulpit', icon: LayoutGrid, group: 'main',
    summary: `Zadania i Pogoda · tło ${widget.opacity === 0 ? 'przezroczyste' : `${widget.opacity}%`} · tekst ${widget.textScale === 'small' ? 'mały' : widget.textScale === 'large' ? 'duży' : 'średni'}`,
    items: [
      { kind: 'action', key: 'widget-appearance', label: 'Wygląd widgetów', description: 'Zadania i Pogoda: przezroczystość, kolor tła, wielkość tekstu', icon: LayoutGrid },
    ],
  },
  {
    id: 'ogolne', title: 'Ogólne', icon: Vibrate, group: 'main',
    summary: `wibracje ${hapticsEnabled ? 'włączone' : 'wyłączone'}`,
    items: [
      { kind: 'switch', key: 'haptics-enabled', label: 'Wibracje', description: 'delikatne kliknięcie przy tapach w appce', icon: Vibrate, value: hapticsEnabled },
    ],
  },
  // "Diagnostyka" + stara "Info" złączone w jedną sekcję (2026-11-02) — build-info
  // (wersja/build/data/commit, `value` itemy) to też diagnostyka ("czy to najnowszy
  // build"), osobna sekcja dla czterech statycznych wierszy była przerostem.
  {
    id: 'diagnostyka', title: 'Diagnostyka', icon: Stethoscope, group: 'advanced',
    summary: `wersja ${BUILD_INFO.version} · build ${BUILD_INFO.buildNumber} · testy połączeń`,
    items: [
      { kind: 'value', key: 'info-version', label: 'Wersja', description: 'numer wersji appki', icon: Info, value: BUILD_INFO.version },
      { kind: 'value', key: 'info-build', label: 'Build', description: 'numer builda CI', icon: Info, value: BUILD_INFO.buildNumber },
      { kind: 'value', key: 'info-date', label: 'Data builda', description: 'kiedy zbudowano ten APK', icon: Clock, value: BUILD_INFO.buildDate },
      { kind: 'value', key: 'info-commit', label: 'Commit', description: 'hash commita z którego zbudowano', icon: Copy, value: BUILD_INFO.commit },
      { kind: 'action', tier: 'sub', key: 'google', label: 'Zaloguj przez Google (test)', description: 'sprawdź czy Google Sign-In działa', icon: LogIn },
      { kind: 'action', tier: 'sub', key: 'firestore', label: 'Firestore (test)', description: 'zapis/odczyt testowego dokumentu', icon: Database },
      { kind: 'action', tier: 'sub', key: 'calendar', label: 'Kalendarz Google (test)', description: 'odczyt nadchodzących wydarzeń', icon: CalendarDays },
      { kind: 'action', tier: 'sub', key: 'calendar-sync', label: 'Sync kalendarza (test)', description: 'round-trip dodaj/zmień/usuń, Firestore + Google', icon: CalendarDays },
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
function fmtBackupDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
}

// Komunikaty z Firebase/requireUid są po angielsku — user widzi je wprost w wierszu.
function backupErrorText(e: any): string {
  const msg = String(e?.message ?? e);
  if (msg.includes('Not authenticated')) return 'brak zalogowania — wyloguj i zaloguj się ponownie';
  if (msg.toLowerCase().includes('permission')) return 'brak uprawnień do zapisu w Firestore (reguły bazy)';
  return msg;
}

function describeSummary(meta: BackupMeta): string {
  const x = meta.summary;
  return `${x.expenses} wydatków, ${x.mood} wpisów humoru, ${x.tasks} zadań, ${x.subscriptions} stałych opłat, ${x.vehicles} pojazdów`;
}

export default function SettingsScreen() {
  const s = makeS();
  const { user } = useAuthUser();
  const [log, setLog] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);

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
  const healthConnected = useHealthStore((st) => st.connected);
  const healthLastSyncedAt = useHealthStore((st) => st.lastSyncedAt);
  const setHealthConnected = useHealthStore((st) => st.setConnected);
  const setHealthToday = useHealthStore((st) => st.setToday);
  const [backupAuto, setBackupAuto] = useState(true);
  const [backupLastAt, setBackupLastAt] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [restoreMeta, setRestoreMeta] = useState<BackupMeta | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  useEffect(() => {
    isAutoBackupEnabled().then(setBackupAuto).catch(() => {});
    getLastBackupAt().then(setBackupLastAt).catch(() => {});
  }, []);
  const syncState = useSyncStatus((st) => st.state);
  const syncLastAt = useSyncStatus((st) => st.lastAt);
  const syncError = useSyncStatus((st) => st.error);
  const syncLabel = syncState === 'ok'
    ? `działa${syncLastAt ? ` · ${new Date(syncLastAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}` : ''}`
    : syncState === 'connecting' ? 'łączę…' : syncState === 'error' ? `błąd: ${(syncError ?? '').slice(0, 40)}` : 'wyłączona';
  const widgetOpacity = useWidgetSettingsStore((st) => st.bgOpacity);
  const widgetTextScale = useWidgetSettingsStore((st) => st.textScale);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const sections = useMemo(
    () => buildSections(
      user?.email ?? null,
      { enabled: bankEnabled, autoAll: bankAutoAll, pending: bankPending },
      hapticsEnabled,
      { connected: healthConnected, lastSyncedAt: healthLastSyncedAt },
      { auto: backupAuto, lastAt: backupLastAt, busy: backupBusy, error: backupError },
      { opacity: widgetOpacity, textScale: widgetTextScale },
      syncLabel,
    ),
    [user?.email, bankEnabled, bankAutoAll, bankPending, hapticsEnabled, healthConnected, healthLastSyncedAt, backupAuto, backupLastAt, backupBusy, backupError, widgetOpacity, widgetTextScale, syncLabel],
  );

  const backupNow = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupError(null);
    append('Kopia w chmurze: wysyłam…');
    try {
      const meta = await uploadBackup();
      setBackupLastAt(meta.createdAt);
      append(`Kopia gotowa: ${describeSummary(meta)} (${Math.round(meta.chars / 1024)} KB).`);
    } catch (e: any) {
      setBackupError(backupErrorText(e));
      append(`Błąd kopii: ${String(e?.message ?? e)}`);
    } finally {
      setBackupBusy(false);
    }
  };
  const openRestore = async () => {
    append('Sprawdzam kopię w chmurze…');
    try {
      const meta = await fetchBackupMeta();
      if (!meta) { append('Brak kopii w chmurze — najpierw "Zrób kopię teraz" na telefonie z danymi.'); return; }
      setRestoreError(null);
      setRestoreMeta(meta);
    } catch (e: any) {
      append(`Błąd: ${String(e?.message ?? e)}`);
    }
  };
  const confirmRestore = async () => {
    setRestoring(true);
    try {
      const meta = await restoreBackup();
      append(`Przywrócono kopię z ${fmtBackupDate(meta.createdAt)}: ${describeSummary(meta)}. Poprzednie dane zapisane w pliku sapp2-przed-przywroceniem.json.`);
      setRestoreMeta(null);
    } catch (e: any) {
      setRestoreError(backupErrorText(e));
      append(`Błąd przywracania: ${String(e?.message ?? e)}`);
    } finally {
      setRestoring(false);
    }
  };
  const toggleBackupAuto = () => {
    const next = !backupAuto;
    setBackupAuto(next);
    setAutoBackupEnabled(next).catch(() => {});
  };

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
  const sendNotifeeAlert = async (withActions: boolean, quiet = false, delayMs = 5000, includeInstant = true) => {
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
      // `quiet` (2026-11-02, user: jeden z czterech presetów ma być "pełny ekran bez
      // powiadomienia [dźwięku/wibracji]") — kanał na Androidzie jest NIEMUTOWALNY
      // (patrz komentarz nad `-v3` niżej), a `sound`/`vibration` ustawione NA
      // KANALE wygrywają z ewentualnym per-notification override, więc cichy
      // wariant musi iść pod ZUPEŁNIE OSOBNYM id, nie przez wyzerowanie pól na
      // notyfikacji w tym samym kanale co głośny wariant.
      const channelId = quiet
        ? await notifee.createChannel({
          id: 'alerts-fullscreen-quiet-v1',
          name: 'Alerty pełnoekranowe (ciche)',
          importance: AndroidImportance.HIGH,
          vibration: false,
          lights: false,
          bypassDnd: true,
        })
        : await notifee.createChannel({
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
        ...(!quiet && { sound: 'default', loopSound: true }),
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
    // `Toggle` (src/components/design/Toggle.tsx) sam już buczy na KAŻDE naciśnięcie,
    // przed zmianą stanu — więc "wyłącz wibracje" i tak zdąży zabuczeć (działa na
    // starym `enabled`), bez osobnego wywołania tutaj (było dublowanie buczenia).
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

  // Faza 3.12 — "Połącz" woła `ensureHealthConnect()` (prosi o zgodę jeśli trzeba,
  // cicho potwierdza jeśli już przyznana) i od razu dociąga dzisiejszy snapshot, żeby
  // Dashboard/Daily miały dane bez czekania na pierwszy auto-sync (`useHealthSync.ts`).
  const connectHealthConnect = async () => {
    append('Health Connect: łączenie…');
    if (!(await isHealthConnectAvailable())) {
      append('Niedostępne w tej wersji — potrzebny nowy build APK (ten moduł nie działa w Expo Go).');
      return;
    }
    const res = await ensureHealthConnect();
    if (!res.ok) {
      if (res.reason === 'denied') {
        append('Odmówiono dostępu — włącz go ręcznie w Health Connect, potem spróbuj ponownie.');
        await openHealthConnectSettings();
        return;
      }
      const msg = res.reason === 'unavailable' ? 'Health Connect niedostępny na tym telefonie'
        : res.reason === 'update' ? 'Zaktualizuj Health Connect ze sklepu Play'
        : res.reason === 'init' ? 'Nie udało się zainicjować Health Connect'
        : 'Nie udało się połączyć z Health Connect';
      append(`Błąd: ${msg}`);
      return;
    }
    setHealthConnected(true);
    append('Połączono — synchronizuję dzisiejsze dane…');
    try {
      setHealthToday(await readHealthDay(new Date()));
      append('Zsynchronizowano.');
    } catch (e: any) {
      append(`Połączono, ale synchronizacja się nie udała: ${String(e?.message ?? e)}`);
    }
  };

  // Panel kategorii to osobne okno (`Modal`) — akcja przechodząca na INNY ekran
  // zamyka go i przechodzi DOPIERO po zakończeniu animacji zamykania
  // (`AppBottomSheet`'s `onClosed`). Przejście od razu (pierwsza wersja,
  // 2026-11-11) zostawiało puste, ciemne okno na wierzchu nowego ekranu.
  const pendingNav = useRef<(() => void) | null>(null);
  const leave = (go: () => void) => () => {
    if (!openSectionId) { go(); return; }
    pendingNav.current = go;
    setOpenSectionId(null);
  };
  const runPendingNav = () => {
    const go = pendingNav.current;
    pendingNav.current = null;
    go?.();
  };
  const handlers: Record<string, () => void> = {
    'account-logout': leave(handleLogout),
    'health-connect': connectHealthConnect,
    google: testGoogleSignIn,
    firestore: testFirestore,
    calendar: testCalendar,
    'calendar-sync': testCalendarSync,
    'alert-expo': testExpoAlert,
    'alert-notifee': () => sendNotifeeAlert(false, false),
    'alert-notifee-buttons': () => sendNotifeeAlert(true, false),
    'alert-notifee-quiet': () => sendNotifeeAlert(false, true),
    'alert-battery': checkBatteryOptimization,
    'alert-exact-alarm': openExactAlarmSettings,
    'bank-enabled': toggleBankEnabled,
    'bank-notif-access': openNotificationAccess,
    'bank-auto-all': toggleBankAutoAll,
    'bank-test': testBankCapture,
    'bank-review': leave(() => router.push('/bank-review' as any)),
    'bank-history': leave(() => router.push('/bank-history' as any)),
    'import-sapp': leave(() => router.push('/import-sapp' as any)),
    'haptics-enabled': toggleHaptics,
    'backup-auto': toggleBackupAuto,
    'backup-now': backupNow,
    'backup-restore': openRestore,
    'widget-appearance': leave(() => setWidgetOpen(true)),
    'health-diag': leave(() => router.push('/health-debug' as any)),
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

  const handleBack = () => {
    if (query) { setQuery(''); return; }
    router.back();
  };

  // Sprzętowy/gestowy przycisk "wstecz" na Androidzie POMIJA `handleBack` (ten reaguje
  // tylko na tap w `ChevronLeft` w nagłówku) — bez przechwycenia, expo-router po prostu
  // zdejmuje `/settings` ze stosu i wychodzi do Dashboardu, nawet gdy user wciąż szuka
  // (2026-10-28, user na urządzeniu: "chcę cofnąć to mnie cofa od razu do DASHBOARDU
  // zamiast do głównych ustawień"). Ten sam dokładnie bug i fix co w sapp
  // (app/settings.tsx, `closeSection`/`BackHandler`). Gałąź "wróć z rozwiniętej
  // kategorii" ODPADŁA (2026-11-02, patrz niżej) — sekcje są teraz WSZYSTKIE naraz
  // widoczne, nie ma już stanu "w środku kategorii" do zamykania.
  useEffect(() => {
    if (Platform.OS !== 'android' || !query) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setQuery('');
      return true;
    });
    return () => sub.remove();
  }, [query]);

  const headerTitle = query ? 'Szukaj' : 'Ustawienia';
  const openSection = sections.find((sec) => sec.id === openSectionId) ?? null;
  const renderLog = () => (log.length > 0 ? (
    <View style={s.logBox}>
      <TouchableOpacity style={s.logCopyBtn} onPress={copyLog} activeOpacity={0.7}>
        <Copy size={13} color={colors.text.muted} />
        <Text style={s.logCopyLabel}>Kopiuj log</Text>
      </TouchableOpacity>
      {log.map((line, i) => <Text key={i} style={s.logLine}>{line}</Text>)}
    </View>
  ) : null);

  // Przeprojektowane (2026-11-01, user zrzutem ekranu Finansów: "nie rozróżniam
  // nazwy kategorii od podkategorii, oraz jak coś jest pozwoleniem żeby miało
  // symbol... albo toggle jak w ustawieniach telefonów"):
  // - `description` WRESZCIE się renderuje jako podtytuł — wcześniej istniało TYLKO
  //   do wyszukiwania (`item.description.toLowerCase().includes(q)` niżej), nigdy
  //   nie było widoczne na ekranie, mimo że dla wielu wierszy niosło stan ("WŁĄCZONE"
  //   itp.) — to był większy powód "nie widzę różnicy między wierszami" niż sam brak
  //   wcięcia.
  // - `kind: 'switch'` → `Toggle` (`src/components/design/Toggle.tsx`, 2026-11-02 —
  //   był tu natywny `Switch` z zielonym `trackColor.true`, co kolorowało stan
  //   "włączone" wbrew własnej zasadzie appki "kolor TYLKO jako funkcjonalny akcent";
  //   `Toggle` matchuje `.tog` ze spec 1:1, monochromatyczny) dla stanów które appka
  //   faktycznie zna i kontroluje (wibracje, powiadomienia z banku, auto-dodawanie).
  // - `permission: true` → odznaka "Zgoda" + ikona tarczy przy akcjach prowadzących
  //   do EKRANU SYSTEMOWEGO (dostęp do powiadomień, bateria, dokładne alarmy) — to
  //   NIE są prawdziwe switche (appka nie ma jak programowo sprawdzić/zmienić stanu
  //   uprawnienia Androida bez nowego natywnego modułu), ale wizualnie jasne że to
  //   inny rodzaj wiersza niż zwykłe ustawienie appki.
  // - `tier: 'sub'` → wcięty, mniejszy wiersz pod rodzicem (np. 4 wiersze pod
  //   "Powiadomienia z banku", widoczne tylko gdy włączony) — "stopniowany" układ.
  const renderItem = (item: SettingsItem, isLast: boolean) => {
    const Icon = item.icon;
    const sub = item.tier === 'sub';
    const isPermission = item.kind === 'action' && !!item.permission;
    const inner = (
      <>
        <View style={[s.itemIcon, sub && s.itemIconSub, isPermission && s.itemIconPermission]}>
          <Icon size={sub ? 14 : 16} color={isPermission ? colors.accent.blue : colors.text.secondary} />
        </View>
        <View style={s.itemTextCol}>
          <View style={s.itemLabelRow}>
            <Text style={[s.itemLabel, sub && s.itemLabelSub]} numberOfLines={1}>{item.label}</Text>
            {isPermission && (
              <View style={s.permissionBadge}>
                <ShieldCheck size={10} color={colors.accent.blue} />
                <Text style={s.permissionBadgeLabel}>Zgoda</Text>
              </View>
            )}
          </View>
          {!!item.description && (
            <Text style={[s.itemDescription, sub && s.itemDescriptionSub]} numberOfLines={2}>{item.description}</Text>
          )}
        </View>
        {item.kind === 'value' && <Text style={s.itemValue} numberOfLines={1}>{item.value}</Text>}
        {item.kind === 'switch' && (
          <Toggle value={item.value} onValueChange={() => handlers[item.key]?.()} />
        )}
        {item.kind === 'action' && <ChevronRight size={15} color={colors.text.muted} />}
      </>
    );
    if (item.kind === 'value') {
      return <View key={item.key} style={[s.item, sub && s.itemSub, !isLast && s.itemDivider]}>{inner}</View>;
    }
    return (
      <TouchableOpacity key={item.key} style={[s.item, sub && s.itemSub, !isLast && s.itemDivider]} onPress={() => handlers[item.key]?.()} activeOpacity={0.7}>
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
        {searchResults ? (
          searchResults.length === 0 ? (
            <Text style={s.noResults}>Brak wyników dla „{query}”.</Text>
          ) : (
            <View style={s.sectionCard}>
              {searchResults.map((item, i) => renderItem(item, i === searchResults.length - 1))}
            </View>
          )
        ) : (
          // Kategorie ZWINIĘTE (2026-11-11, user: "posegregowane i domyślnie
          // zwinięte... albo jak inne od dołu wysuwane, bo teraz rozwija lista
          // długa") — zastępuje "wszystkie sekcje naraz" z 2026-11-02 (wtedy pod
          // makietę; urosło do ~30 wierszy). Jedna linijka stanu na kategorię
          // (np. "kopia w chmurze: dziś 14:32"), żeby nie trzeba było wchodzić,
          // żeby wiedzieć czy coś wymaga uwagi. Rzadko używane (Alerty/
          // Diagnostyka) osobno, pod "Zaawansowane".
          (['main', 'advanced'] as const).map((group) => (
            <View key={group} style={s.sectionBlock}>
              {group === 'advanced' && <Text style={s.sectionCap}>ZAAWANSOWANE</Text>}
              <View style={s.sectionCard}>
                {sections.filter((sec) => sec.group === group).map((sec, i, arr) => {
                  const SecIcon = sec.icon;
                  return (
                    <TouchableOpacity
                      key={sec.id}
                      style={[s.item, i < arr.length - 1 && s.itemDivider]}
                      onPress={() => setOpenSectionId(sec.id)}
                      activeOpacity={0.7}
                    >
                      <View style={s.itemIcon}><SecIcon size={16} color={colors.text.secondary} /></View>
                      <View style={s.itemTextCol}>
                        <Text style={s.itemLabel} numberOfLines={1}>{sec.title}</Text>
                        <Text style={s.itemDescription} numberOfLines={1}>{sec.summary}</Text>
                      </View>
                      <ChevronRight size={15} color={colors.text.muted} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        )}

        {/* Log poza panelem — tylko przy szukaniu (akcje z płaskiej listy
            wyników); w kategorii log jest w jej panelu, pod przyciskami. */}
        {searchResults && renderLog()}
      </ScrollView>

      <AppBottomSheet visible={!!openSection} onClose={() => setOpenSectionId(null)} onClosed={runPendingNav} header={openSection ? <Text style={s.sheetTitle}>{openSection.title}</Text> : undefined}>
        {openSection && (
          <>
            <View style={s.sectionCard}>
              {openSection.items.map((item, i) => renderItem(item, i === openSection.items.length - 1))}
            </View>
            {renderLog()}
          </>
        )}
      </AppBottomSheet>

      {/* Potwierdzenie przywrócenia (2026-11-11) — nadpisuje dane na telefonie,
          więc user MUSI zobaczyć z kiedy jest kopia i co w niej jest. */}
      <AppBottomSheet visible={!!restoreMeta} onClose={() => { if (!restoring) setRestoreMeta(null); }} scrollable={false}>
        {restoreMeta && (
          <View style={s.restoreBody}>
            <Text style={s.restoreTitle}>Przywrócić kopię?</Text>
            <Text style={s.restoreText}>Kopia z {fmtBackupDate(restoreMeta.createdAt)}: {describeSummary(restoreMeta)}.</Text>
            <Text style={s.restoreText}>Zastąpi dane na tym telefonie. Obecne dane zostaną zapisane w pliku sapp2-przed-przywroceniem.json, na wszelki wypadek.</Text>
            {restoreError && <Text style={s.restoreError}>Nie udało się: {restoreError}</Text>}
            <View style={s.restoreActions}>
              <TouchableOpacity style={s.restoreCancel} onPress={() => setRestoreMeta(null)} disabled={restoring} activeOpacity={0.7}>
                <Text style={s.restoreCancelLabel}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.restoreConfirm, restoring && { opacity: 0.5 }]} onPress={confirmRestore} disabled={restoring} activeOpacity={0.7}>
                <Text style={s.restoreConfirmLabel}>{restoring ? 'Przywracam…' : 'Przywróć'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </AppBottomSheet>
      <WidgetAppearanceSheet visible={widgetOpen} onClose={() => setWidgetOpen(false)} />
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.primary, paddingBottom: spacing[2] },
  restoreBody: { gap: spacing[2], paddingVertical: spacing[1] },
  restoreTitle: { fontSize: 18, fontFamily: 'Inter_800ExtraBold', color: c.text.bright },
  restoreText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.secondary, lineHeight: 18 },
  restoreError: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.accent.red },
  restoreActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[2] },
  restoreCancel: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  restoreCancelLabel: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  restoreConfirm: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.md, backgroundColor: c.text.bright },
  restoreConfirmLabel: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  // `fontSize`/`fontFamily`/`color` wyrównane do `.h1` ze spec (2026-11-02, patrz
  // komentarz przy renderze sekcji) — ten sam nagłówkowy styl co Dashboard/Daily/
  // Finanse/Zadania. Zostaje wyśrodkowany + z `ChevronLeft` (nie lewo wyrównany jak
  // na tabach) — Ustawienia są PUSHowanym ekranem z realnym "wstecz", nie tabem,
  // ten konkretny layout-wybór jest nawigacją, nie stylem, i spec go nie definiuje.
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: 'Inter_900Black', letterSpacing: -0.5, color: c.text.bright },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    backgroundColor: c.bg.card, borderRadius: radius.tile, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], height: 42,
  },
  searchInput: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_500Medium', color: c.text.primary, padding: 0 },

  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[4] },
  noResults: { fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', marginTop: spacing[4] },

  // Blok sekcji = podpis `.cap` ze spec (10px/700/uppercase, ten sam co podpisy
  // kafli na Daily/Zadaniach) + karta z wierszami wprost pod nim — ZASTĘPUJE
  // (2026-11-02) poprzedni `categoryRow`/`categoryIcon`/`categoryTitle`/
  // `categorySubtitle` "kafel-kategoria, tap wchodzi w pełną listę" (USUNIĘTE).
  sectionBlock: { gap: spacing[2] },
  sectionCap: {
    fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, color: c.text.primary,
    marginLeft: spacing[1],
  },
  sectionCard: {
    backgroundColor: c.bg.card, borderRadius: radius.tile, borderWidth: 1, borderColor: c.border.default,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  // "Stopniowany" układ (2026-11-01) — wcięty + gęstszy wiersz pod rodzicem.
  itemSub: { paddingLeft: spacing[3] + spacing[5], paddingVertical: spacing[2] },
  itemDivider: { borderBottomWidth: 1, borderBottomColor: c.border.subtle },
  itemIcon: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.elevated },
  itemIconSub: { width: 24, height: 24 },
  itemIconPermission: { backgroundColor: `${c.accent.blue}1A`, borderWidth: 1, borderColor: `${c.accent.blue}55` },
  itemTextCol: { flex: 1, gap: 1 },
  itemLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemLabel: { flexShrink: 1, fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  itemLabelSub: { fontSize: 12.5 },
  itemDescription: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted },
  itemDescriptionSub: { fontSize: 10.5 },
  permissionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: `${c.accent.blue}1A`, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2,
  },
  permissionBadgeLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', color: c.accent.blue },
  itemValue: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.secondary, maxWidth: 160 },

  logBox: { backgroundColor: c.bg.elevated, borderRadius: radius.tile, padding: spacing[3], gap: 6 },
  logCopyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end',
    paddingHorizontal: spacing[2], paddingVertical: 4, marginBottom: 2,
  },
  logCopyLabel: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted },
  logLine: { fontSize: 11.5, color: c.text.secondary, fontFamily: 'monospace' },
}));
