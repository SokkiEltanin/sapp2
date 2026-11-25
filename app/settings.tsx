import { goBack } from '@/services/nav';
import { storageUsage } from '@/services/safeStorage';
import { usePwaInstall, pwaInstallLabel, promptPwaInstall } from '@/services/pwaInstall';
import { useCalendarStore } from '@/store/calendarStore';
import DashboardLayoutSheet from '@/components/settings/DashboardLayoutSheet';
import AppHealthSheet from '@/components/settings/AppHealthSheet';
import ThresholdsSheet from '@/components/settings/ThresholdsSheet';
import ProfileSheet from '@/components/profile/ProfileSheet';
import { useProfileStore } from '@/store/profileStore';
import { ageOn } from '@/utils/profile';
import { appHealth, healthSummary } from '@/utils/appHealth';
import { useThresholdsStore } from '@/store/thresholdsStore';
import { plural, nWydatkow } from '@/utils/plural';
import CategoryRulesSheet from '@/components/settings/CategoryRulesSheet';
import { useCategoryRulesStore } from '@/store/categoryRulesStore';
import { exportBackupFile, pickBackupFile, getLocalBackupInfo, folderLabel, type PickedBackup } from '@/services/localBackup';
import { applyEntries } from '@/services/cloudBackup';
import type { BackupSummary } from '@/utils/backupSnapshot';
import { logError } from '@/services/errorLog';
import { useErrorLog } from '@/services/errorLog';
import { entryTime } from '@/utils/errorLog';
import ErrorLogSheet from '@/components/settings/ErrorLogSheet';
import { useAppUpdateStore, checkForAppUpdate, applyOtaUpdate, runningUpdateLabel, runtimeShort } from '@/services/appUpdate';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, BackHandler, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import {
  ChevronLeft, ChevronRight, Search, X,
  Info, Stethoscope, Clock, Bell, Copy,
  LogIn, LogOut, User as UserIcon, Database, CalendarDays, AlertTriangle, Rocket,
  Landmark, Zap, Vibrate, ShieldCheck, History, Watch, Download,
  CloudUpload, CloudDownload, LayoutGrid,
  Tags, PenLine, Eraser,
} from 'lucide-react-native';
import { Smartphone as SmartphoneIcon, RefreshCw } from 'lucide-react-native';
import { useScreenTimeStore } from '@/store/screenTimeStore';
import { useBackgroundStore, BG_LABEL, BG_ORDER, type BgInterval } from '@/store/backgroundStore';
import { useAnimStore, ANIM_LABEL, ANIM_ORDER, type AnimMode } from '@/store/animStore';
import { screenTimeAvailable, openScreenAccess } from '@/services/screenTime';
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
import { isHapticsEnabled, setHapticsEnabled, haptic, getHapticStrength, setHapticStrength, HAPTIC_STRENGTH_LABEL, type HapticStrength } from '@/utils/haptics';
import { usePenStore } from '@/store/penStore';
import { useMoodReminderStore } from '@/store/moodReminderStore';
import { openPicker } from '@/services/picker';
import Toggle from '@/components/design/Toggle';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import WidgetAppearanceSheet from '@/components/settings/WidgetAppearanceSheet';
import CategoriesSheet from '@/components/settings/CategoriesSheet';
import { useWidgetSettingsStore, type WidgetLook, type WidgetId } from '@/store/widgetSettingsStore';
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
  hapticStrength: HapticStrength,
  health: { connected: boolean; lastSyncedAt: string | null },
  backup: { auto: boolean; lastAt: string | null; busy: boolean; error: string | null; fileDir: string | null; fileLastAt: string | null },
  widget: { tasks: WidgetLook; weather: WidgetLook; note: WidgetLook },
  sync: string,
  update: string,
  errors: string,
  rulesCount: number,
  appStatus: string,
  thresholds: string,
  pwa: string | null,
  profile: string,
  pen: { fingerScroll: boolean; buttonEraser: boolean; stylusSeen: boolean },
  moodRem: { enabled: boolean; hour: number; minute: number },
  screenAccess: boolean | null,
  bg: { interval: BgInterval; lastRun: number },
  anim: AnimMode,
): SettingsSection[] {
  return [
  // Zakładki (2026-11-17, user: "popraw ustawienia, zrób lepsze zakładki — czemu w
  // diagnostyce jest aktualizacja aplikacji; dodaj profil: imię, data urodzenia"):
  // Profil i konto → Połączenia → Finanse → Dane → Powiadomienia → Widgety → Wygląd i
  // działanie → Aplikacja (wersja, aktualizacje) | zaawansowane: Diagnostyka (testy, logi).
  {
    id: 'konto', title: 'Profil i konto', icon: UserIcon, group: 'main',
    summary: profile || email || 'niezalogowany',
    items: [
      { kind: 'action', key: 'profile-edit', label: 'Profil', description: profile || 'imię, data urodzenia, wzrost', icon: UserIcon },
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
      // Czas z telefonem (2026-11-22): kafel na Dashboardzie potrzebuje systemowego dostępu.
      ...(Platform.OS === 'android' ? [{
        kind: 'action' as const, key: 'usage-access', label: 'Dostęp do danych o użyciu', permission: true,
        description: !screenTimeAvailable() ? 'wymaga nowego APK — czas w appkach i odblokowania na Dashboardzie'
          : screenAccess ? 'włączony — czas z telefonem liczy się na Dashboardzie' : 'ekran systemowy — włącz SOEN, żeby liczyć czas w appkach i odblokowania',
        icon: SmartphoneIcon,
      }] : []),
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
      // Kategorie (2026-11-14): nazwy, kolory, nowe, usuwanie z przeniesieniem użyć.
      { kind: 'action', key: 'categories', label: 'Kategorie wydatków', description: 'jedzenie, stałe i zmienne: nazwy, kolory, nowe, usuwanie', icon: Tags },
      { kind: 'action', tier: 'sub', key: 'category-rules', label: 'Reguły kategorii', description: rulesCount ? `${rulesCount} ${plural(rulesCount, 'reguła', 'reguły', 'reguł')} · sklep albo pozycja zawiera… → kategoria` : 'np. „apteka” → Zdrowie i leki, „kabel” → Elektronika', icon: Tags },
      {
        kind: 'switch', key: 'bank-enabled', label: 'Powiadomienia z banku',
        description: 'łap płatności kartą/przelewy z Pekao i PKO automatycznie',
        icon: Landmark, value: bank.enabled,
      },
      // `tier: 'sub'` (2026-11-01, user: "nie rozróżniam nazwy kategorii od
      // podkategorii") — te 4 wiersze istnieją/mają sens TYLKO gdy wyłącznik wyżej
      // jest włączony, więc wizualnie są wcięte/zmniejszone pod nim, nie na równi.
      ...(bank.enabled ? [
        { kind: 'action' as const, tier: 'sub' as const, permission: true, key: 'bank-notif-access', label: 'Dostęp do powiadomień', description: 'ekran systemowy — przyznaj SOEN RAZ, inaczej nasłuch nic nie złapie', icon: Bell },
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
      // Kopia do pliku (2026-11-14) — bez konta i internetu; co tydzień sama do folderu.
      {
        kind: 'action', key: 'file-export', label: 'Kopia do pliku',
        description: Platform.OS === 'web' ? 'pobierz wszystkie dane jako plik JSON'
          : backup.fileDir ? `${folderLabel(backup.fileDir)} · co tydzień sama, 4 ostatnie${backup.fileLastAt ? ` · ostatnia ${fmtBackupDate(backup.fileLastAt)}` : ''}`
          : 'wybierz folder (np. Download) — potem co tydzień automatycznie',
        icon: Download,
      },
      ...(backup.fileDir && Platform.OS !== 'web' ? [{ kind: 'action' as const, tier: 'sub' as const, key: 'file-folder', label: 'Zmień folder kopii', description: 'zapisz kopię teraz w innym folderze', icon: Download }] : []),
      { kind: 'action', tier: 'sub', key: 'file-import', label: 'Wczytaj kopię z pliku', description: 'plik sapp2-kopia-….json — najpierw pokaże, co w nim jest', icon: CloudDownload },
      // Synchronizacja na żywo między urządzeniami (2026-11-13, services/cloudSync.ts).
      { kind: 'value', key: 'sync-status', label: 'Synchronizacja urządzeń', description: 'zadania, kalendarz, humor, wydatki, opłaty, wymiany, pojazdy, praca, sen i kroki — telefon i komputer', icon: CloudUpload, value: sync },
    ],
  },
  // Faza 3.13 (2026-11-02, user: "podziel ustawienia na kategorie porozmieszczaj to
  // żeby było czytelniej" + "popraw nasze alerty podziel je na kategorie") —
  // Alerty/Ogólne/Diagnostyka przeniesione NA KONIEC (po Finansach), żeby góra ekranu
  // (Konto/Połączenia/Finanse) niosła rzeczy których user faktycznie używa co dzień,
  // a testy/diagnostyka/build-info (rzadko potrzebne) nie zajmowały pierwszego ekranu.
  {
    id: 'alerty', title: 'Powiadomienia', icon: Bell, group: 'main',
    summary: `${thresholds} · testy`,
    items: [
      // Od 2026-11-17 jeden wpis → osobny ekran testów (app/notify-test.tsx): 5 testów
      // w kolorach, po JEDNYM powiadomieniu (stare odpalały się podwójnie), zgody na górze.
      { kind: 'action', key: 'thresholds', label: 'Progi i przypomnienia', description: thresholds, icon: Clock },
      // Wieczorne przypomnienie o humorze (2026-11-18) — tylko w dni bez wpisu, z przyciskami
      // Słabo / OK / Dobrze zapisującymi humor bez otwierania appki.
      { kind: 'switch', key: 'mood-reminder', label: 'Przypomnienie o humorze', description: 'wieczorem, tylko gdy dziś nic nie wpisano', icon: Bell, value: moodRem.enabled },
      ...(moodRem.enabled ? [{ kind: 'action' as const, key: 'mood-reminder-time', label: 'Godzina przypomnienia', description: `${String(moodRem.hour).padStart(2, '0')}:${String(moodRem.minute).padStart(2, '0')} · stuknij, żeby zmienić`, icon: Clock }] : []),
      { kind: 'action', key: 'notify-test', label: 'Testy powiadomień', description: 'zwykłe, TAK/NIE, pełny ekran, wybudzenie + zgody systemowe', icon: Bell },
    ],
  },
  // Widget pulpitu "Zadania" (2026-11-13, user: "ma ustawienia przezroczystości?").
  {
    id: 'widget', title: 'Widgety na pulpit', icon: LayoutGrid, group: 'main',
    summary: `Zadania, Pogoda, Notatka · tło ${lookLabel(widget.tasks)}`,
    // Osobno (2026-11-14, user: "rozdzielić ustawienia widgetów").
    items: [
      { kind: 'action', key: 'widget-tasks', label: 'Widget Zadania', description: `tło ${lookLabel(widget.tasks)} · tekst ${scaleLabel(widget.tasks.textScale)}`, icon: LayoutGrid },
      { kind: 'action', key: 'widget-weather', label: 'Widget Pogoda', description: `tło ${lookLabel(widget.weather)} · tekst ${scaleLabel(widget.weather.textScale)}`, icon: LayoutGrid },
      { kind: 'action', key: 'widget-note', label: 'Widget Notatka', description: `przypięta notatka · tło ${lookLabel(widget.note)} · tekst ${scaleLabel(widget.note.textScale)}`, icon: LayoutGrid },
    ],
  },
  {
    id: 'ogolne', title: 'Wygląd i działanie', icon: Vibrate, group: 'main',
    summary: `wibracje ${hapticsEnabled ? HAPTIC_STRENGTH_LABEL[hapticStrength] : 'wyłączone'} · układ Dashboardu`,
    items: [
      { kind: 'switch', key: 'haptics-enabled', label: 'Wibracje', description: 'kliknięcie przy tapach w appce', icon: Vibrate, value: hapticsEnabled },
      ...(hapticsEnabled ? [{ kind: 'action' as const, key: 'haptics-strength', label: 'Siła wibracji', description: `${HAPTIC_STRENGTH_LABEL[hapticStrength]} · stuknij, żeby zmienić`, icon: Vibrate }] : []),
      { kind: 'action', key: 'dash-layout', label: 'Układ Dashboardu', description: 'kolejność rzędów i ukrywanie', icon: LayoutGrid },
    ],
  },
  // Notatki i S-Pen (2026-11-18) — store/penStore.ts, lokalnie na tym urządzeniu.
  {
    id: 'notatki', title: 'Notatki i S-Pen', icon: PenLine, group: 'main',
    summary: `${pen.fingerScroll ? 'palec przewija' : 'palec rysuje'} · przycisk ${pen.buttonEraser ? '= gumka' : 'wyłączony'}`,
    items: [
      { kind: 'switch', key: 'pen-finger-scroll', label: 'Palcem przewijam, S-Penem rysuję', description: pen.stylusSeen ? 'S-Pen wykryty — palec przesuwa stronę, rysuje tylko rysik' : 'zadziała, gdy appka pierwszy raz wykryje S-Pen', icon: PenLine, value: pen.fingerScroll },
      { kind: 'switch', key: 'pen-button-eraser', label: 'Przycisk S-Pena = gumka', description: 'trzymaj przycisk na rysiku i przeciągnij po kresce', icon: Eraser, value: pen.buttonEraser },
    ],
  },
  {
    id: 'aplikacja', title: 'Aplikacja', icon: Rocket, group: 'main',
    summary: `wersja ${BUILD_INFO.version} · ${update}`,
    items: [
      { kind: 'action', key: 'update-check', label: 'Sprawdź aktualizacje', description: update, icon: Download },
      { kind: 'value', key: 'info-version', label: 'Wersja', description: `build ${BUILD_INFO.buildNumber} · ${BUILD_INFO.buildDate}`, icon: Info, value: BUILD_INFO.version },
      { kind: 'value', key: 'info-ota', label: 'Paczka JS', description: `runtime ${runtimeShort()} — OTA musi mieć ten sam`, icon: Info, value: runningUpdateLabel() },
      { kind: 'action', key: 'app-health', label: 'Stan appki', description: appStatus, icon: Stethoscope },
      // Odświeżanie w tle (2026-11-22, user: "w ustawieniach: co 15 min, co 1 h, co 3 h, nigdy").
      ...(Platform.OS === 'android' ? [{
        kind: 'action' as const, key: 'bg-refresh', label: 'Odświeżanie w tle', icon: RefreshCw,
        description: `${BG_LABEL[bg.interval]} · stuknij, żeby zmienić${bg.lastRun ? ` · ostatnio ${new Date(bg.lastRun).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''} — czas z telefonem, zegarek, komputer bez otwierania appki`,
      }] : []),
      // Animacje kafli (2026-11-24) — pogoda i pieniądze; "według systemu" słucha "ogranicz ruch".
      { kind: 'action' as const, key: 'anim-mode', label: 'Animacje kafli', icon: Rocket,
        description: `${ANIM_LABEL[anim]} · stuknij, żeby zmienić — pogoda i pieniądze w Saldzie` },
      // Tylko na komputerze (services/pwaInstall.ts).
      ...(pwa ? [{ kind: 'action' as const, key: 'pwa-install', label: 'Zainstaluj na komputerze', description: pwa, icon: Download }] : []),
    ],
  },
  // "Diagnostyka" + stara "Info" złączone w jedną sekcję (2026-11-02) — build-info
  // (wersja/build/data/commit, `value` itemy) to też diagnostyka ("czy to najnowszy
  // build"), osobna sekcja dla czterech statycznych wierszy była przerostem.
  {
    id: 'diagnostyka', title: 'Diagnostyka', icon: Stethoscope, group: 'advanced',
    summary: `${errors} · testy połączeń`,
    items: [
      { kind: 'action', key: 'error-log', label: 'Dziennik błędów', description: errors, icon: AlertTriangle },
      { kind: 'value', key: 'info-commit', label: 'Commit', description: 'z którego zbudowano ten APK', icon: Copy, value: BUILD_INFO.commit },
      // Testy logowania Google z Androida — na komputerze nie mają sensu (inne logowanie).
      ...(Platform.OS === 'web' ? [] : [{ kind: 'action' as const, tier: 'sub' as const, key: 'google', label: 'Zaloguj przez Google (test)', description: 'sprawdź czy Google Sign-In działa', icon: LogIn }]),
      { kind: 'action', tier: 'sub', key: 'firestore', label: 'Firestore (test)', description: 'zapis/odczyt testowego dokumentu', icon: Database },
      { kind: 'action', tier: 'sub', key: 'calendar', label: Platform.OS === 'web' ? 'Kalendarz z telefonu' : 'Kalendarz Google (test)', description: Platform.OS === 'web' ? 'ile wydarzeń przyszło z telefonu' : 'odczyt nadchodzących wydarzeń', icon: CalendarDays },
      ...(Platform.OS === 'web' ? [] : [{ kind: 'action' as const, tier: 'sub' as const, key: 'calendar-sync', label: 'Sync kalendarza (test)', description: 'round-trip dodaj/zmień/usuń, Firestore + Google', icon: CalendarDays }]),
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

const lookLabel = (l: WidgetLook) => (l.bgOpacity === 0 ? 'przezroczyste' : `${l.bgOpacity}%`);
const scaleLabel = (t: string) => (t === 'small' ? 'mały' : t === 'large' ? 'duży' : 'średni');

function describeSummary(meta: { summary: BackupSummary }): string {
  const x = meta.summary;
  return `${nWydatkow(x.expenses)}, ${x.mood} ${plural(x.mood, 'wpis', 'wpisy', 'wpisów')} humoru, ${x.tasks} ${plural(x.tasks, 'zadanie', 'zadania', 'zadań')}, ${x.subscriptions} ${plural(x.subscriptions, 'stała opłata', 'stałe opłaty', 'stałych opłat')}, ${x.vehicles} ${plural(x.vehicles, 'pojazd', 'pojazdy', 'pojazdów')}`;
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
  const [hapticStrength, setHapticStrengthState] = useState<HapticStrength>(getHapticStrength());
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
  const [fileInfo, setFileInfo] = useState<{ dir: string | null; lastAt: string | null }>({ dir: null, lastAt: null });
  const [filePick, setFilePick] = useState<PickedBackup | null>(null);
  useEffect(() => {
    getLocalBackupInfo().then(setFileInfo).catch(() => {});
    isAutoBackupEnabled().then(setBackupAuto).catch(() => {});
    getLastBackupAt().then(setBackupLastAt).catch(() => {});
  }, []);
  const syncState = useSyncStatus((st) => st.state);
  const syncLastAt = useSyncStatus((st) => st.lastAt);
  const syncError = useSyncStatus((st) => st.error);
  const syncLabel = syncState === 'ok'
    ? `działa${syncLastAt ? ` · ${new Date(syncLastAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}` : ''}`
    : syncState === 'connecting' ? 'łączę…' : syncState === 'error' ? `błąd: ${(syncError ?? '').slice(0, 40)}` : 'wyłączona';
  const widgetTasks = useWidgetSettingsStore((st) => st.tasks);
  const widgetWeather = useWidgetSettingsStore((st) => st.weather);
  const widgetNote = useWidgetSettingsStore((st) => st.note);
  const [widgetOpen, setWidgetOpen] = useState<WidgetId | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const rulesCount = useCategoryRulesStore((st) => st.rules.length);
  const upd = useAppUpdateStore();
  const errEntries = useErrorLog((x) => x.entries);
  const [healthOpen, setHealthOpen] = useState(false);
  // Powiadomienie strażnika → /settings?health=1 = od razu Stan appki (2026-11-25).
  const { health: healthParam } = useLocalSearchParams<{ health?: string }>();
  useEffect(() => { if (healthParam === '1') { setHealthOpen(true); router.setParams({ health: undefined } as any); } }, [healthParam]);
  const [storage, setStorage] = useState<{ total: number; biggest: { key: string; size: number }[] } | undefined>(undefined);
  useEffect(() => { if (healthOpen) storageUsage().then(setStorage).catch(() => {}); }, [healthOpen]);
  const bankHistory = useBankQueue((st) => st.history);
  const bgIntervalH = useBackgroundStore((st) => st.interval);
  const bgLastRunH = useBackgroundStore((st) => st.lastRun);
  const [thresholdsOpen, setThresholdsOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const th = useThresholdsStore((st) => st.t);
  const pwaState = usePwaInstall();
  const pwaLabel = pwaInstallLabel(pwaState);
  const thresholdsText = `paliwo od ${th.fuelMin} zł · budżet ${th.budgetWarnPct}% · przypomnienia ${th.reminderHour}:00`;
  const healthRows = useMemo(() => appHealth({
    sync: { state: syncState, lastAt: syncLastAt, error: syncError },
    cloudBackup: { auto: backupAuto, lastAt: backupLastAt },
    fileBackup: fileInfo,
    errorTimes: errEntries.map((e) => e.t),
    update: { otaReady: upd.otaReady, apkBuild: upd.apk?.build ?? null, lastError: upd.lastError },
    bankPending,
    web: Platform.OS === 'web',
    bank: { enabled: bankEnabled, times: bankHistory.map((h) => h.at) },
    background: { interval: bgIntervalH, lastRun: bgLastRunH },
    storage,
  }), [syncState, syncLastAt, syncError, backupAuto, backupLastAt, fileInfo, errEntries, upd.otaReady, upd.apk, upd.lastError, bankPending, bankEnabled, bankHistory, bgIntervalH, bgLastRunH, storage]);
  const healthText = healthSummary(healthRows);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const errorsLabel = errEntries.length === 0 ? 'pusto — nic się nie wywaliło'
    : `${errEntries.length} ${plural(errEntries.length, 'wpis', 'wpisy', 'wpisów')} · ostatni ${entryTime(errEntries[0].t)} — do skopiowania`;
  const updateLabel = upd.checking ? 'sprawdzam…'
    : upd.otaReady ? 'aktualizacja pobrana — stuknij, żeby uruchomić ponownie'
    : upd.apk ? `nowy APK #${upd.apk.build} — stuknij, żeby pobrać`
    : upd.lastError ? `błąd: ${upd.lastError.slice(0, 60)}`
    : upd.lastCheck ? `aktualna · sprawdzono ${new Date(upd.lastCheck).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`
    : 'OTA (szybka, sam JS) albo nowy APK z GitHuba';
  const updateCheck = () => {
    if (upd.otaReady) { applyOtaUpdate(); return; }
    if (upd.apk) { Linking.openURL(upd.apk.url).catch(() => {}); return; }
    checkForAppUpdate(true);
  };
  const prof = useProfileStore();
  const profAge = ageOn(prof.birthDate);
  const profileLabel = [prof.name, profAge != null ? `${profAge} lat` : null, prof.heightCm ? `${prof.heightCm} cm` : null].filter(Boolean).join(' · ');
  const [profileOpen, setProfileOpen] = useState(false);
  const penFinger = usePenStore((st) => st.fingerScroll);
  const penButton = usePenStore((st) => st.buttonEraser);
  const penSeen = usePenStore((st) => st.stylusSeen);
  const pen = useMemo(() => ({ fingerScroll: penFinger, buttonEraser: penButton, stylusSeen: penSeen }), [penFinger, penButton, penSeen]);
  const mrEnabled = useMoodReminderStore((st) => st.enabled);
  const mrHour = useMoodReminderStore((st) => st.hour);
  const mrMinute = useMoodReminderStore((st) => st.minute);
  const moodRem = useMemo(() => ({ enabled: mrEnabled, hour: mrHour, minute: mrMinute }), [mrEnabled, mrHour, mrMinute]);
  const screenAccess = useScreenTimeStore((st) => st.access);
  const bgInterval = useBackgroundStore((st) => st.interval);
  const bgLastRun = useBackgroundStore((st) => st.lastRun);
  const animMode = useAnimStore((st) => st.mode);
  const sections = useMemo(
    () => buildSections(
      user?.email ?? null,
      { enabled: bankEnabled, autoAll: bankAutoAll, pending: bankPending },
      hapticsEnabled,
      hapticStrength,
      { connected: healthConnected, lastSyncedAt: healthLastSyncedAt },
      { auto: backupAuto, lastAt: backupLastAt, busy: backupBusy, error: backupError, fileDir: fileInfo.dir, fileLastAt: fileInfo.lastAt },
      { tasks: widgetTasks, weather: widgetWeather, note: widgetNote },
      syncLabel,
      updateLabel,
      errorsLabel,
      rulesCount,
      healthText,
      thresholdsText,
      pwaLabel,
      profileLabel,
      pen,
      moodRem,
      screenAccess,
      { interval: bgInterval, lastRun: bgLastRun },
      animMode,
    ),
    [animMode, bgInterval, bgLastRun, screenAccess, moodRem, pen, profileLabel, pwaLabel, healthText, thresholdsText, rulesCount, updateLabel, errorsLabel, user?.email, bankEnabled, bankAutoAll, bankPending, hapticsEnabled, hapticStrength, healthConnected, healthLastSyncedAt, backupAuto, backupLastAt, backupBusy, backupError, fileInfo, widgetTasks, widgetWeather, widgetNote, syncLabel],
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
  const fileExport = async (chooseFolder: boolean) => {
    try {
      const r = await exportBackupFile(chooseFolder);
      if (!r) return;
      haptic.success();
      append(`Kopia zapisana: ${r.where}/${r.name} — ${describeSummary(r)}.`);
      getLocalBackupInfo().then(setFileInfo).catch(() => {});
    } catch (e: any) {
      logError('kopia do pliku', e);
      append(`Nie udało się zapisać kopii: ${String(e?.message ?? e)}`);
    }
  };
  const fileImport = async () => {
    try {
      const picked = await pickBackupFile();
      if (!picked) return;
      setRestoreError(null);
      setFilePick(picked);
    } catch (e: any) {
      append(`Nie udało się wczytać pliku: ${String(e?.message ?? e)}`);
    }
  };
  const confirmRestore = async () => {
    if (filePick) {
      setRestoring(true);
      try {
        await applyEntries(filePick.entries);
        append(`Wczytano kopię ${filePick.name}: ${describeSummary(filePick)}. Poprzednie dane zapisane w pliku sapp2-przed-przywroceniem.json.`);
        setFilePick(null);
      } catch (e: any) {
        setRestoreError(String(e?.message ?? e));
      } finally {
        setRestoring(false);
      }
      return;
    }
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
    // Komputer (2026-11-15): tu nie ma logowania Google z Androida — wydarzenia
    // przychodzą z telefonu przez synchronizację (utils/gcalMirror.ts).
    if (Platform.OS === 'web') {
      const n = useCalendarStore.getState().gcalEvents.length;
      append(n > 0
        ? `Kalendarz z telefonu: ${n} wydarzeń (od 45 dni wstecz do 180 dni w przód). Zmiany robisz na telefonie.`
        : 'Brak wydarzeń z telefonu — zainstaluj na telefonie APK #225 lub nowszy, otwórz SOEN na telefonie (pobierze kalendarz), potem odśwież tę stronę.');
      return;
    }
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

  // Faza 2.5 (2026-11-01) — przełączniki (enabled/autoAll) jako zwykłe 'action' itemy,
  // nie prawdziwy switch — settings.tsx nie ma typu/renderera dla kontrolki switch
  // (tylko 'action'/'value'), a dodawanie go dla jednego miejsca byłoby przerostem
  // formy nad treścią. Tap po prostu odwraca stan, opis w `buildSections` wyżej od razu
  // pokazuje nowy.
  // Lekka → średnia → mocna → lekka; od razu czuć nową siłę.
  const cycleHapticStrength = () => {
    const order: HapticStrength[] = ['light', 'medium', 'strong'];
    const next = order[(order.indexOf(hapticStrength) + 1) % order.length];
    setHapticStrength(next).catch(() => {});
    setHapticStrengthState(next);
    haptic.medium();
  };
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
          append('Nasłuch NIC nie odbiera (nawet z innych apek) — sprawdź "Dostęp do powiadomień" i baterię SOEN.');
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
    'notify-test': leave(() => router.push('/notify-test' as any)),
    'bank-enabled': toggleBankEnabled,
    'bank-notif-access': openNotificationAccess,
    'anim-mode': () => { haptic.tap(); const st = useAnimStore.getState(); st.setMode(ANIM_ORDER[(ANIM_ORDER.indexOf(st.mode) + 1) % ANIM_ORDER.length]); },
    'bg-refresh': () => { haptic.tap(); const st = useBackgroundStore.getState(); st.setInterval(BG_ORDER[(BG_ORDER.indexOf(st.interval) + 1) % BG_ORDER.length]); },
    'usage-access': () => { if (screenTimeAvailable()) openScreenAccess(); },
    'bank-auto-all': toggleBankAutoAll,
    'bank-test': testBankCapture,
    'bank-review': leave(() => router.push('/bank-review' as any)),
    'bank-history': leave(() => router.push('/bank-history' as any)),
    'import-sapp': leave(() => router.push('/import-sapp' as any)),
    'haptics-enabled': toggleHaptics,
    'mood-reminder': () => { haptic.tap(); useMoodReminderStore.getState().set({ enabled: !useMoodReminderStore.getState().enabled }); },
    'mood-reminder-time': () => {
      const st = useMoodReminderStore.getState();
      openPicker({
        value: new Date(2026, 0, 1, st.hour, st.minute), mode: 'time', title: 'Przypomnienie o humorze',
        onChange: (ev, d) => { if (ev.type === 'set' && d) useMoodReminderStore.getState().set({ hour: d.getHours(), minute: d.getMinutes() }); },
      });
    },
    'pen-finger-scroll': () => { haptic.tap(); usePenStore.getState().set({ fingerScroll: !usePenStore.getState().fingerScroll }); },
    'pen-button-eraser': () => { haptic.tap(); usePenStore.getState().set({ buttonEraser: !usePenStore.getState().buttonEraser }); },
    'haptics-strength': cycleHapticStrength,
    'backup-auto': toggleBackupAuto,
    'backup-now': backupNow,
    'backup-restore': openRestore,
    'file-export': () => fileExport(false),
    'file-folder': () => fileExport(true),
    'file-import': fileImport,
    'widget-tasks': leave(() => setWidgetOpen('tasks')),
    'widget-weather': leave(() => setWidgetOpen('weather')),
    'widget-note': leave(() => setWidgetOpen('note')),
    categories: leave(() => setCategoriesOpen(true)),
    'category-rules': leave(() => setRulesOpen(true)),
    'update-check': updateCheck,
    'app-health': leave(() => setHealthOpen(true)),
    thresholds: leave(() => setThresholdsOpen(true)),
    'dash-layout': leave(() => setLayoutOpen(true)),
    'profile-edit': leave(() => setProfileOpen(true)),
    'pwa-install': () => { if (pwaState.canInstall) promptPwaInstall().catch(() => {}); },
    'error-log': leave(() => setErrorsOpen(true)),
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
    goBack();
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
      <AppBottomSheet visible={!!restoreMeta || !!filePick} onClose={() => { if (!restoring) { setRestoreMeta(null); setFilePick(null); } }} scrollable={false}>
        {(restoreMeta || filePick) && (
          <View style={s.restoreBody}>
            <Text style={s.restoreTitle}>{filePick ? 'Wczytać kopię z pliku?' : 'Przywrócić kopię?'}</Text>
            <Text style={s.restoreText}>{filePick
              ? `${filePick.name}${filePick.createdAt ? ` (${fmtBackupDate(filePick.createdAt)})` : ''}: ${describeSummary(filePick)}.`
              : `Kopia z ${fmtBackupDate(restoreMeta!.createdAt)}: ${describeSummary(restoreMeta!)}.`}</Text>
            <Text style={s.restoreText}>Zastąpi dane na tym telefonie. Obecne dane zostaną zapisane w pliku sapp2-przed-przywroceniem.json, na wszelki wypadek.</Text>
            {restoreError && <Text style={s.restoreError}>Nie udało się: {restoreError}</Text>}
            <View style={s.restoreActions}>
              <TouchableOpacity style={s.restoreCancel} onPress={() => { setRestoreMeta(null); setFilePick(null); }} disabled={restoring} activeOpacity={0.7}>
                <Text style={s.restoreCancelLabel}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.restoreConfirm, restoring && { opacity: 0.5 }]} onPress={confirmRestore} disabled={restoring} activeOpacity={0.7}>
                <Text style={s.restoreConfirmLabel}>{restoring ? 'Przywracam…' : 'Przywróć'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </AppBottomSheet>
      <WidgetAppearanceSheet visible={!!widgetOpen} widget={widgetOpen ?? 'tasks'} onClose={() => setWidgetOpen(null)} />
      <CategoriesSheet visible={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      <CategoryRulesSheet visible={rulesOpen} onClose={() => setRulesOpen(false)} />
      <AppHealthSheet visible={healthOpen} onClose={() => setHealthOpen(false)} rows={healthRows} />
      <ThresholdsSheet visible={thresholdsOpen} onClose={() => setThresholdsOpen(false)} />
      <ProfileSheet visible={profileOpen} onClose={() => setProfileOpen(false)} />
      <DashboardLayoutSheet visible={layoutOpen} onClose={() => setLayoutOpen(false)} />
      <ErrorLogSheet visible={errorsOpen} onClose={() => setErrorsOpen(false)} header={`SOEN ${BUILD_INFO.version} · build ${BUILD_INFO.buildNumber} · ${BUILD_INFO.commit} · ${runningUpdateLabel()}`} />
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
