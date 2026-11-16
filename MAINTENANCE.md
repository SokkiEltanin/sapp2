# MAINTENANCE.md — jak utrzymać sapp2 bez autora

Instrukcja dla każdego, kto przejmuje appkę (człowiek albo inny asystent AI).
Zasady pisania kodu: [`CLAUDE.md`](./CLAUDE.md). Mapa ekranów i modułów:
[`ARCHITECTURE.md`](./ARCHITECTURE.md). Otwarte zadania: [`NEXT_STEPS.md`](./NEXT_STEPS.md).
Konsole Google/Firebase, klucze, keystore: [`INFRA.md`](./INFRA.md).

## 1. Co to jest

Expo SDK 54 · React Native 0.81 (New Architecture) · expo-router · Zustand + AsyncStorage
(dane lokalnie, local-first) · Firestore (synchronizacja i kopia) · TypeScript.
Android: `com.sokki.sapp2`. Wersja na komputer: ta sama appka jako strona (PWA).

## 2. Uruchomienie lokalnie

```bash
npm ci
cp .env.example .env          # wpisz EXPO_PUBLIC_FIREBASE_API_KEY (INFRA.md)
npx expo start --web          # najszybszy podgląd w przeglądarce
npx tsc --noEmit && npx jest  # zawsze przed pushem
```

Na telefonie natywne moduły (widgety, powiadomienia z banku, Health Connect) działają
tylko w APK — Expo Go ich nie ma.

## 3. Wydanie nowej wersji

Każdy push na `main` uruchamia `.github/workflows/build.yml`:

| Co się zmieniło | Co robi CI | Czas | Na telefonie |
|---|---|---|---|
| Tylko kod JS/TS (ekrany, logika, style) | **OTA** (`eas update`, kanał `production`) | ~3 min | banner „Aktualizacja gotowa · Uruchom ponownie” |
| Natywne: `app.json` (uprawnienia, pluginy, ikona), `plugins/*.js`, nowa paczka z kodem natywnym | **APK** → GitHub Releases `build-N` | ~20 min | banner „Nowy APK #N · Pobierz” |

Decyzję podejmuje job `decide`: liczy *fingerprint* natywnej części (`npx expo-updates
fingerprint:generate`) i porównuje z linią `Fingerprint:` w opisie ostatniego release.
Ręczne „Run workflow” (Actions → Build APK) zawsze robi APK.

**Warunek OTA:** sekret repo `EXPO_TOKEN` (expo.dev → konto właściciela projektu EAS
`b56c7c9e-…` → Account settings → Access tokens → Create; GitHub → repo → Settings →
Secrets and variables → Actions → New secret). Bez niego każdy push robi APK — nic się
nie psuje, tylko wolniej.

Wycofanie złej aktualizacji: OTA — `npx eas-cli update:rollback` albo `git revert` +
push (nowa OTA). APK — zainstaluj poprzedni plik z Releases (dane zostają, ten sam podpis).

### Sekrety repo (Settings → Secrets → Actions)

| Nazwa | Do czego |
|---|---|
| `KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD` | podpis APK (zgubienie = nowy APK nie zainstaluje się na stary, trzeba odinstalować) |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase w APK, OTA i web |
| `EXPO_TOKEN` | publikacja OTA |

## 4. Wersja na komputer

`.github/workflows/web.yml` → GitHub Pages (`https://sokkieltanin.github.io/sapp2/`).
Wymaga raz: repo Settings → Pages → Source = GitHub Actions; Firebase Console →
Authentication → Settings → Authorized domains → `sokkieltanin.github.io`.

## 5. Dane, synchronizacja, kopie

- Każdy store = Zustand + `persist` (AsyncStorage, klucz `nazwa-v1`).
- Synchronizacja telefon ↔ komputer: `src/services/cloudSync.ts`. Listy (`listBinding`)
  → kolekcja `users/{uid}/sync_*`, pojedyncze obiekty (`docBindings`) → dokument.
  Przyrostowo (skróty elementów + czas serwera), pierwszy raz pełne scalenie (nowsza
  zmiana wygrywa). Usunięcie elementu z listy = znacznik `_deleted` w chmurze.
- Kopia w chmurze: `services/cloudBackup.ts` — cały AsyncStorage (bez `sync-*` i sesji).
- Przywracanie: Ustawienia → Dane → „Przywróć z kopii”.
- Kopia do pliku (bez konta/internetu): Ustawienia → Dane → „Kopia do pliku” — wybór
  folderu (np. Download), potem co 7 dni sama, zostają 4 ostatnie
  (`services/localBackup.ts`). „Wczytaj kopię z pliku” pokazuje zawartość przed zapisem.
  Przed każdym przywróceniem bieżące dane idą do `sapp2-przed-przywroceniem.json`.

## 6. Jak dodać…

**Ekran** — plik w `app/` (np. `app/plants.tsx`), wejście z istniejącego ekranu
(`router.push('/plants')`), wpis w ARCHITECTURE.md. Style tylko
`themedStyles((c) => StyleSheet.create(...))` (CLAUDE.md zasada 1).

**Dane (store)** — `src/types/x.ts` + `src/store/xStore.ts` (wzór: `notesStore.ts`:
`persist`, elementy z `id` i `updatedAt` ustawianym przy każdej zmianie). Synchronizacja: jedna linia `listBinding('sync_x', S(useXStore), 'items')`
w `cloudSync.ts`. Kopia działa automatycznie. Logika liczenia → `src/utils/x.ts` + test
w `__tests__/x.test.ts`.

**Kafel na Dashboardzie** — pole w typie `DashData` + kafel w `src/ui/DashboardScreen.tsx`
(komponent nie wie, skąd dane), wartości liczy i podaje `app/(tabs)/index.tsx`.

**Kategoria wydatków** — bez kodu: Ustawienia → Finanse → Kategorie wydatków (i Reguły kategorii: „sklep zawiera X → Y”).
Domyślne listy: `utils/food.ts`, `utils/nonFood.ts`, `utils/fixedCategory.ts`.

**Uprawnienie Androida / widget / moduł natywny** — `app.json` + `plugins/*.js`
(CLAUDE.md zasada 2: lista uprawnień ZASTĘPUJE domyślną). Wchodzi tylko nowym APK —
CI sam to rozpozna.

## 7. Gdy coś nie działa

1. Ustawienia → Diagnostyka → **Stan appki** (co nie działa i co zrobić), potem wersja, build, „Paczka JS” (APK czy OTA), testy
   Google/Firestore/kalendarza, „Sprawdź aktualizacje”.
2. GitHub → Actions: czerwony job = log z błędem (najczęściej `tsc`/test albo Gradle).
3. Bank „nie łapie” → najpierw test parsera na dokładnym tekście powiadomienia
   (CLAUDE.md zasada 5).
4. Appka nie startuje po OTA → expo-updates sam wraca do poprzedniej paczki; zrób
   `git revert` złego commita i push.

## 8. Zegarek (Wear OS)

Osobna mała aplikacja w `wear/` (Kotlin, bez React Native). Telefon wysyła jej dane przez
Wear Data Layer (`plugins/withWearSync.js`, treść `src/utils/wearSnapshot.ts`), od 2026-11-16
BEZ wydatków: zadania (stuknięcie = rozwiń kroki, krok stuknięciem → `/sapp2/step`, całe
zadanie tylko PRZYTRZYMANIEM → `/sapp2/toggle`; telefon stosuje przy otwarciu appki,
`widgetToggleDrain.ts`), kalendarz/praca dziś i jutro, bateria → telefon. Bezel przewija.
Kafelek (przesunięcie tarczy): liczba zadań + 2 pierwsze + najbliższe wydarzenie — dodaj go długim
przytrzymaniem tarczy → Kafelki → Sapp2. Dane przychodzą w tle (DataListenerService).

- **Build:** `.github/workflows/wear.yml` (zmiana w `wear/` albo ręcznie: Actions → Build
  Wear OS → Run workflow) → Releases „Wear #N (zegarek)” (prerelease), plik `sapp2-wear-N.apk`.
- **Warunek:** ten sam `applicationId` (`com.sokki.sapp2`) i ten sam klucz podpisu co telefon
  — inaczej telefon i zegarek się „nie widzą”. Telefon musi mieć APK z `withWearSync`.
- **Instalacja na Galaxy Watch** (jednorazowo włącz na zegarku: Ustawienia → Informacje o
  zegarku → Oprogramowanie → 7× „Wersja oprogramowania” = tryb programisty; potem Opcje
  programisty → Debugowanie ADB + Debugowanie przez Wi-Fi, zegarek i telefon/komputer w tej
  samej sieci Wi-Fi):
  - z telefonu: aplikacja typu „Wear Installer” / „Easy Fire Tools” — wpisz adres IP zegarka
    z Opcji programisty, wskaż pobrany `sapp2-wear-N.apk`;
  - albo z komputera (cmd, bez instalowania niczego): pobierz ADB
    `curl -L -o pt.zip https://dl.google.com/android/repository/platform-tools-latest-windows.zip`
    → `tar -xf pt.zip` → `cd platform-tools`; zegarek: Debugowanie bezprzewodowe → Sparuj nowe
    urządzenie → `adb pair IP:PORT_PAROWANIA KOD` (raz); potem `adb connect IP:PORT` (port z ekranu
    Debugowania, zmienia się) → `adb -s IP:PORT install -r sapp2-wear-N.apk` (`-s`, bo ADB widzi
    zegarek 2×). Plik: `curl -L -o sapp2-wear-N.apk https://github.com/SokkiEltanin/sapp2/releases/download/wear-N/sapp2-wear-N.apk`.
- Aktualizacja = zainstalowanie nowszego pliku tak samo (dane zostają).
