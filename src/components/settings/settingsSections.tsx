import { plural, nWydatkow } from '@/utils/plural';
import { folderLabel } from '@/services/localBackup';
import type { BackupSummary } from '@/utils/backupSnapshot';
import { runningUpdateLabel, runtimeShort } from '@/services/appUpdate';
import type { ComponentType } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  Info,
  Stethoscope,
  Clock,
  Bell,
  Copy,
  LogIn,
  LogOut,
  User as UserIcon,
  Database,
  CalendarDays,
  AlertTriangle,
  Rocket,
  Landmark,
  Zap,
  Vibrate,
  History,
  Watch,
  Download,
  CloudUpload,
  CloudDownload,
  LayoutGrid,
  Tags,
  PenLine,
  Eraser,
} from 'lucide-react-native';
import { Smartphone as SmartphoneIcon, RefreshCw } from 'lucide-react-native';
import { BG_LABEL, type BgInterval } from '@/store/backgroundStore';
import { ANIM_LABEL, type AnimMode } from '@/store/animStore';
import { screenTimeAvailable } from '@/services/screenTime';
import { colors } from '@/theme/colors';
import { useAuthUser } from '@/hooks/useAuthUser';
import { HAPTIC_STRENGTH_LABEL, type HapticStrength } from '@/utils/haptics';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { type WidgetLook } from '@/store/widgetSettingsStore';

// Wydzielone z app/settings.tsx (2026-11-25, porządki w kodzie — bez zmian działania): typy
// wierszy, metadane buildu, lista sekcji (`buildSections`) i drobne formatowania.

// Build metadata wstrzyknięty przez CI (`.github/workflows/build.yml`, krok "Build
// release APK") jako EXPO_PUBLIC_* — Expo inline'uje te zmienne w bundlu JS na etapie
// budowania. W Expo Go / dev (gdzie tych zmiennych nikt nie ustawia) spadamy na "dev"
// — to NORMALNE, nie błąd. Dodane po tym jak user kilka razy z rzędu nie mógł
// stwierdzić czy zainstalowany APK faktycznie jest najnowszym buildem (2026-10-27).
export const BUILD_INFO = {
  version: Constants.expoConfig?.version ?? '?',
  buildNumber: process.env.EXPO_PUBLIC_BUILD_NUMBER ?? 'dev',
  buildDate: process.env.EXPO_PUBLIC_BUILD_DATE ?? 'dev',
  commit: process.env.EXPO_PUBLIC_BUILD_COMMIT ?? 'dev',
};

export type Icon = ComponentType<{ size?: number; color?: string }>;

// `tier: 'sub'` (2026-11-01, user: "nie rozróżniam nazwy kategorii od podkategorii")
// — wcina/zmniejsza wiersz, żeby było widać że zależy od rodzica nad nim (np.
// przełączniki widoczne TYLKO gdy "Powiadomienia z banku" jest włączone). `permission`
// oznacza wiersz prowadzący do ekranu zgody systemowej (nie zwykłe ustawienie appki) —
// odznaka "Zgoda" + ikona tarczy, żeby user widział od razu co to za rodzaj akcji.
export type SettingsItem =
  | { kind: 'action'; key: string; label: string; description: string; icon: Icon; tier?: 'sub'; permission?: boolean }
  | { kind: 'value'; key: string; label: string; description: string; icon: Icon; value: string; tier?: 'sub' }
  | { kind: 'switch'; key: string; label: string; description: string; icon: Icon; value: boolean; tier?: 'sub' };

// `icon`/`summary`/`group` (2026-11-11, user: "ustawienia ogarnij lepiej żeby były
// posegregowane i domyślnie zwinięte... albo jak inne od dołu wysuwane, bo teraz
// rozwija lista długa") — główny ekran pokazuje TYLKO kategorie (ikona + jedna
// linijka stanu), zawartość wysuwa się od dołu w `AppBottomSheet`, jak reszta appki.
export type SettingsSection = {
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
export function buildSections(
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
export function fmtBackupDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
}

// Komunikaty z Firebase/requireUid są po angielsku — user widzi je wprost w wierszu.
export function backupErrorText(e: any): string {
  const msg = String(e?.message ?? e);
  if (msg.includes('Not authenticated')) return 'brak zalogowania — wyloguj i zaloguj się ponownie';
  if (msg.toLowerCase().includes('permission')) return 'brak uprawnień do zapisu w Firestore (reguły bazy)';
  return msg;
}

export const lookLabel = (l: WidgetLook) => (l.bgOpacity === 0 ? 'przezroczyste' : `${l.bgOpacity}%`);
export const scaleLabel = (t: string) => (t === 'small' ? 'mały' : t === 'large' ? 'duży' : 'średni');

export function describeSummary(meta: { summary: BackupSummary }): string {
  const x = meta.summary;
  return `${nWydatkow(x.expenses)}, ${x.mood} ${plural(x.mood, 'wpis', 'wpisy', 'wpisów')} humoru, ${x.tasks} ${plural(x.tasks, 'zadanie', 'zadania', 'zadań')}, ${x.subscriptions} ${plural(x.subscriptions, 'stała opłata', 'stałe opłaty', 'stałych opłat')}, ${x.vehicles} ${plural(x.vehicles, 'pojazd', 'pojazdy', 'pojazdów')}`;
}

