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
