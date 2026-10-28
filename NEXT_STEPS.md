# NEXT_STEPS.md — sapp2

Co dalej / otwarte wątki między sesjami. Jedyne miejsce w repo śledzące to na bieżąco —
aktualizuj po skończeniu/odkryciu czegoś nowego (patrz `CLAUDE.md`).

## Zdecydowane, jeszcze niezbudowane

- **Domyślna ręka: prawa**, z możliwością przełączenia na lewą w ustawieniach
  (wtedy belka pewnie lustrzanie do lewej krawędzi — do dopracowania przy budowie).
  Navbar sam (prawa belka + Ustawienia w lewym dolnym rogu) już zbudowany, patrz niżej.

## Pomysł do rozważenia: redesign Pupila (roślinka zamiast bossów)

User (2026-10-26): obecny Pupil (walki z bossami, mapa kampanii) jest "za bardzo grą,
za mało odzwierciedla rzeczywistość tego co robię" — raczej do wywalenia. Zakładka
zostaje, ale inna mechanika:

- Start: ziarenko/sadzonka.
- Podlewanie wodą i nawożenie — surowce (woda, nawóz) zdobywane z questów/zadań,
  ćwiczeń, picia wody itp. (czyli z realnej aktywności w apce, nie z abstrakcyjnego
  "many/staminy" jak w obecnym Pupilu).
- Jak roślinka dorośnie — trafia do "ogródka", można zacząć hodować kolejną, inną.
- Unikalne nasionka do odblokowania: za streaki, za coiny (do przemyślenia jaka
  waluta/mechanika).
- Rezygnacja z bossów, mapy kampanii, walk — to wszystko zostaje tylko jako
  historia/inspiracja w `sapp`, nie jest kopiowane 1:1.
- **Tryb focus (2026-10-26):** aktywne pomodoro do zadania → roślinka rośnie szybciej.
  Do przemyślenia razem z systemem powiadomień (patrz "Do zrobienia" niżej).

Status: pomysł zgłoszony, NIE zdecydowany ostatecznie ("nie wiem do pomyślenia").
Wracamy do tego jak dojdziemy do budowania Pupila konkretnie — nie blokuje obecnej
pracy nad nawigacją/stylem.

## Referencje designu

- User-owy telefon: **1440×3088 px** (Samsung Ultra-klasa, ~9:19.3). Punkt odniesienia
  przy tłumaczeniu stylu/wymiarów z jego opisów/screenów — liczby podawane przez usera
  traktować jako proporcję względem tej szerokości (1440), nie dosłowny px w kodzie RN
  (który liczy się w dp).

## Do zrobienia / sprawdzenia

- Realny branding (ikona/splash) — obecne `assets/icon.png`, `splash.png`,
  `adaptive-icon.png` to tymczasowy placeholder (ciemne tło + "S2"), wygenerowany
  tylko żeby build przeszedł. Podmienić jak user pokaże/zrobi docelową grafikę.
- Android OAuth + Firestore: sprawdzić czy user utworzył bazę Firestore w konsoli
  Firebase (`Create database`, projekt `sapp2-a2354`) — bez tego test Firestore
  nie przejdzie niezależnie od fixu transportu w kodzie.
- **Lista zadań w `ZADANIA`** — logika sekcji ponownie z `sapp` (TERAZ / bezterminowe /
  terminowe, zadanie #42), **UI/UX zupełnie nowy** (user potwierdził 2026-10-26: "zrobimy
  podobnie ale UIUX będzie zupełnie inny" — to samo dotyczy Finansów). Zewnętrzna
  referencja: TickTick łączy pasek kalendarza u góry z listą zadań pod spodem dokładnie
  w stylu który user opisał (tydzień zwinięty → miesiąc po kliknięciu).
- **Widget na pulpicie Androida dla Zadań** (user, 2026-10-26) — `sapp` już to ma,
  wzorzec do powtórzenia 1:1 (nie szukać nowej biblioteki), patrz `ARCHITECTURE.md`
  sekcja ZADANIA po pełny opis mechanizmu (`plugins/withTasksWidget.js`, natywny
  Kotlin, bez zewnętrznego pakietu).

## Kolizja lewy dolny róg (Ustawienia / satelickie Finanse / "dodaj")

Trzy rzeczy chcą tego samego miejsca: globalne Ustawienia (już tam, zbudowane), dostęp
do satelickich ekranów Finansów (Pojazdy/Produkty/Subskrypcje), i teraz też nowy,
ujednolicony "dodaj" dla Finansów (parser paragonu + ręczny "custom paragon" + przychód
— patrz `ARCHITECTURE.md` sekcja FINANSE po pełny opis problemu z `sapp`, który to
wymusił). User (2026-10-26) sam zauważył kolizję i poprosił o propozycję.

**Rekomendacja:** rozdzielić po częstości/zasięgu, nie upychać wszystkiego w jeden róg:
- **Ustawienia** zostają w lewym dolnym rogu navbara — rzadkie, globalne, już zbudowane.
- **"Dodaj" w Finansach** → **floating action button**, nie kolejna ikona w rogu. To
  jedna z najczęstszych akcji w całej appce (user: paragon z Lidl+ w sekundę), zasługuje
  na własne, stałe miejsce w zasięgu kciuka (np. pływający przycisk tuż nad/obok
  klastra 5 zakładek), kontekstowy per-ekran (na Finansach = dodaj wydatek/paragon/
  przychód, na Zadaniach później może = dodaj zadanie) — wzorzec znany z Gmaila/Todoist.
- **Satelickie ekrany Finansów** (Pojazdy/Produkty/Subskrypcje) — rzadkie, nie
  potrzebują własnego miejsca w navbarze wcale; naturalnie mieszczą się jako mały rząd
  ikon/chipów WEWNĄTRZ samego ekranu Finanse, nie jako osobny przycisk globalny.

Nie wdrożone jeszcze — **rekomendacja, do potwierdzenia przez usera** zanim zacznę budować.

## Pozostałe ogólne decyzje

- **Powiadomienia full-screen** — pierwszy test dodany (2026-10-27): `expo-notifications`
  zainstalowany, przycisk "Test alertu (max priorytet)" w Ustawieniach
  (`app/settings.tsx`) wysyła natychmiastowe powiadomienie przez kanał o
  `AndroidImportance.MAX` + dźwięk + wibracja + `bypassDnd` + widoczność na ekranie
  blokady. **To SUFIT tego co daje goły `expo-notifications`, NIE prawdziwy
  full-screen-intent** (appka wymuszająca pełny ekran jak budzik — do tego nadal
  potrzeba `notifee` albo natywnego kodu). User ma ocenić ten test na urządzeniu i
  zdecydować czy to wystarczy, czy inwestujemy w cięższą zależność.
- **Wibracje — ZDECYDOWANE (2026-10-26):** jeden globalny przełącznik w Ustawieniach,
  tak jak w `sapp`, NIE per-ekran. Jeśli jakiś ekran okaże się zbyt "wibrujący",
  wyciszamy to punktowo w kodzie tego ekranu zamiast dodawać kolejny przełącznik.

## Dashboard — pierwsze 4 rzędy zbudowane (2026-10-26), otwarte przybliżenia

Zbudowane wg mockupów usera: `src/components/dashboard/` (StatTile, PatternTileBackground,
FactTile, SleepTile, TaskListTile, LevelTile, FoodBarsTile) + `tilePosition.ts` (wspólna
reguła zaokrąglania skrajnych krawędzi rzędu + stała wysokość `TILE_ROW_HEIGHT`
wszystkich rzędów). Paleta: `theme/colors.ts` → `colors.stat.*` (kolor kategorii = tekst
+ gradient tła), `colors.chart.*` (stany nieaktywne w wykresach). Font: Inter przez
`@expo-google-fonts/inter` (ExtraLight/Regular/Medium/Bold/Black), załadowany
nieblokująco w `app/_layout.tsx`.

**Dokładnie z mockupów:** wszystkie kolory kategorii (woda/słodycze/event/pogoda/sen/
finanse), wszystkie rozmiary i wagi fontów podane wprost, reguła zaokrąglania 50px
tylko na skrajnych krawędziach rzędu, wymiary 649×460 (2×308+33) dla kafli "pattern".

**Przybliżone, do weryfikacji na urządzeniu:**
- Wzór koncentrycznych pierścieni w tle Ciekawostki/Snu — dokładne parametry (liczba,
  odstępy) nie były podane, tylko "Concentric pattern 20%" w Figmie.
- Kolory tagów "..." (grey) i dzwonka (amber) w Zadaniach — podany wprost był tylko
  niebieski `#1B36AF` dla tagu UR, reszta to przybliżenie z istniejącej palety.
- Kafelek Pupil/LVL (prawy w rzędzie Zadań) — zupełnie nieustalony, czysty placeholder
  tekstowy "LVL 27" bez ilustracji (powiązane z pomysłem rośliny wyżej).
- Wysokości słupków w kaflu Finanse — zrobione proporcjonalnie do wartości (sensowny
  domyślny wybór), nie 1:1 skopiowane z mockupu (tam wyglądały na orientacyjne/ręczne).
- **Kafelek pogody wywalony (2026-10-26)** — zastąpiony streakiem ĆWICZENIA (ten sam
  wzorzec co WODA/SŁODYCZE). Kolor `colors.stat.cwiczenia` (`#5BC24F`, zielony) wybrany
  przeze mnie, nienazwany w mockupie — do ew. korekty. `StatTile`'owy wariant `weather`
  zostaje w komponencie (nieużywany teraz, ale gotowy gdyby pogoda wróciła gdzie indziej
  — np. `DAILY` w `ARCHITECTURE.md`).

## Navbar + Ustawienia — zbudowane (2026-10-26)

`TabBar.tsx` przebudowany: klaster 5 zakładek ściśnięty do prawej krawędzi (nie pełna
szerokość), kolejność `Dashboard → Daily → Finanse → Zadania → Pupil` (Pupil skrajnie
prawy = najczęstszy = najbliżej kciuka). "Notatki" z wcześniejszej notatki zastąpione
realnie istniejącym "Zadania" — **potwierdzone przez usera (2026-10-26), zostaje tak**.
Ikona Ustawień przeniesiona z pływającego przycisku na Dashboardzie (nachodził na
kafelek pogody) na stałe miejsce w lewym dolnym rogu paska, osobno od klastra 5
zakładek — patrz wyżej (satelickie ekrany Finansów) o kolizji tego miejsca z nowym
pomysłem na kontekstowy przycisk per-ekran.

## Fix: tekst ucinany w kaflach Dashboardu (2026-10-26)

Przyczyna: kontener treści kafla miał `alignItems: 'center'`, więc Text dostawał tylko
tyle miejsca ile sam chciał (shrink-to-content), a nie realną szerokość kafla —
`adjustsFontSizeToFit` nie miało więc względem czego się kurczyć i długi tekst po prostu
wystawał poza `overflow: hidden` ("DNI"→"DN", "SŁODYCZE"→"ŁODYCZI", "22,4"→"22,").
Fix: `alignItems: 'stretch'` (domyślne) + `textAlign: 'center'` na tekście, żeby była
realna szerokość do skurczenia + `adjustsFontSizeToFit`/`minimumFontScale` jako siatka
bezpieczeństwa na przyszłość, gdy wartości będą pochodzić z prawdziwych danych (różne
długości liczb/etykiet). Poprawione: StatTile, FoodBarsTile, TaskListTile.
Dodatkowo: wiersze w Zadaniach miały cienkie linie-dzielniki zamiast osobnych
segmentów z odstępem jak w mockupie — poprawione na realne odstępy (`marginBottom`)
między zaokrąglonymi wierszami.

## Runda poprawek 2 (2026-10-26, po pierwszym teście na urządzeniu)

- **Padding w kaflu Zadań** — brak paddingu powodował, że pierwszy wiersz siedział tak
  blisko dużego zaokrąglenia zewnętrznego rogu, że róg "odgryzał" kawałek chipa taga
  ("UR"→"U"). Dodany `padding: 6` na zewnętrznym `tile` naprawia oba zgłoszenia
  (brakujący odstęp od krawędzi + ucięty tekst chipa) jednym fixem.
- **Fonty w StatTile powiększone** — value 30→34, unit 13→15, label 14→16, detail
  11→13. Poprzednia runda zmniejszyła je żeby naprawić clipping, ale clipping
  naprawiał w rzeczywistości fix `alignItems: 'stretch'`, nie mniejszy rozmiar — więc
  bezpiecznie wracamy w górę, `adjustsFontSizeToFit` i tak jest siatką bezpieczeństwa.
- **FactTile (Ciekawostka)** — usunięta kropka karuzeli (była zapowiedzią przyszłego
  swipe'a między wieloma ciekawostkami — jeśli karuzela wróci, potrzebny będzie inny
  wskaźnik stron). Tekst wycentrowany w całym kaflu (pion + poziom), ikona globu
  przypięta osobno w rogu (`position: absolute`), nie bierze już udziału w centrowaniu.
- **SleepTile (Sen)** — czas snu ("7h 50m") przeniesiony z wizualnego środka kafla na
  górę, zgrupowany z ikoną księżyca i etykietą "SNU" w jedno dziecko, żeby
  `justifyContent: 'space-between'` z `PatternTileBackground` rozciągał tylko DWIE
  rzeczy (górną grupę i zakres godzin na dole), nie trzy.

## Runda poprawek 3 (2026-10-27)

- **StatTile label** — wymusza 1 linię (nie 2) dla zwykłych jednowyrazowych nazw
  kategorii, żeby `adjustsFontSizeToFit` zmniejszał czcionkę zamiast zawijać do
  brzydkiej sieroty ("ĆWICZENIA" → "ĆWICZENI"/"A"). Wykrywane po obecności `\n` w
  stringu (jest `\n` → 2 linie, np. "DZIENNIE\n#JEDZENIE" w Finansach; nie ma → 1).
- **System tagów w Zadaniach przebudowany** (`TaskListTile.tsx`) — 4 stany zamiast 3:
  `empty` (brak taga, kropeczki), `label` (dowolny skrót, np. UR, PW — tekst z danych,
  nie z kodu, więc nowe skróty nie wymagają zmian), `urgent` (czerwony, wykrzyknik,
  niezależny od tego czy zadanie ma nazwany tag), `bell` (przypomnienie). Realna
  przyczyna "UR"→"U": `minWidth: 26` na chipie po odjęciu paddingu zostawiało ~12px na
  tekst — za mało dla Inter Black. Usunięty `minWidth`, dodany `flexShrink: 0`, chip
  rośnie wyłącznie z treści + padding (pill dla tekstu, stałe kółko dla ikon).
- **FoodBarsTile — kreska średniej** pozycjonowana na wysokości % wartości względem
  max (jak słupek), nie przyklejona do dołu — user: "miała pokazywać tę średnią
  wysokością względem innych kafelków". Zachowanie/interakcja — osobno, później.

## Runda poprawek 4 (2026-10-27)

- **Fix realnej przyczyny "nic się nie dzieje" w teście alertu**: brakowało
  `Notifications.setNotificationHandler(...)`. Bez tego Expo (od kilku SDK) domyślnie
  NIE pokazuje powiadomienia gdy appka jest na pierwszym planie — `scheduleNotificationAsync`
  mógł się udać (stąd ewentualne ✅ w logu), ale system nie wiedział że ma cokolwiek
  wyświetlić. Dodany handler (`shouldShowBanner/shouldShowList/shouldPlaySound: true`).
  User ma spróbować ponownie.
- **Ustawienia (`app/settings.tsx`) restylowane** pod nasz system: Inter zamiast
  domyślnego fontu, przyciski jako karty z kolorową ikoną w odznace (kolor per
  funkcja z `colors.stat`/`colors.accent`), nie gołe linie tekstu.
- **TabBar: Ustawienia wizualnie oddzielone od klastra 5 zakładek** (user: "żeby było
  że to przycisk nie część navbaru, ale nadal to navbar") — tło+obramowanie jak karta
  (zamiast gołej ikony bez tła) + pionowa kreska-separator między nimi a klastrem.

## Runda poprawek 5 (2026-10-27)

- **SleepTile** — delikatny polish (wartość 22→25, ciaśniejszy odstęp do "SNU") —
  struktura top-left (ikona góra-prawo, wartość+SNU góra-lewo, godziny dół) była już
  poprawna z poprzedniej rundy, user podesłał dokładny mockup z Figmy do porównania.
- **TaskListTile — realny kontrast chipów naprawiony**: WSZYSTKIE chipy miały twardo
  zakodowany prawie-czarny tekst/ikonę (`#0B0E14`), co na ciemnoniebieskim (`label`)
  i szarym (`empty`) tle było praktycznie nieczytelne — user mockup pokazuje wyraźny
  BIAŁY tekst/ikonę na tych tłach. Dodana `chipContentColor(tag)`: biały domyślnie,
  czarny tylko dla `bell` (złote tło) i `urgent` (czerwone, świadomie "znak
  ostrzegawczy" czarny-na-czerwonym/żółtym — ten jeden był już OK, nie dotykany).
  Chipy też powiększone (wysokość 20→26, pill padding 8→12, kółko 24→26,
  `chipLabel` 10→11.5) i tytuł zadania 13→13.5 — bliżej proporcji z mockupu.
- **TaskListTile — kontener bez własnego tła** (`c.bg.card` → `transparent`) + większy
  odstęp między wierszami (3→6px) — user mockup: wiersze "pływają" luzem na czarnym
  tle ekranu jako osobne, w pełni zaokrąglone pigułki, nie siedzą na wspólnej
  jaśniejszej karcie z wąskimi szczelinami. Każdy wiersz ma już własny
  `borderRadius: 10` na wszystkich rogach (to się nie zmieniło) — zmieniło się tylko
  to co widać W TLE między nimi.
- **FoodBarsTile (#JedzeniePerMiesiąc) — brakujący gradient dodany**: jedyny kafelek bez
  warstwy gradientu czarny→akcent na 20% opacity (user to zauważył porównując z resztą
  dashboardu) — teraz ten sam wzorzec co StatTile/PatternTileBackground/TaskListTile
  (`colors.stat.finanse`, pionowy, pod contentem).
- Niezweryfikowane na urządzeniu — czeka na build i test usera.

## Runda poprawek 6 (2026-10-27)

- **Ustawienia przebudowane na nasz system wizualny + wyszukiwarka** (user: "zrob nam
  lepiej zakładkę ustawienia, tam zeby bylo z wyszukiwarka i tam będą te testy itp
  tylko w tym stylu ci mamy" — stylu wypracowanego na kafelkach Dashboardu). Nowa
  struktura `app/settings.tsx`:
  - `SECTIONS: SettingsSection[]` — sekcje z tytułem + listą itemów (`label`,
    `description` do wyszukiwarki, `icon`, `accent`). Na razie jedna sekcja
    "DIAGNOSTYKA (TEST)" z dawnymi 4 testami (Google/Firestore/Kalendarz/Alert) —
    kiedy zaczniemy robić prawdziwe Ustawienia, dojdzie kolejny obiekt do tablicy,
    zero zmian w layoucie/filtrze.
  - Pasek wyszukiwania (karta jak wszędzie: `c.bg.card` + `border.default` +
    `radius.lg`) filtrujący sekcje/itemy po `label`/`description` (lowercase
    `includes`), z przyciskiem X do czyszczenia i komunikatem "Brak wyników" gdy
    pusto.
  - Itemy pogrupowane w jedną kartę na sekcję z cienkimi dzielnikami
    (`border.subtle`) między wierszami zamiast osobnych kart każdy — bardziej
    "ustawieniowy" look niż poprzednia wersja (każdy przycisk osobną kartą).
  - Cała logika testów (Google/Firestore/Kalendarz/full-screen alert, dynamiczne
    importy natywnych modułów) bez zmian — WCIĄŻ tylko infrastruktura testowa, nie
    prawdziwe Ustawienia z ARCHITECTURE.md.
- Niezweryfikowane na urządzeniu — czeka na build i test usera.

## Runda poprawek 7 (2026-10-27)

User podesłał zrzuty bezpośrednio z Figmy (nie tylko exportowany mockup) — bezpośrednie
porównanie wykryło 2 realne rozjazdy:

- **Kafelek EVENT (27 MINUT) — `detail` tekst był źle złamany i źle wyrównany**: w
  Figmie `[JD] 15:00 -21:00 (6h)` to WYŚRODKOWANY tekst na 2 liniach
  (`[JD] 15:00` / `-21:00 (6h)`); u nas był wyrównany DO LEWEJ na 3 liniach
  (`[JD]` / `15:00-21:00` / `(6h)`) — stąd mniejszy odstęp od "MINUT" niż w oryginale
  (więcej tekstu = mniej miejsca na `justifyContent:'space-between'` do rozepchnięcia).
  Fix: `StatTile.tsx` detail `textAlign: 'left'` → `'center'`, `numberOfLines` 3→2;
  mock data w `index.tsx` `'[JD]\n15:00-21:00\n(6h)'` → `'[JD] 15:00\n-21:00 (6h)'`.
- **TaskListTile — wiersze dalej za ciemne nawet po poprzedniej rundzie**: realny root
  cause doprecyzowany po bezpośrednim porównaniu z Figmą — kolor taga (np. `#1B36AF`,
  CELOWO ciemny granat pod czytelny biały tekst chipa) przy tych samych 20% opacity co
  reszta dashboardu (gdzie akcenty są jasne, np. WODA `#5AAFFA`) wychodzi praktycznie
  niewidoczny nad czarnym tłem. Podbite `gradient.opacity` w `TaskListTile.tsx`:
  0.2 → 0.4 (WYŻSZE niż gdzie indziej na dashboardzie — celowo, bo baza koloru jest
  ciemniejsza).
- Niezweryfikowane na urządzeniu — czeka na build i test usera.

## Runda poprawek 8 (2026-10-27)

User podesłał dokładny inspektor Figmy (wymiary, typografia, fill) dla kafelka
Zadania — ujawnił 2 realne rozjazdy w kształcie/proporcjach chipa:

- **Chip taga — JEDEN stały kształt dla wszystkich 4 stanów, nie dwa różne**: Figma
  pokazuje `label`/`empty`/`bell`/`urgent` jako IDENTYCZNY zaokrąglony prostokąt
  (89×50, corner radius 20 — proporcja ~1.78:1, promień ~40% wysokości, NIE pełna
  "pigułka"/okrąg). U nas były DWA różne kształty: rosnąca z treścią pigułka
  (`chipPill`, `borderRadius:999`) dla `label`, stały okrąg (`chipRound`,
  `borderRadius:999`) dla reszty. `TaskListTile.tsx`: usunięty podział na
  `chipPill`/`chipRound`, jeden `chip` ze stałym `width:46, height:26, borderRadius:10`
  (zachowuje proporcję z Figmy) dla wszystkich kindów. Tekst "UR" dostał
  `adjustsFontSizeToFit` jako zabezpieczenie na przyszłość (dowolny string z danych,
  stały box może być za wąski dla dłuższych skrótów niż 2 znaki).
- **Tytuł zadania za mały względem chipa**: Figma — tytuł Inter Bold 40 vs tekst
  chipa Inter Black 32 (różnica ×1.25); u nas 13.5 vs 11.5 (×1.17, za mała różnica).
  `title.fontSize` 13.5 → 14.5.
- Kolor tytułu (`#D6D6D6`) już się zgadzał z `c.text.primary` — bez zmian.
- Niezweryfikowane na urządzeniu — czeka na build i test usera.

## Infra fix (2026-10-27) — `versionCode` zawsze 1

User po build #24 zgłosił że screen wygląda identycznie jak sprzed kilku buildów
("chyba nic nie zmieniłeś") — sam podejrzewał że potrzebuje pełnego reinstalu
zamiast "update". Sprawdziłem `.github/workflows/build.yml`: `app.json` nigdy nie
ustawia `android.versionCode`, więc `expo prebuild` generuje `versionCode 1` w
KAŻDYM buildzie (zweryfikowane lokalnie: `npx expo prebuild` → `android/app/build.gradle`
ma `versionCode 1`, zawsze). Android przy instalce "z pliku APK" (nie `adb install -r`)
na niektórych ROM-ach/wersjach potrafi po cichu NIE podmienić kodu gdy nowy plik ma
identyczny `versionCode` co zainstalowana wersja — install "się udaje" bez błędu, ale
kod zostaje stary. To realnie mogło być źródłem powtarzających się "starych" zrzutów.

**Fix**: nowy krok w workflow zaraz po `expo prebuild`, PRZED resztą (sign/build) —
`sed -i "s/versionCode [0-9]\+/versionCode ${{ github.run_number }}/" android/app/build.gradle`
— każdy build dostaje unikalny, ROSNĄCY `versionCode` (numer runu, ten sam używany już
w nazwie pliku/release). Zweryfikowane lokalnie: uruchomiony `npx expo prebuild`,
potwierdzony dokładny format linii (`versionCode 1`), przetestowany sam `sed` na
żywym pliku — podmienia poprawnie. `android/` jest gitignored (`/android` w
`.gitignore`), prebuild-generowany na świeżo w CI za każdym razem — ten lokalny test
nie zostawił nic do commitowania poza samym workflow.

**sapp (dojrzały reference-app) ma DOKŁADNIE TEN SAM gap** (sprawdzone,
`versionCode`/`autoIncrement` też nigdzie nie ustawiane) — ale CLAUDE.md zakazuje
ruszania sapp, więc zostawione bez zmian tam; to jest coś do przekazania userowi jeśli
kiedyś napotka tam podobny objaw.

**User**: spróbuj mimo wszystko PEŁNEGO odinstalowania obecnej wersji i instalacji
build #24/#25 na czysto — to obejście tego konkretnego problemu niezależnie od fixu
(fix w workflow zapobiega PRZYSZŁYM przypadkom, nie naprawia już zainstalowanej
starej kopii).

**Update**: user zrobił pełny odinstaluj+zainstaluj i DALEJ to samo ("to samo xdd") —
poprosił o sekcję w Ustawieniach pokazującą numer builda/datę, żeby móc jednym
spojrzeniem w appce (nie w GitHubie) zweryfikować czy zainstalowany APK to faktycznie
najnowszy build. Dodane:
- `.github/workflows/build.yml`: nowy krok "Compute build metadata" na samym początku
  (`git rev-parse --short HEAD` → `SHORT_SHA`, `date -u` → `BUILD_DATE`, oba do
  `$GITHUB_ENV` — dostępne we wszystkich kolejnych krokach). Krok "Build release APK"
  dostaje teraz `EXPO_PUBLIC_BUILD_DATE`/`EXPO_PUBLIC_BUILD_COMMIT` obok już istniejącego
  `EXPO_PUBLIC_BUILD_NUMBER` — Expo inline'uje `EXPO_PUBLIC_*` w bundlu JS na etapie
  budowania. Krok "Rename APK" uproszczony żeby użyć tego samego `$SHORT_SHA` zamiast
  liczyć go drugi raz.
- `app/settings.tsx`: `BUILD_INFO` (wersja z `expo-constants`, reszta z
  `process.env.EXPO_PUBLIC_*`, fallback `'dev'` gdy puste — czyli w Expo Go/dev, bo
  tam nikt tych zmiennych nie ustawia) + statyczny blok "O APLIKACJI" na dole ekranu
  (POZA systemem sekcji/wyszukiwarki — nic tu nie jest klikalne): Wersja / Build #N /
  Zbudowano <data UTC> / Commit <short sha>.
- To NIE zastępuje fixu `versionCode` wyżej — to DIAGNOSTYKA, żeby user mógł sam
  potwierdzić (albo wykluczyć) czy wciąż widzi stary build, zamiast zgadywać ze
  zrzutów ekranu. Jeśli po tym buildzie ekran "O APLIKACJI" pokaże właściwy
  numer/datę, a layout dalej wygląda staro — to już NIE jest problem instalacji/cache,
  tylko coś innego do zdiagnozowania od nowa.
- Niezweryfikowane na urządzeniu — czeka na build i test usera.

**Rozwiązane**: po instrukcji ręcznego sprawdzenia nazwy pobranego pliku + "O
aplikacji" user potwierdził build #26 faktycznie zainstalowany (problem był po jego
stronie — stary/zcache'owany download, nie infrastruktura). Dzięki temu dopiero teraz
dostaliśmy PRAWDZIWY feedback wizualny na aktualny kod (patrz Runda poprawek 9 niżej).

## Runda poprawek 9 (2026-10-28) — pierwszy prawdziwy feedback na build #26

- **TaskListTile — chip REALNIE wystawał poza wiersz** (user: "kolorowe kwadraty...
  za duże per kafelek... nachodzą na granice"). Policzone dokładnie: dostępna
  wysokość JEDNEGO wiersza = `(TILE_ROW_HEIGHT=120 − padding kafla×2=8 − 3 odstępy
  międzywierszowe×6=18) / 4 wiersze ≈ 23.5px`. Chip miał `height: 26` — WIĘKSZY niż
  wiersz, w którym żyje! Wcześniej (odstęp 3px zamiast 6px z rundy 7) różnica była
  pod-pikselowa/niezauważalna; podbicie odstępu do 6px (żeby wiersze "pływały" jak w
  mockupie) dopiero wtedy przelało to w realny, widoczny overflow — klasyczny
  przypadek dwóch osobno-poprawnych zmian psujących się nawzajem. Fix:
  `chip` 46×26 radius 10 → **32×18 radius 7** (ta sama proporcja z Figmy ~1.78:1 /
  promień ~40% wysokości, przeskalowana żeby faktycznie mieścić się w 23.5px), ikony
  wewnątrz 15/14 → 11/10, `chipLabel` fontSize 11.5 → 10.
- **FoodBarsTile — zły kierunek gradientu**: user "był lekki od prawego dolnego rogu
  do lewego górnego" (skos), u nas był pionowy góra→dół (z poprzedniej rundy, zgadywany
  bez referencji bo user wtedy powiedział "ogarniesz już po stylu"). Fix:
  `start:{1,1}→end:{0,0}` (czarny prawy-dół, akcent lewy-góra), reszta (kolor, 20%
  opacity) bez zmian.
- Niezweryfikowane na urządzeniu — czeka na build i test usera.

## Runda poprawek 10 (2026-10-28) — Ustawienia na kategorie + navbar w naszym stylu

User: "navbar dopasowany stylem pod taki jaki mamy, tak samo ustawienia i zakładki
(ustawienia jak w sap musimy podzielić żeby mieć INFO, DIAGNOSTYKĘ, FINANSE itp)".

- **`app/settings.tsx` przebudowany na dwupoziomową strukturę kategorii** — ten sam
  wzorzec co sapp (`SettingsSectionDef`/`SettingsCategoryRow`/`activeSectionId` jako
  stan lokalny, nie osobna trasa routera): główny ekran pokazuje KARTY kategorii
  (odznaka ikony + tytuł + liczba pozycji + strzałka), kliknięcie wchodzi w pełną
  listę tej kategorii. 3 sekcje na start:
  - **Info** — dawny statyczny blok "O aplikacji" (wersja/build/data/commit)
    przeniesiony TUTAJ jako 4 itemy typu `value` (nieklikalne, tylko wyświetlają),
    zamiast osobnego bloku zawsze widocznego na dole ekranu.
  - **Diagnostyka** — dawne 4 testy (Google/Firestore/Kalendarz/alert), logika bez
    zmian, tylko przeniesione pod tę kategorię.
  - **Finanse** — jeden statyczny item "Wkrótce" (parser paragonów/budżety/limity) —
    appka nie ma jeszcze ŻADNEJ funkcji finansowej, więc sekcja jest pusta-poza-stub,
    NIE udajemy gotowej funkcji. Struktura gotowa pod realne itemy gdy Finanse
    zaczną powstawać.
  - Wyszukiwarka jest GLOBALNA (przeszukuje wszystkie sekcje naraz, płaska lista
    wyników — wzorzec `filterSections` z sapp), nie tylko aktywną kategorię.
  - Log testów Diagnostyki widoczny TYLKO w tej sekcji (nie zaśmieca innych widoków).
- **`TabBar.tsx` — aktywna zakładka dostaje kolorową odznakę w tle** (`${accent}1F`
  nad `item`), ten sam język co ikony w kółkach na Dashboardzie/w Ustawieniach —
  wcześniej aktywność sygnalizował WYŁĄCZNIE kolor ikony/tekstu, bez żadnego tła,
  co odstawało od reszty systemu wizualnego.
- Niezweryfikowane na urządzeniu — czeka na build i test usera.

## Sandbox pełnoekranowych alertów (2026-10-28)

User: "potraktujmy sapp2 jako pole do manewrów, zrób ustawienia tych alertów, możesz
nawet kilka opcji osobno testować, ja powiem która działa/czy coś działa". Nowa sekcja
**Alerty** w Ustawieniach z DWOMA niezależnymi testami do bezpośredniego porównania:

- **Expo (MAX priorytet)** — bez zmian logiki (dawny `testFullScreenAlert`,
  przeniesiony z Diagnostyki), punkt odniesienia. Już wcześniej potwierdzone przez
  usera że NIE przebija blokady ekranu — to tylko heads-up, sufit gołego
  `expo-notifications`.
- **Notifee (full-screen)** — NOWA opcja, `@notifee/react-native` (`npx expo install`,
  wylądował na `^9.1.8`). Prawdziwy natywny `fullScreenAction: { launchActivity:
  'default' }` w `displayNotification`, kanał `AndroidImportance.HIGH` +
  `AndroidCategory.CALL` (ten sam mechanizm co budzik/połączenie przychodzące).
  - **`plugins/withFullScreenAlert.js`** (nowy, wzorzec identyczny do
    `withTasksWidget.js` w sapp — `withAndroidManifest` + `getMainActivityOrThrow`):
    dopisuje `android:showWhenLocked="true"` + `android:turnScreenOn="true"` na
    MainActivity. BEZ TEGO notifee wystawia `fullScreenIntent` natywnie, ale Android
    i tak pokaże to jako zwykłe heads-up — te dwie flagi na DOCELOWEJ Activity są
    tym co faktycznie pozwala wyjść NAD blokadę ekranu. Zweryfikowane lokalnie:
    `npx expo prebuild` → `AndroidManifest.xml` ma obie flagi na `.MainActivity`.
  - **`app.json`**: dodane `android.permission.USE_FULL_SCREEN_INTENT` (wymagane od
    któregoś Androida żeby full-screen-intent w ogóle się odpalił) + plugin do tablicy
    `plugins`.
  - **UWAGA do oceny razem z userem**: `showWhenLocked` na MainActivity jest GLOBALNE
    dla tej Activity, nie tylko w momencie alertu — jeśli user zdecyduje że to
    zostaje na stałe, docelowo lepiej przenieść te flagi na DEDYKOWANĄ, osobną
    natywną Activity tylko dla alertów (nie całą główną appkę), żeby zwykłe otwarcie
    appki z zablokowanego telefonu nie omijało blokady ekranu poza kontekstem
    prawdziwego alertu. Zostawione tak na razie bo to SANDBOX/test, nie decyzja
    produkcyjna.
  - **Android 14+**: `USE_FULL_SCREEN_INTENT` może wymagać RĘCZNEGO włączenia przez
    usera w ustawieniach systemowych appki ("Pełnoekranowe powiadomienia") — jeśli
    test "nic nie robi" mimo ✅ w logu, to pierwsze miejsce do sprawdzenia, nie bug.
- Niezweryfikowane na urządzeniu — czeka na build i test usera. User ma ocenić która
  opcja (jeśli którakolwiek) faktycznie wybudza telefon nad blokadą ekranu.

**Fix po pierwszym teście na urządzeniu**: notifee rzucał błąd przy `createChannel`:
`'channel.vibrationPattern' expected an array containing an even number of positive
values` — w przeciwieństwie do `expo-notifications` (gdzie wiodące `0` = "opóźnienie
startu" jest dozwolone), notifee wymaga WYŁĄCZNIE dodatnich wartości. `[0, 500, 250,
500]` → `[300, 500, 300, 500]`. Nie zdążyło dojść do faktycznego testu full-screen —
to blokowało `createChannel` zanim `displayNotification` się w ogóle odpaliło.

## Navbar — restyl pod Figma-reference (2026-10-28)

User podesłał paczkę exportów z Figmy (`PORJEKT_SAPP.zip`, głównie bulk-dump ikon
całego projektu, nie tylko navbaru) + zrzut samego paska: gear osobno po lewej +
grupa 4 ikon w ciemnej pigułce, aktywna z jasną zaokrągloną odznaką w tle i ciemną
ikoną w środku, reszta bez tła. User wprost: "to tylko wizualizacja nie sugeruj się
ilością [4 vs nasze 5 zakładek] tylko styl i kolory" — więc struktura (5 zakładek,
te same ikony co mieliśmy) zostaje, zmienia się WYŁĄCZNIE traktowanie wizualne:

- **`TabBar.tsx`**: usunięty system kolorowania per-sekcja (`accent` na każdej
  zakładce, `${accent}1F` tło + `accent` kolor ikony/tekstu gdy aktywna) — zastąpiony
  JEDNYM, monochromatycznym traktowaniem: aktywna ikona dostaje jasną, lekko
  zaokrągloną (nie pigułkę/okrąg — `borderRadius:13` na `38×38`, dokładnie proporcja
  z `Group 273.svg` w paczce, `rx` ≈ 33% szerokości) odznakę w tle (`c.text.primary`)
  + ciemną ikonę (`c.bg.primary`) w środku; nieaktywne — goła ikona `c.text.secondary`
  na przezroczystym tle, bez żadnej odznaki. Spójne z wcześniejszym "pójdziemy we
  wszystko jednolite" (user, kilka wiadomości wyżej) — jeden system zamiast 5 kolorów.
- **Etykiety tekstowe pod ikonami USUNIĘTE** (reference nie ma żadnych) — `label` w
  danych `TABS` zostaje, ale tylko jako `accessibilityLabel`, nie renderowany tekst.
- Ikony per-zakładka (Dashboard/Daily/Finanse/Zadania/Pupil) BEZ ZMIAN — reference
  pokazywał inne glify (grid/pencil/calendar/menu) tylko jako PRZYKŁAD stylu
  (osobny, mniejszy mockup z 4 slotami), nie prescrypcję które ikony mają być u nas.
- Niezweryfikowane na urządzeniu — czeka na build i test usera.

## Notifee full-screen — pierwszy prawdziwy test na urządzeniu (2026-10-28)

User odpalił "Notifee (full-screen)" — dotarło do `displayNotification` (fix
`vibrationPattern` zadziałał), ale: (1) pokazał się zwykły, długi popup heads-up, NIE
full-screen nad blokadą, (2) BEZ dźwięku i wibracji mimo poprawnej konfiguracji kanału
w kodzie. Dwie osobne, zdiagnozowane przyczyny:

- **Cisza**: kanały powiadomień na Androidzie są NIEMUTOWALNE po pierwszym utworzeniu.
  Build #29 (przed fixem `vibrationPattern`) rzucał błąd walidacji W TRAKCIE
  `createChannel` — mógł zdążyć zarejestrować kanał `alerts-fullscreen` z domyślnymi
  (cichymi) ustawieniami, zanim dotarł do walidacji wzorca wibracji. Każdy kolejny,
  poprawny `createChannel` pod tym samym `id` jest przez system IGNOROWANY — trzyma
  się pierwszej rejestracji. Fix: nowy `id` kanału (`alerts-fullscreen-v2`), świeża
  rejestracja. Jeśli to się powtórzy po kolejnej zmianie configu kanału — podbić `id`
  znowu, nie da się "nadpisać" istniejącego kanału z poziomu appki (tylko user ręcznie
  przez ustawienia systemowe albo pełny reinstall appki).
- **Brak full-screen**: user klikał przycisk i PATRZYŁ na telefon — appka była więc
  cały czas widoczna na pierwszym planie. Android pokazuje `fullScreenAction` WYŁĄCZNIE
  gdy target-Activity NIE jest już widoczna (zablokowany ekran / inna appka na
  wierzchu) — skoro appka była widoczna, system uznał że nie ma po co jej "wybudzać"
  i pokazał zwykły heads-up. Fix: `testNotifeeFullScreen` ma teraz 5-sekundowe
  opóźnienie (`setTimeout`) PRZED `displayNotification`, z komunikatem w logu "Za 5s
  (zablokuj ekran TERAZ)" — user ma czas kliknąć przycisk i zablokować telefon zanim
  powiadomienie faktycznie wystrzeli.
- Niezweryfikowane na urządzeniu — czeka na build i KOLEJNY test (tym razem z
  faktycznie zablokowanym ekranem w momencie wystrzału).

**Dodatkowy wariant** (2026-10-28, user: "spróbuj dodać tak i nie [i] bez przycisku"):
trzeci test w sekcji Alerty — "Notifee (Tak/Nie)" obok dotychczasowego, przemianowanego
na "Notifee (bez przycisku)". Wspólna logika wydzielona do `sendNotifeeAlert(withActions)`
— `withActions: true` dokleja `android.actions: [{title:'Nie',...}, {title:'Tak',...}]`
(jak odbierz/odrzuć w połączeniu przychodzącym). Oba warianty mają to samo 5s
opóźnienie + świeży kanał `alerts-fullscreen-v2`. User ma ocenić czy przyciski w ogóle
się pokazują na pełnoekranowym alercie i czy da się nimi coś wywołać (na razie bez
podpiętej logiki co się dzieje po "Tak"/"Nie" — czysto wizualny test UI, logika
dopiero gdy user potwierdzi że full-screen jako takie działa).

## Polish: animacja navbaru + zero emotek (2026-10-28)

User: "navbar nie animowes jak klikam... mam wrażenie że robisz na odwal" + "zasada
zero emotek, tylko jeżeli chodzi o wpisywanie humoru xd".

- **`TabBar.tsx` — odznaka aktywnej zakładki teraz animowana** (`TabIcon`, nowy
  subkomponent): skala 0.75→1 + opacity 0→1 na `Animated.Value` per-ikona,
  `useNativeDriver: true`, 180ms. To NIE jest złamanie wcześniejszej zasady "zero
  animacji przejścia między zakładkami" (ta dotyczy przełączania EKRANÓW — pozostaje
  tap-only bez animacji z udokumentowanego powodu bugów w sapp) — to osobna, tania
  mikroanimacja na jednym małym elemencie UI, nie na całym ekranie.
- **Wszystkie emotki usunięte z appki** (`app/settings.tsx` — log statusów testów:
  `⏳/✅/❌/⚠️`, tytuły powiadomień: `🔴`) — zastąpione plain textem. Zasada
  dopisana do `CLAUDE.md` (#9) jako standing rule na przyszłość: zero emotek w UI/
  logach/tytułach, wyjątek tylko dla treści jawnie humorystycznej.
- Niezweryfikowane na urządzeniu — czeka na build i test usera.

## Realny bug + floating navbar (2026-10-28) — "jak klikam to nic się nie dzieje"

User mocno sfrustrowany ("mam wrażenie że się cofamy", "umiesz kodować?"). Dokładny
przegląd kodu znalazł PRAWDZIWY bug, nie tylko kosmetykę:

- **`app/(tabs)/_layout.tsx` — `activeKey()` ZAWSZE zwracał `'index'`**:
  `ROUTES['index'] = '/'`, czyli prefiks KAŻDEJ ścieżki. `TABS.find(...)` sprawdzał
  `'index'` jako PIERWSZY wpis, a `pathname.startsWith('/')` wychodzi `true` dla
  dosłownie każdego pathname — więc funkcja nigdy nie dochodziła do sprawdzenia
  pozostałych 4 zakładek. Ekran REALNIE się zmieniał (`router.navigate` działał
  poprawnie przez cały czas), ale podświetlenie w navbarze nigdy nie ruszało się z
  Dashboardu — stąd "klikam i nic się nie dzieje" (user patrzył na navbar, nie na
  treść ekranu). Fix: `'index'` wyłączone z pętli prefiksowej (ma już wczesny
  `return` dla `pathname === '/'`), reszta sprawdzana normalnie.
- **Navbar przebudowany na PRAWDZIWIE pływający układ** (user: "to był floating
  navbar... ikona ustawień była osobno" — poprzednia wersja miała Ustawienia i
  klaster w jednym wspólnym tle/pasku rozdzielonym kreską, nie dwa w pełni osobne
  elementy). `TabBar.tsx`: usunięty wspólny `wrap` z tłem/obramowaniem/kreską —
  teraz `settingsBtn` (okrągły przycisk) i `cluster` (zaokrąglona karta-pigułka z
  ikonami) to DWA niezależne, pływające elementy z własnym cieniem
  (`shadowColor`/`elevation`), bez wspólnego tła łączącego je, leżące bezpośrednio
  na czarnym tle ekranu.
- **Aktywna odznaka — prawdziwie biała** (`#FFFFFF` dosłownie zamiast
  `c.text.primary` #D6D6D6) — user: "miało być białe tło a nie ma".
- Niezweryfikowane na urządzeniu — czeka na build i test usera. To NAJWAŻNIEJSZY
  build do zweryfikowania w tej sesji — fix prawdziwego buga nawigacji.

## Alert notifee — fix mechanizmu opóźnienia (2026-10-28)

User: "żaden alert nie wybudza ekranu... nie ma dźwięku ani wibracji". Zdiagnozowany
realny root cause: poprzednia wersja używała `setTimeout` W JS do 5s opóźnienia przed
`displayNotification`. Gdy user blokuje ekran (appka idzie w tło), Android może
zawiesić wykonywanie JS ZANIM timer zdąży odpalić — powiadomienie wtedy NIGDY się nie
wysyła. "Cisza" nie była więc kwestią configu dźwięku/wibracji (ten był poprawny) —
notyfikacja po prostu nigdy nie dotarła do systemu. Fix: `notifee.createTriggerNotification`
z `TriggerType.TIMESTAMP` + `alarmManager.allowWhileIdle: true` — planowanie PO
STRONIE SYSTEMU (Android AlarmManager), przeżywa zawieszenie JS/tło/nawet zabicie
appki, odpala się nawet w trybie Doze. To dotyczy OBU wariantów notifee (z przyciskami
i bez) — wspólna funkcja `sendNotifeeAlert`.
- Niezweryfikowane na urządzeniu — czeka na build i test usera.

## Następna wielka faza: port kalendarza/finansów/parserów z sapp (2026-10-28)

User: "ogarnij super bazę, poprzenoś nasze parsery... z głową, nie burdel pod
przyszłość żeby nie lagowało". Ustalona KOLEJNOŚĆ faz (nie zaczynać kolejnej przed
ukończeniem poprzedniej):

1. **Kalendarz** (z sapp) — obustronnie edytowalny, ma być BAZĄ pod plan/pracę itp.
   Pierwsza faza — zaczynamy od tego.
2. **Finanse + parsery** — parser paragonów (share-intent, Select All → Share, BEZ
   OCR — zasada #5 w CLAUDE.md) z sapp był "zajebisty" w rozpoznawaniu sklepu,
   przenosimy tę logikę. ALE obsługa produktów ma działać INACZEJ niż w sapp:
   - Łapanie produktów + wrzucanie do kategorii — jak było.
   - Kategorie — zostają z sapp (ta sama taksonomia).
   - NOWE: porządny edytor produktów — gdy parser złapie np. "KETCH. DAWTONA 400g",
     ma rozpoznać to jako wariant istniejącego produktu "Ketchup Dawtona" (fuzzy
     matching po słowach) i POKAZAĆ WARIANTY zamiast tworzyć nowy wpis za każdym
     razem gdy nazwa z paragonu różni się (user: "ket.dawt.", "ketchup daw. 400g",
     "ketchup 400g" nie mogą tworzyć 10 osobnych produktów). Musi być gdzieś
     dostępne RĘCZNE łączenie duplikatów + poprawianie nazw (user explicitly chce
     móc to zrobić samemu, nie tylko automat).
   - **Dopisane**: lepsze rozpoznawanie czy produkt JEST czy NIE JEST jedzeniem
     (user: "lepiej rozwiązać produkty które są i nie są jedzeniem, może
     rozpoznawanie jakieś?"). Najprostszy sensowny kierunek do rozważenia przy
     projektowaniu: status "to jedzenie" wynika z PRZYPISANEJ KATEGORII (jeśli
     kategorie z sapp już grupują się np. Jedzenie/Słodycze/Napoje vs
     Chemia/Kosmetyki/Elektronika), nie osobny klasyfikator po nazwie — prościej,
     spójne z "kategorie zostają z sapp" wyżej. Dashboard sapp2 ma już kafelek
     "DZIENNIE #JEDZENIE" / "#JedzeniePerMiesiąc" który będzie to konsumował.
3. **Praca, Daily itp.** — dopiero po kalendarzu i finansach.
- **Nie zaczęte** — to jest zakres na WIELE kolejnych sesji, nie jeden build. Przed
  pisaniem kodu trzeba przejrzeć implementację kalendarza w sapp (store, ekrany,
  Google Calendar sync) i rozpisać plan portu/adaptacji do sapp2, zaktualizować
  ARCHITECTURE.md — dokładnie tak jak user poprosił ("z głową").
