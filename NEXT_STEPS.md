# NEXT_STEPS.md — sapp2

Co dalej / otwarte wątki między sesjami. Jedyne miejsce w repo śledzące to na bieżąco —
aktualizuj po skończeniu/odkryciu czegoś nowego (patrz `CLAUDE.md`).

## Zdecydowane, jeszcze niezbudowane

- **Domyślna ręka: prawa**, z możliwością przełączenia na lewą w ustawieniach
  (wtedy belka pewnie lustrzanie do lewej krawędzi — do dopracowania przy budowie).
  Navbar sam (prawa belka + Ustawienia w lewym dolnym rogu) już zbudowany, patrz niżej.

## NIEAKTUALNE: pomysł redesignu Pupila (roślinka zamiast bossów) — zakładka USUNIĘTA

Ten pomysł (2026-10-26, poniżej w oryginalnej treści dla historii) stał się moot
2026-11-01: user, przy Fazie 3.1 redesignu rdzenia UI, zdecydował "usuwamy pupila
zupełnie go nie będzie zakładka odpada" — `app/(tabs)/pupil.tsx` i cały navbar-wpis
usunięte z repo (patrz ARCHITECTURE.md §PUPIL, NEXT_STEPS.md "Redesign rdzenia UI").
Mechanika "roślinka" nigdy nie wyszła poza etap pomysłu, nic do migracji.

<details><summary>Oryginalna treść (2026-10-26), tylko dla historii</summary>

User: obecny Pupil (walki z bossami, mapa kampanii) jest "za bardzo grą, za mało
odzwierciedla rzeczywistość tego co robię" — raczej do wywalenia. Zakładka zostaje,
ale inna mechanika: start od ziarenka/sadzonki; podlewanie wodą i nawożenie —
surowce zdobywane z questów/zadań/ćwiczeń/picia wody (z realnej aktywności w apce,
nie z abstrakcyjnego "many/staminy"); dorosła roślinka → "ogródek", hodowanie
kolejnej; unikalne nasionka za streaki/coiny; rezygnacja z bossów/mapy
kampanii/walk (zostają tylko jako historia/inspiracja w `sapp`). Tryb focus:
aktywne pomodoro do zadania → roślinka rośnie szybciej.

</details>

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

**ROZWIĄZANE (2026-10-31)** — ten dokładny wzorzec (pływający FAB, prawy dolny róg
nad navbarem) już zbudowany i działa w Zadaniach (`app/(tabs)/tasks.tsx`,
`+ Nowe zadanie`/X toggle). Finanse dostaną ten sam wzorzec przy budowie Fazy 2 —
patrz `ARCHITECTURE.md` §FINANSE "Kolejność budowy", punkt 4. Satelickie ekrany
(Produkty — teraz w zakresie, Pojazdy — wciąż odłożone) jak opisano wyżej.

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

## Fundament logowania Google — PRZED portem kalendarza (2026-10-28)

Port kalendarza wymaga danych per-user w Firestore (`users/{uid}/...`, dokładnie jak w
sapp) — a sapp2 nie miało WCALE Firebase Auth (test "Zaloguj przez Google" w
Diagnostyce wołał tylko `GoogleSignin.signIn()`, bez żadnego linkowania do Firebase).
User wybrał (zapytany wprost): **"Wymagaj logowania Google od razu"** — bez
anonimowej sesji jak w sapp (tam Google Sign-in w Diagnostyce i tak nigdy nie dotykał
`auth.currentUser` — sapp cały czas działa na anonimowym userze, Google Sign-in tam
służy TYLKO do Google Calendar API, nie do Firebase Auth).

Zbudowane:
- `src/firebase.ts` — `auth` export (`initializeAuth` + `getReactNativePersistence`
  dynamicznie, `indexedDBLocalPersistence` jako fallback — identyczny gotcha/fix co w
  sapp `src/services/firebase.ts`).
- `src/hooks/useAuthUser.ts` — `onAuthStateChanged` wrapper, `initializing` startuje
  jako `true` ZAWSZE (nawet dla sesji z persystencji `auth.currentUser` nie jest
  ustawiony synchronicznie — Firebase i tak woła listener asynchronicznie
  przynajmniej raz).
- `src/services/googleAuth.ts` — `signInWithGoogle()`/`signOutGoogle()`. JEDYNE
  miejsce gdzie Google Sign-in realnie robi `signInWithCredential` do Firebase —
  test Diagnostyki w Ustawieniach zostaje bez zmian logiki (sam sprawdza config
  Google Cloud/Firebase Console, teraz tylko czyta `GOOGLE_WEB_CLIENT_ID` z tego
  serwisu zamiast duplikować string).
- `src/utils/userData.ts` — `userCol`/`userDoc`/`requireUid()`. Bez anonimowego
  fallbacku jak w sapp — `requireUid()` rzuca jeśli nie ma usera, bo bramka poniżej
  nie powinna nigdy dopuścić do wywołania tego bez zalogowanego usera (błąd
  programisty, nie przypadek do cichej obsługi).
- `app/login.tsx` — nowy ekran, jedyna droga do appki dla niezalogowanego usera.
  Przycisk "Zaloguj przez Google" woła `signInWithGoogle()`; po sukcesie NIE robi
  ręcznego `router.replace` — bramka w `_layout.tsx` sama przekieruje po zmianie
  stanu auth.
- `app/_layout.tsx` — `useAuthGate()`: `useSegments()[0] === 'login'` + jeden efekt
  przekierowujący w obie strony (niezalogowany gdzieś poza `/login` → `/login`;
  zalogowany wciąż na `/login` → `/`). Krótki spinner na czas `initializing`
  (pierwszy `onAuthStateChanged`, zwykle < 1 klatka) — bez tego byłby błysk złego
  ekranu na starcie appki.
- `app/settings.tsx` — nowa sekcja "Konto" (e-mail zalogowanego usera + "Wyloguj")
  tak żeby logowanie nie było dead-endem bez możliwości wylogowania (zasada #7).
  `SECTIONS` zmienione ze statycznej stałej na `buildSections(email)` wołane przez
  `useMemo` w komponencie, bo e-mail jest dynamiczny (wcześniej cała lista sekcji
  była całkowicie statyczna).
- Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
  bundluje się bez błędów (3252 modułów).
- **Niezweryfikowane na urządzeniu** — czeka na build i realny test logowania/
  wylogowania usera (dev-client wymagany, `@react-native-google-signin` nie działa
  w Expo Go — identycznie jak istniejący test Diagnostyki).
- **Dalej**: Faza 1a kalendarza (port warstwy danych) — patrz sekcja niżej, zaczęta
  RÓWNOLEGLE z czekaniem na weryfikację logowania na urządzeniu (user: "już teraz
  zacznij przygotowywać kod Fazy 1a" — bezpieczne, bo to nowe izolowane pliki, nic
  nie dotykają istniejących ekranów).

## Faza 1a kalendarza — port warstwy danych (2026-10-28)

Port z sapp, logika 1:1 gdzie się da, bez UI (to Faza 1b, dopiero po tej i po
Finansach — patrz "Następna wielka faza" wyżej). Zbudowane:

- `src/types/calendar.ts` — `CalendarEvent`/`eventCoversDay`/`isMultiDay` bez zmian.
  `Task` TRIMMED — usunięte `counterId` (Licznik, nie istnieje w sapp2),
  `classEventId`/`classEventLabel`/`classReminderMinutesBefore` (Plan zajęć,
  sapp-only), `postCompletionMood` (tracker nastroju, nie portowany), oraz
  `kind`/`waitingFor`/`wakeAt` (model quick/deep/waiting — ARCHITECTURE.md mówi
  wprost "UI/UX zupełnie nowy" dla Zadań, więc ciągnięcie starego modelu
  klasyfikacji do warstwy danych PRZED zaprojektowaniem nowego UX byłoby
  zgadywaniem, nie portem).
- `src/utils/date.ts` — tylko `ymd`/`todayISO` (jedyne dwie funkcje z sapp'owego
  `date.ts`, których ten port faktycznie potrzebuje — reszta jak/kiedy coś z niej
  zacznie korzystać, nie z wyprzedzeniem).
- `src/services/calendarService.ts` — Firestore CRUD (events + tasks), 1:1 logika.
  Różnica: `userCol`/`userDoc` (sapp2) są SYNCHRONICZNE (bez `await` przed nimi) —
  sapp2 nie ma anonimowego auto-logowania do wyczekania jak sapp.
- `src/utils/googleCalendarMap.ts` — `mapEvent` (GCal event → `CalendarEvent`),
  czysta funkcja, bez zmian.
- `src/services/googleCalendarService.ts` — REST wrapper na Google Calendar API,
  1:1 logika. Różnica: `GoogleSignin` importowany DYNAMICZNIE w `refreshToken()`
  (jedyne miejsce gdzie jest potrzebny) — sapp go importuje statycznie na górze
  pliku, co u nas jest zabronione (natywny moduł, zero w Expo Go — statyczny import
  wywaliłby appkę, jeśli cokolwiek co importuje ten serwis zdąży się zamontować w
  Expo Go).
- `src/store/calendarStore.ts` — Zustand + `persist`, 1:1 logika/shape. Różnica:
  zwykły `createJSONStorage(() => AsyncStorage)` zamiast sapp'owego
  `throttledPersistStorage()` — ten throttling tam istnieje bo profiling na
  REALNYCH, dużych danych (wydatki) złapał konkretny zmierzony koszt; dodawanie go
  tu teraz, zanim istnieje jakikolwiek dowód tego samego problemu, byłoby "burdel
  pod przyszłość" (CLAUDE.md) — dodamy jeśli/kiedy profiling na sapp2 to pokaże.
- Ustawienia → Diagnostyka → nowy test **"Sync kalendarza (dane)"** —
  weryfikuje warstwę danych PRZED jakimkolwiek UI (jak poprosił user): round-trip
  dodaj→odczytaj→zmień→usuń, osobno dla Firestore (`calendarService`) i dla
  PRAWDZIWEGO Google Calendar (`googleCalendarService` — tworzy, modyfikuje, czyta
  przez `fetchEvents`, usuwa; kończy się usunięciem, więc nie zaśmieca realnego
  kalendarza usera).
- Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
  bundluje się bez błędów.
- **Niezweryfikowane na urządzeniu** — nowy test "Sync kalendarza (dane)" wymaga
  dev-client buildu (jak każdy test z `@react-native-google-signin`) ORAZ
  wcześniejszego zalogowania (żeby `googleCalendarService` miał token).
- **Dalej, dopiero po Finansach/parserach (kolejność faz niezmienna)**: Faza 1b —
  nowy UI Zadania/Kalendarz (NIE kopiowany z ~4400 linii ekranów sapp), reużywający
  tylko logikę sekcji TERAZ/bezterminowe/terminowe. Widget na pulpicie Androida —
  osobna, odłożona sesja (native/config-plugin heavy), nie wrzucać do UI Zadań.

## Test na urządzeniu build #39 — wyniki i poprawki (2026-10-28)

User przetestował build #39 (logowanie + Faza 1a). Wyniki:
1. **Logowanie działa** ✅ (po włączeniu Firebase Authentication w konsoli, patrz
   INFRA.md).
2. **BUG: back w Ustawieniach wychodził od razu do Dashboardu** zamiast cofać do
   listy kategorii, gdy user był w rozwiniętej sekcji. Root cause: sprzętowy/gestowy
   przycisk "wstecz" na Androidzie POMIJA customowy `handleBack` (ten łapie tylko tap
   w `ChevronLeft`) — expo-router po prostu zdejmuje `/settings` ze stosu. Dokładnie
   ten sam bug co kiedyś w sapp. **Fix**: `BackHandler.addEventListener` w
   `app/settings.tsx`, przechwytuje sprzętowe wstecz gdy `activeSectionId`/`query` są
   ustawione (ten sam wzorzec co sapp).
3. **Sync kalendarza (dane)** ✅ — Firestore i Google Calendar round-trip oba OK
   (screenshot od usera: "Google ok — dodano/zmieniono(true)/fetchEvents znalazł
   3/usunięto(true)", "Firestore ok — dodano/odczytano(1)/zmieniono/usunięto"). Faza
   1a warstwy danych ZWERYFIKOWANA na realnym urządzeniu.
4. **Navbar — zmiana stylu**: user po zobaczeniu na żywo chce KÓŁKO zamiast
   zaokrąglonego kwadratu na aktywnej odznace (`iconBadge`/`iconBadgeActive` w
   `TabBar.tsx`, `borderRadius: 13` → `radius.full`).
5. **Wylogowanie + ponowne logowanie** ✅ działa.
6. **BUG: alerty notifee kompletnie ciche** (ani dźwięk, ani popup, ani wybudzenie,
   ani fullscreen) — REGRESJA względem poprzedniej rundy, gdzie wariant Tak/Nie
   przynajmniej dawał heads-up z przyciskami (nie full-screen, ale coś). Jedyny
   zadziałał test "Expo (MAX priorytet)", i to tylko jako zwykłe basic powiadomienie.
   Root cause (najbardziej prawdopodobny): poprzedni fix (`createTriggerNotification`
   z `alarmManager.allowWhileIdle`) ustawia DOKŁADNY alarm
   (`setExactAndAllowWhileIdle` pod spodem) — od Androida 12 to wymaga
   `SCHEDULE_EXACT_ALARM` w manifeście (NIE było dodane), a od Androida 13+ user może
   dodatkowo musieć ręcznie włączyć to w Ustawienia -> Aplikacje -> Sapp2 -> Alarmy i
   przypomnienia. Bez tego alarm NIE rzuca błędem (log pokazuje "Zaplanowano"), tylko
   cicho degraduje się do niedokładnego/odłożonego — efektywnie nigdy nie odpala się
   w czasie testu. **Fix**: dodane `android.permission.SCHEDULE_EXACT_ALARM` do
   `app.json` (zweryfikowane lokalnie przez `expo prebuild` że ląduje w
   AndroidManifest.xml), plus dopisany hint w logu testu o sprawdzeniu systemowego
   przełącznika jeśli nadal cicho.
   - **Niezweryfikowane na urządzeniu** — czeka na nowy build + test. Jeśli nadal
     cicho mimo permission w manifeście, user będzie musiał ręcznie włączyć "Alarmy i
     przypomnienia" w systemowych ustawieniach appki (Android 13+ to user-grantable,
     nie auto-grant).
   - **Prawdziwy full-screen-over-lockscreen wciąż NIE zweryfikowany** nawet przed tą
     regresją (user: "szkoda tylko jeszcze bym dodał te full screen") — do zbadania w
     kolejnej rundzie PO potwierdzeniu że alert w ogóle znów coś robi: może wymagać
     ręcznego włączenia "Pełnoekranowe powiadomienia" (Android 14+, już
     udokumentowane wyżej) niezależnie od exact-alarm fixa.

Zweryfikowane lokalnie: `npx tsc --noEmit` czysto, `npx expo prebuild` (manifest ma
`SCHEDULE_EXACT_ALARM`), `npx expo export --platform android` bez błędów.

## Alert notifee — DALEJ kompletnie cicho po SCHEDULE_EXACT_ALARM (2026-10-28)

User zbudował #41, dał pełne zgody ręcznie w systemowych ustawieniach — alert dalej
nic nie robi (ani dźwięk, ani popup, ani wybudzenie, ani fullscreen): "Powiadomienia
nadal nie działają mimo zgody pełnej w ustawieniach". To już DRUGI fix z rzędu który
nie pomógł — zamiast zgadywać trzeci na ślepo, `sendNotifeeAlert` w
`app/settings.tsx` przebudowany na DIAGNOSTYCZNY: zamiast jednego opóźnionego
triggera, robi teraz DWIE niezależne rzeczy i loguje każdy krok:
1. `notifee.displayNotification(...)` NATYCHMIAST (zero AlarmManager/exact-alarm) —
   izoluje czy problem jest w zgodzie/kanale/samym notifee, czy konkretnie w
   opóźnionym planowaniu. Jeśli TEGO user nie zobaczy/usłyszy od razu (appka wciąż
   otwarta na ekranie), wina leży wcześniej w łańcuchu, nie w triggerze.
2. `createTriggerNotification` jak dotąd (za 5s) + zaraz po `getTriggerNotificationIds()`
   zalogowane do UI — pokaże wprost czy system W OGÓLE przyjął ten trigger (pusta
   lista = cicho odrzucony mimo że `await` nie rzucił błędem).
3. Dodatkowo zalogowany `settings.authorizationStatus`, `channelId`, oraz `e?.code`
   przy błędzie (notifee errors często niosą kod) — więcej sygnału niż poprzednio.
- **Cel**: następny build ma OD RAZU powiedzieć gdzie dokładnie się psuje, zamiast
  kolejnej rundy "zgadnij-zbuduj-czekaj-zgadnij". Po teście usera: jeśli (1) też
  cicho → problem w zgodzie/kanale/OEM (np. agresywne oszczędzanie baterii blokujące
  powiadomienia, częste na niektórych markach telefonów) niezależnie od
  AlarmManager. Jeśli (1) działa ale (2) nie (lub `getTriggerNotificationIds()`
  zwraca pustą listę) → problem konkretnie w exact-alarm/AlarmManager mimo
  manifestowego permission.
- Zweryfikowane lokalnie: `npx tsc --noEmit` czysto, `npx expo export --platform
  android` bez błędów. **Niezweryfikowane na urządzeniu.**

## Kopiowanie logu w Ustawieniach (2026-10-29)

User: "dodaj tam kopiowanie logów, będzie szybciej" (zamiast screenshota przy każdej
rundzie diagnostyki). Dodane `expo-clipboard` (`Clipboard.setStringAsync`) +
przycisk "Kopiuj log" nad listą logów w Konto/Diagnostyka/Alerty — kopiuje dokładnie
to co widać na ekranie (ten sam porządek co `log`, najnowsze na górze). Zweryfikowane:
`npx tsc --noEmit` czysto, `npx expo export --platform android` bez błędów.

## Navbar — kolor tła dopasowany do kafelków (2026-10-29)

User: "ogarnij żeby ten navbar był w szarym tym co mamy inne kafelki" — `TabBar.tsx`
(`settingsBtn`/`cluster`) używał `c.bg.elevated` (#14171F, lekko niebieskawy), a
wszystkie kafelki Dashboardu (StatTile, FoodBarsTile, LevelTile,
PatternTileBackground) konsekwentnie używają `c.bg.card` (#141414, neutralny szary).
Zmienione na `c.bg.card` dla spójności. Zweryfikowane: `npx tsc --noEmit` czysto,
`npx expo export --platform android` bez błędów.

## Szkielety ekranów: Daily/Zadania/Finanse (2026-10-29)

User: "zacznij budować szkielet tak jak opisywałem pod finanse, kalendarz, zadania,
itp". Zapytany wprost o zakres — potwierdzone: **lekka struktura nawigacyjna wg
ARCHITECTURE.md**, bez głębokiej logiki (parser paragonów, edytor produktów,
prawdziwe dane kalendarza w UI) — to wciąż wchodzi w ustalonej, niezmiennej
kolejności faz: Kalendarz/Zadania UI (Faza 1b) → Finanse+parsery (Faza 2) →
Praca/Daily (Faza 3). Trzy zakładki zamienione z gołego `PlaceholderScreen` na
poukładaną strukturę:

- **`app/(tabs)/daily.tsx`** — sekcje Zdrowie(woda)/Ćwiczenia/Kroki/Waga/Humor, 1:1
  z ARCHITECTURE.md §DAILY. JEDZENIE świadomie pominięte (user w sapp: "nie
  sprawdzała się", ARCHITECTURE.md: "zostawiamy potencjał/miejsce, NIE dodajemy jej
  teraz") — zero karty, nie tylko wyłączona.
- **`app/(tabs)/tasks.tsx`** — statyczny pasek BIEŻĄCEGO tygodnia (Pon-Nd, dziś
  podświetlone, ŻADNYCH prawdziwych wydarzeń — to wymaga podpięcia
  `calendarStore`, które czeka na Fazę 1b) + trzy sekcje TERAZ/Bezterminowe/
  Terminowe (logika z sapp #42, UI/UX od zera — tu na razie tylko nagłówki +
  empty state).
- **`app/(tabs)/finances.tsx`** — karta salda (placeholder "0,00 zł"), "Ostatnie
  transakcje" (empty state, docelowo max 3-4 pozycje, nie cała lista — §FINANSE),
  Praca/Subskrypcje jako wiersze. POJAZDY/PRODUKTY świadomie pominięte (§FINANSE:
  "odłożone na koniec"). Zunifikowany FAB "dodaj" też pominięty — czeka na
  rozstrzygnięcie "Kolizja lewy dolny róg" (patrz niżej w tym pliku) żeby nie
  dublować miejsca z Ustawieniami.
- **`src/components/ui/ComingSoonRow.tsx`** — nowy, współdzielony wiersz "ikona +
  etykieta + odznaka Wkrótce" (Daily sekcje, Finanse Praca/Subskrypcje — ten sam
  kształt w obu miejscach, stąd jeden komponent zamiast kopiowania). Celowo `View`
  nie `TouchableOpacity` — nic tu jeszcze nigdzie nie prowadzi.
- **Pupil NIE dotknięty** — zostaje `PlaceholderScreen`, bo jego mechanika
  ("roślinka zamiast bossów") to dopiero pomysł do zaprojektowania od zera, nie ma
  jeszcze struktury (sekcji/podekranów) żeby ją zeszkieletować bez zgadywania.
- Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
  bez błędów. Czysto wizualne — brak logiki do testowania na urządzeniu poza "czy
  się nie wywraca i wygląda spójnie z resztą appki".
- **Dalej**: Faza 1a (warstwa danych kalendarza) jest już zweryfikowana na
  urządzeniu (test "Sync kalendarza (dane)", build #39) — następny krok to Faza 1b,
  pełna logika Kalendarza/Zadań (podpięcie `calendarStore`/`calendarService`/
  `googleCalendarService` pod te ekrany, prawdziwe dane zamiast empty-state), PRZED
  Finansami, zgodnie z ustaloną kolejnością.

## Alert notifee — fullscreen DZIAŁA, dedykowany ekran + wibracja (2026-10-29)

Pierwsza na urządzeniu potwierdzona kamień milowy: user po buildzie z
SCHEDULE_EXACT_ALARM + diagnostycznym teście — "chyba full screen alert działa...
jak wyjdę z apki to pokazuje zablokowany ekran [i launchuje appkę nad nim]". Czyli
natywny `fullScreenAction` (plugin `withFullScreenAlert.js` + `USE_FULL_SCREEN_INTENT`
+ `SCHEDULE_EXACT_ALARM`) faktycznie działa, gdy appka jest w tle — pierwsze
potwierdzone działanie tego mechanizmu w całej sadze. Dwa pozostałe problemy:
1. Brak dźwięku/wibracji nadal.
2. Launch ląduje w ostatnio otwartym ekranie appki (np. Ustawienia), nie w
   dedykowanym "ekranie alarmu" — user: "trzeba dostosować okno alertu osobne...
   żeby nie cała apka była tylko alarm screen testowy z wibracjami lub dźwiękiem".

Zbudowane w odpowiedzi:
- **`app/alert-test.tsx`** — nowy, dedykowany pełnoekranowy ekran alarmu (duża
  ikona, tytuł, przycisk "Wyłącz"). Wibracja przez WBUDOWANE RN `Vibration.vibrate`
  (pętla, zero nowej zależności/assetu) — odpala się przy montowaniu, zatrzymuje na
  dismiss/unmount. To bezpośrednio rozwiązuje połowę problemu #1 (wibracja).
- **`src/hooks/useNotifeeAlertLaunch.ts`** — deep-link z powiadomienia na ten
  ekran: `getInitialNotification()` (cold start) + `onForegroundEvent` (wznowienie
  z tła) + `onBackgroundEvent` (appka w tle, nie zabita — dokładnie scenariusz
  który user przetestował), wszystko za dynamicznym importem notifee (zasada appki
  — zero statycznych importów natywnych modułów poza handlerami). Rozwiązuje #2.
- **`app/_layout.tsx`** — wywołuje `useNotifeeAlertLaunch()`.
- **`app/settings.tsx`** — oba powiadomienia (natychmiastowe + trigger) dostały
  `data: { route: 'alert-test' }`, żeby hook wyżej wiedział że TO konkretnie ten
  alert, nie jakiekolwiek inne powiadomienie appki w przyszłości.
- **DŹWIĘK ŚWIADOMIE POMINIĘTY na razie** — wymaga pliku audio do zbundlowania w
  `assets/`, którego appka jeszcze nie ma. User: "dostosowywanie później w
  ustawieniach czy coś" — zaakceptowane jako kolejny, osobny krok (potrzebny plik
  dźwiękowy od usera albo wybór jednego do dodania), nie blokuje tej rundy.
- Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
  bez błędów. **Niezweryfikowane na urządzeniu** — czeka na build i realny test:
  czy launch teraz faktycznie ląduje na `/alert-test` (nie w Ustawieniach), czy
  wibracja się odpala.

## Domyślny dźwięk (loopSound) + test wybudzenia OLED (2026-10-29)

User: "dodaj na razie domyślny [dźwięk], żeby potem customowy cały ekran" + "musimy
sprawdzić czy np po 5 min ekran się wybudzi sam z ekranem alarmu, czy będzie ciemny
i będzie grał, bo to OLED screen".

- **`loopSound: true`** dodane do wspólnego `android` configu w `sendNotifeeAlert`
  (`app/settings.tsx`) — zero nowego pliku audio: ustawia natywny
  `FLAG_INSISTENT`, więc DOMYŚLNY systemowy dźwięk kanału (`sound: 'default'`)
  powtarza się w pętli aż notyfikacja zostanie otwarta/anulowana, zamiast zagrać
  raz i ucichnąć. Prawdopodobne wyjaśnienie dlaczego wcześniej "nie było dźwięku"
  — pojedynczy krótki systemowy "ding" łatwo przegapić w trakcie przejścia na
  pełny ekran.
  - **Zapisane pod przyszłą customizację** (user: "żeby potem customowy cały
    ekran") — warstwa notyfikacji (ten plik, systemowy dźwięk+loopSound) i warstwa
    ekranu alarmu (`app/alert-test.tsx`, wibracja) są już naturalnie rozdzielone.
    Gdy user poda/wybierze własny plik audio: dodać go do `assets/`, zastąpić
    `sound: 'default'`/`loopSound` odtwarzaniem pętli tego pliku przez `expo-av`
    BEZPOŚREDNIO w `alert-test.tsx` (tak jak już robi to `Vibration.vibrate`
    tam) — izolowana zmiana, nie przepisywanie całości.
- **Nowy test "Notifee za 5 min (test OLED)"** w Ustawienia -> Alerty —
  `sendNotifeeAlert` sparametryzowane przez `delayMs` (domyślnie 5000, tu
  `5*60*1000`). Cel: krótki 5s test nie sprawdza czy ekran FIZYCZNIE wybudza się
  z głębokiego uśpienia/OLED całkowicie czarnego ekranu, tylko czy mechanizm w
  ogóle działa zanim telefon zdąży zejść w głębszy stan oszczędzania energii —
  user ma zamknąć appkę, zablokować ekran, odłożyć telefon na 5 min i sprawdzić
  czy ekran sam się włączy z ekranem alarmu (dobry znak) czy zostanie czarny i
  tylko zagra dźwięk/zawibruje w tle (zły znak — oznaczałby że `turnScreenOn`
  działa tylko w krótkim oknie, nie po głębszym uśpieniu).
- Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
  bez błędów. **Niezweryfikowane na urządzeniu.**

## Build #47 test — postęp + prawdziwy bug "5 min" (2026-10-29)

User przetestował build #47: wibracja działa, deep-link na ekran "Alarm testowy"
działa dla wszystkich wariantów notifee (bez przycisku/Tak-Nie/5min — user: "nie
widzę różnicy XD", oczekiwane, bo pełnoekranowy launch pomija banner z
przyciskami). Dźwięk DALEJ cichy mimo `loopSound`. I **realny bug**: kliknięcie
"za 5 min" odpalało się OD RAZU, nie po 5 minutach.

Root cause bugu "5 min": `sendNotifeeAlert` zawsze najpierw wołało
`notifee.displayNotification(...)` (część "NATYCHMIAST" z rundy diagnostycznej),
NIEZALEŻNIE od `delayMs` — to ONO przekierowywało na `/alert-test` natychmiast,
maskując fakt że właściwy, opóźniony trigger w ogóle nie został sprawdzony. Test
OLED (cel: sprawdzić czy ekran się budzi po realnym, dłuższym uśpieniu) nigdy się
nie wykonał.

Fix:
- `sendNotifeeAlert` dostało trzeci parametr `includeInstant` (domyślnie `true`,
  zachowuje istniejące zachowanie 5s-testów) — `displayNotification` teraz
  warunkowe.
- Handler `alert-notifee-5min` woła `sendNotifeeAlert(false, 5*60*1000, false)` —
  TYLKO trigger, bez instant-części. Teraz kliknięcie tego przycisku faktycznie
  nic nie pokazuje od razu (poprawne!) i dopiero po 5 min powinien odpalić się
  prawdziwy alarm.
- Kanał zbumpowany `-v2` → `-v3` — drugi strzał w ciszę dźwięku tym samym fixem
  co poprzednio zadziałał (niemutowalny kanał, możliwa stała zła rejestracja).
- Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
  bez błędów. **Niezweryfikowane na urządzeniu** — czeka na realny test 5-min
  (teraz faktycznie testujący to co ma) + sprawdzenie czy `-v3` pomogło dźwiękowi.
- **Jeśli `-v3` NIE pomoże dźwiękowi**: kolejna hipoteza do zbadania — fullscreen-
  intent launch może z natury tłumić dźwięk kanału na niektórych
  urządzeniach/wersjach Androida (aplikacja budzika "zjada" powiadomienie
  natychmiast otwierając Activity, zanim user usłyszy cokolwiek) — wtedy jedyne
  rozwiązanie to własne odtwarzanie dźwięku z `app/alert-test.tsx` (jak wibracja),
  co wymaga pliku audio od usera (patrz sekcja "Domyślny dźwięk" wyżej — user
  jeszcze nie podał/wybrał pliku).

## KRYTYCZNE: dziura bezpieczeństwa — cała appka omijała blokadę ekranu (2026-10-30)

User złapał na urządzeniu: "ta aplikacja cała się buguje bo działa na OFFSCREENIE
CAŁA — a miał być tylko ALARM na OFFSCREENIE... nie chcę żeby ktoś na
zablokowanym telefonie mógł [finanse] przeglądać". Root cause: `plugins/
withFullScreenAlert.js` (wersja 1) ustawiało `android:showWhenLocked`/
`android:turnScreenOn` na STAŁE w manifeście na `MainActivity` — a że CAŁA appka
(expo-router) żyje w JEDNEJ Activity, to oznaczało że przy KAŻDYM wznowieniu
appki na zablokowanym telefonie (nie tylko przez alert), cała appka (łącznie z
przyszłymi Finansami) pokazywała się nad blokadą BEZ odblokowania. To było
dokładnie to ryzyko opisane już w komentarzu wersji 1 ("do oceny po teście, nie
ukrywać") — potwierdziło się.

**Fix (priorytetowy, wypchnięty przed dalszą pracą nad Kalendarzem/Zadaniami):**
- `plugins/withFullScreenAlert.js` v2 — ZERO statycznych flag w manifeście.
  Zamiast tego natywny moduł `LockScreenModule` (Kotlin, wstrzyknięty przez
  `withDangerousMod` + zarejestrowany przez `withMainApplication`/
  `mergeContents` — DOKŁADNIE ten sam wzorzec co `withTasksWidget.js` w sapp)
  przełącza `Activity.setShowWhenLocked()`/`setTurnScreenOn()` **W LOCIE** (API
  27+, Android dodał te metody właśnie po to — pokazywanie KONKRETNEGO ekranu
  nad blokadą, nie całej appki).
- `src/services/lockScreen.ts` — JS most (`NativeModules.LockScreen`), jedyne
  dozwolone miejsce wołania.
- `app/alert-test.tsx` — JEDYNE miejsce w appce gdzie to się włącza: `true` na
  mount, `false` na unmount/dismiss. Żaden inny ekran (Dashboard, Ustawienia,
  przyszłe Finanse) nigdy tego nie woła, więc nigdy nie omija blokady.
- Zweryfikowane lokalnie: `npx expo prebuild` → `android:showWhenLocked`/
  `turnScreenOn` NIE WYSTĘPUJĄ już nigdzie w wygenerowanym
  `AndroidManifest.xml` (grep pusty, potwierdzone), `LockScreenModule.kt`/
  `LockScreenPackage.kt` wygenerowane poprawnie, rejestracja w
  `MainApplication.kt` poprawna. `npx tsc --noEmit` czysto, `npx expo export`
  bez błędów.
- **Niezweryfikowane na urządzeniu**: (a) czy Kotlin się kompiluje w CI (lokalnie
  nie da się bez pełnego Android toolchaina — to sprawdzi dopiero build), (b)
  czy alarm dalej poprawnie pokazuje się nad blokadą z tym nowym, dynamicznym
  mechanizmem (powinien, ale wymaga realnego testu identycznego jak poprzednio
  — zablokuj ekran, poczekaj na trigger), (c) że ZWYKŁE używanie appki (Dashboard
  itp.) na zablokowanym telefonie TERAZ wymaga normalnego odblokowania (to jest
  POPRAWNE, oczekiwane zachowanie, nie regresja).

## Dashboard — redesign na monochromatyczny (2026-10-30)

User: "zmieniłem trochę styl nasz na bardziej prostszy... wywaliłem gradienty i
poprawiłem monochromatyczność... TAKI STYL PRZYJMUJEMY DLA CAŁEJ APLIKACJI OD
TERAZ" + podesłał dokładny SVG-referencję (eksport Figmy) + screenshot.
Wyciągnięte z SVG wszystkie użyte kolory (grep `fill="#..."`): okazało się że to
PRAWIE WYŁĄCZNIE skala szarości — `#141414` (= nasz `bg.card`, już pasował),
`#D6D6D6` (= nasz `text.primary`, już pasował), `#ECECEC` (jaśniejszy biały,
NOWY — dodany jako `text.bright`), `#6A6A6A`/`#0A0A0A` (= nasze
`chart.muted`/`chart.barBg`, już pasowały). JEDYNY nie-neutralny kolor w całym
SVG to niebieski `#1B36AF` — dokładnie kolor chipa taga "UR" w TaskListTile,
czyli funkcjonalne akcenty (tagi) ZOSTAJĄ kolorowe, tła/liczby kafli — NIE.

Usunięte ze WSZYSTKICH kafli Dashboardu:
- Gradienty tła (pionowe w StatTile, po skosie w PatternTileBackground/
  FoodBarsTile, fade-w-prawo per-tag w TaskListTile) — teraz płaskie `c.bg.card`.
- Kolorowanie dużych liczb/etykiet/ikon `accent`-em per-kategoria (`colors.stat.*`)
  — `accent` prop CAŁKOWICIE USUNIĘTY z API StatTile/FactTile/SleepTile/
  PatternTileBackground (nic go już nie używało po usunięciu gradientu).
- FoodBarsTile: kolumna "average" (~ŚR) przestała być specjalnie kolorowana —
  w referencji tylko OSTATNIA (bieżący miesiąc) kolumna jest jaśniejsza, reszta
  (w tym average) jednolicie szara.
- LevelTile: etykieta "LVL" z `accent.red` na neutralny `text.secondary`.
- ConcentricPattern (FactTile/SleepTile tło): pierścienie z accent-koloru na
  neutralny `chart.muted`, nie usunięte całkiem (user mówił o gradientach, nie o
  samym wzorze).
- `app/(tabs)/finances.tsx` — wartość salda z `colors.stat.finanse` na
  `colors.text.bright`, spójnie z resztą (ComingSoonRow accenty/dziś-podświetlenie
  w Zadaniach ŚWIADOMIE zostawione kolorowe — to small functional accenty jak
  tagi, inny przypadek niż duże liczby/gradienty kafli, których dotyczyła
  referencja).
- `src/theme/colors.ts`: dodany `text.bright: '#ECECEC'`.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
bez błędów. **Niezweryfikowane na urządzeniu** — czeka na build i porównanie z
referencyjnym screenshotem.

## Build #51 feedback — dokończenie monochromatyczności + realne Zadania/Kalendarz (2026-10-30)

User odpowiedział na build #51 screenshotem z adnotacjami (zaznaczone na turkusowo)
+ tekstem: "wywal te ikonkę przy ciekawostkach", "w wydatkach jedzenia brakuje tam
prostokąt przy średniej", "zakładki inne nie machają stylu... ustawienia tez...
ogarnij to teraz", "Kalendarza tez nie ogarnąłeś... w zakladce nie widac niczego
ani zadan ani kalendarza podpiętego". Trzy osobne rzeczy:

**1. Dwie konkretne poprawki Dashboardu:**
- `FactTile.tsx` — ikona `Globe` USUNIĘTA CAŁKOWICIE (nie zastąpiona niczym), user
  zaznaczył ją bezpośrednio na screenshocie. Kafel to teraz czysty wycentrowany tekst.
- `FoodBarsTile.tsx` — kolumna "average" (~ŚR) dostała z powrotem PROSTOKĄT (wcześniejszy
  redesign zostawił tylko cienką kreskę `avgLine`, user: "brakuje tam prostokąt") —
  teraz słupek tej samej wysokości co inne (proporcjonalnej do wartości), ale z
  przerywaną ramką zamiast wypełnienia (`avgBar`, `borderStyle: 'dashed'`) — odróżnia
  wartość odniesienia od realnych miesięcy, bez całkowitego zanikania.

**2. Monochromatyczny audyt ROZSZERZONY na całą appkę — poprzednia nota (wyżej,
sekcja "Dashboard — redesign") że "ComingSoonRow accenty/dziś-podświetlenie w
Zadaniach ŚWIADOMIE zostawione kolorowe" była BŁĘDNA — user explicite: "zakładki
inne nie machają stylu miałeś wszystko robic w tym stylu, ustawienia tez".
Usunięte kolorowanie per-kategoria z:**
- `ComingSoonRow.tsx` — `accent` prop CAŁKOWICIE USUNIĘTY z API (odznaka ikony
  teraz neutralna `c.bg.elevated` + `colors.text.secondary`, tak jak odznaki w
  Ustawieniach).
- `app/(tabs)/daily.tsx` — `accent` per-sekcja (woda/ćwiczenia/kroki/waga/humor)
  usunięty z danych `SECTIONS`.
- `app/(tabs)/finances.tsx` — `accent` usunięty z obu wywołań `ComingSoonRow`
  (Praca/Subskrypcje).
- `app/settings.tsx` — NAJWIĘKSZA zmiana: `color`/`accent` usunięte z typów
  `SettingsSection`/`SettingsItem` i z `buildSections()` (każda kategoria/pozycja
  miała swój kolor: niebieski Konto, żółty Info, czerwony Diagnostyka/Alerty per-item
  różne kolory, zielony Finanse) — wszystkie odznaki ikon (`categoryIcon`/`itemIcon`)
  teraz jednolicie neutralne (`c.bg.elevated` + `colors.text.secondary`).
- Dzień "dziś" na pasku tygodnia w Zadaniach przy okazji przebudowy (patrz pkt 3
  niżej) też przestał być `colors.accent.blue` — teraz `c.text.bright` (biały),
  spójnie z aktywną zakładką w TabBar (białe kółko, nie kolor).
- **TabBar.tsx NIE dotknięty** — już wcześniej monochromatyczny (żadnego `accent`
  per-zakładka, potwierdzone przy poprzednim audycie).
- Jedyne kolory które ZOSTAJĄ w całej appce: chip taga w TaskListTile/TaskRow
  (funkcjonalny akcent na poziomie POJEDYNCZEGO zadania, nie kategorii ekranu —
  dokładnie ten jeden wyjątek z referencyjnego SVG).

**3. Realne Kalendarz + Zadania (Faza 1b) — wcześniej odłożone przez przerwanie
(dziura bezpieczeństwa), teraz zbudowane:**
- `src/components/tasks/WeekMonthCalendar.tsx` (nowy) — tydzień (domyślny, zawsze
  bieżący Pon-Nd) ↔ miesiąc (pełna siatka, nawigacja strzałkami + skrót "Dziś"),
  przełącznik = cały nagłówek karty. Kropka pod dniem = ma wydarzenie
  (`eventCoversDay` z `types/calendar.ts`, obsługuje wielodniowe). Podpięty pod
  `useCalendarStore` (`events` + `gcalEvents` razem, `selectedDate`/`setSelectedDate`
  już istniejące w store z Fazy 1a).
- `src/components/tasks/TaskRow.tsx` (nowy) — checkbox (tap = `status: 'done'`,
  znika z listy), tytuł, tagi (neutralne szare chipy — `Task.tags` nie ma pola
  koloru, w przeciwieństwie do mock-danych Dashboardu), kosz (tap = usuń od razu,
  bez potwierdzenia, świadomie proste).
- `src/components/tasks/AddTaskCard.tsx` (nowy) — przycisk "+ Nowe zadanie" →
  rozwija formularz: tytuł, tag (jedno pole tekstowe, nie lista), termin przez
  SZYBKIE WYBORY (Dziś/Jutro/Za tydzień/Bez terminu — brak zainstalowanej
  biblioteki date-pickera, te 4 opcje pokrywają realny use-case bez nowej
  zależności).
- `app/(tabs)/tasks.tsx` PRZEBUDOWANY (nie szkielet) — realne CRUD przez
  `useCalendarStore` (`addTask`/`updateTask`/`deleteTask`), kategoryzacja
  TERAZ/TERMINOWE/BEZTERMINOWE napędzana jednym polem `deadline`
  (`<= dziś` → Teraz, w przyszłości → Terminowe, brak → Bezterminowe).

**ŚWIADOME ograniczenia zakresu (udokumentowane, nie przeoczone):**
- **Offline-first, BEZ auto-sync do Firestore/Google Calendar** — CRUD z tego
  ekranu leci tylko przez `useCalendarStore` (AsyncStorage, persystuje między
  uruchomieniami appki). Pełny dwukierunkowy sync przy KAŻDEJ akcji to osobny
  kawałek pracy (konflikty, kolejka offline, itp.) — już istnieje osobny, ręczny
  test w Ustawieniach → Diagnostyka → "Sync kalendarza" (round-trip Firestore +
  Google Calendar), ale to NIE jest spięte z normalnym UI. Jeśli user chce żeby
  zadania/eventy z tego ekranu realnie szły do chmury — to następny, świadomy krok,
  nie coś co po cichu brakuje.
- **Widget na ekran główny Androida — NIE zrobiony w tej rundzie.** User prosił o
  niego wcześniej w tej samej wiadomości co kalendarz/zadania ("działające zadania
  może od razu z widgetem ogarnijmy"), ale to osobna, ciężka robota natywna
  (config-plugin + Kotlin RemoticeViews/AppWidgetProvider, podobny ciężar do
  `LockScreenModule`) — rozmyślnie odłożone, żeby nie wrzucać tego w ten sam, już
  spory commit. Zrobię jak user potwierdzi że reszta (styl + kalendarz + zadania)
  działa dobrze na urządzeniu.
- Brak pełnego date-pickera (tylko 4 szybkie opcje terminu) i braku edycji
  istniejącego zadania (tylko dodaj/ukończ/usuń) — jeśli user będzie chciał więcej
  (zmiana terminu/tagu po fakcie, wiele tagów na zadanie) to kolejna, świadoma runda.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
bez błędów. **Niezweryfikowane na urządzeniu.**

## Dashboard — szkielet "Jedzenie: rozkład wydatków" (2026-10-30)

User podesłał screenshot analogicznego widoku z `sapp` (karta "JEDZENIE ·
PAŹDZIERNIK" — suma + porównanie do zeszłego miesiąca, przełącznik
Tygodnie/Dni/Miesiące, wykres tygodniowy, lista kategorii z paskami proporcji) i
poprosił: "musimy na dashbordzie w naszym stylu dodać takie coś (tylko teraz
pewnie szkielet tego żeby nie zapomnieć pasujący ile tam miejsca tyle weźmie ten
widget) a później zapiszmy żeby wrócić jak zrobimy parser paragonów".

Dodane:
- `src/components/dashboard/FoodBreakdownCard.tsx` (nowy) — pełnowymiarowa karta
  (nie kafel w siatce `getTilePosition`, osobny pełnoszerokościowy element):
  nagłówek (ikona + "JEDZENIE · MIESIĄC" + suma), linia porównania do zeszłego
  miesiąca, przełącznik okresu (3 zakładki, TYLKO "Tygodnie" wizualnie aktywne),
  wykres słupkowy tygodni, lista kategorii (kropka koloru + pasek proporcji +
  kwota + strzałka).
- `app/(tabs)/index.tsx` — nowy wiersz pod istniejącym rzędem Finanse/wykres
  jedzenia, mock dane 1:1 z tego co user pokazał (823 zł, -38%, T1-T5, 12
  kategorii Pieczywo→Ryż i kasze).
- Dashboard dostał PIERWSZY RAZ `ScrollView` (wcześniej czysty `View` bez
  przewijania — 4 stałe rzędy zawsze mieściły się na ekranie; ta karta już nie
  mieści się, więc cały ekran musiał dostać scroll).

ŚWIADOMIE nieinteraktywne/na mocku, nie prawdziwa funkcja:
- Przełącznik Tygodnie/Dni/Miesiące — tylko wizualny stan, tap nic nie robi
  (nie ma alternatywnych danych do pokazania).
- Wiersze kategorii ("stuknij by sprawdzić produkty" w oryginale) — strzałka
  widoczna, ale BEZ `onPress`, nie ma jeszcze ekranu docelowego.
- Kolory kropek/pasków per-kategoria ZOSTAJĄ kolorowe (funkcjonalny
  legend-akcent, ta sama zasada co tagi zadań/kolory eventów Google — nie
  "kolor kategorii ekranu", więc nie łamie monochromatycznego audytu).

**DO ZROBIENIA PÓŹNIEJ (user: "zapiszmy żeby wrócić")**: podpiąć realne dane,
gdy powstanie parser paragonów + kategoryzacja wydatków (Faza 2, Finanse) —
wtedy ten kafel przestaje być mockiem, dostaje prawdziwy `total`/`weeks`/
`categories` z nowego store'a, przełącznik okresu i wiersze kategorii stają się
klikalne (nawigacja do listy produktów per kategoria, jak w `sapp`).

Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
bez błędów. **Niezweryfikowane na urządzeniu.**

## Build #58 feedback — Dashboard wraca do nieprzewijalnego, popup "#wydatki" zamiast (2026-10-31)

User ostro odrzucił poprzednią rundę: "No i huj, mieliśmy robić nie scrollowalny
ekran żeby nie było chaosu... ten widget jedzenia miałeś zrobić podobny w naszym
stylu ale nie identyczny bo on się nie mieści i dodałeś scroll ekranu... nie
chciałem tak, lepiej mniej informacji ale popup po kliknięciu na zakładkę #wydatki,
w której będzie scroll już jakby bo to popup będzie ze wszystkim co związane z
wydatkami i wtedy tam przeniesie gdzie jest kategoria jedzenie". Czyli: Dashboard ma
ZOSTAĆ nieprzewijalny (ustalenie sprzed tej sesji, które złamałem dodając
`FoodBreakdownCard` na stałe jako piąty rząd) — pełna treść ma żyć w POPUPIE z
własnym scrollem, otwieranym z kompaktowego elementu na Dashboardzie, nie jako
kolejny rząd na głównym ekranie.

Naprawione:
- `app/(tabs)/index.tsx` — ScrollView USUNIĘTY, Dashboard wrócił do czystego `View`
  z dokładnie 4 stałymi rzędami (jak przed poprzednią rundą). `FoodBreakdownCard`
  usunięty STĄD jako bezpośredni element.
- `StatTile.tsx` — dostał opcjonalny prop `onPress` (gdy obecny, kafel staje się
  `TouchableOpacity`; gdy brak — zero zmiany zachowania, zwykły `View` jak zawsze).
  Zero nowego elementu wizualnego na Dashboardzie — ISTNIEJĄCY kafel "22,4 PLN
  DZIENNIE #JEDZENIE" (rząd 4) dostał `onPress`, nic więcej się nie zmieniło.
- `WydatkiModal.tsx` (nowy) — pełnoekranowy popup (ten sam wzorzec co sapp's
  `MonthModal`: `presentationStyle="fullScreen"`, `statusBarTranslucent`), nagłówek
  "Wydatki" + X, scrollowalne ciało zawierające `FoodBreakdownCard` (bez zmian
  wewnątrz samego komponentu — tylko przeniesiony z Dashboardu do popupu).
- Otwierany tapem w kafel "22,4 PLN DZIENNIE #JEDZENIE", zamykany X albo
  sprzętowym/gestowym "wstecz" (`onRequestClose`).

Na razie w popupie jest TYLKO kategoria Jedzenie (jedyna z realną, choć mock,
treścią) — kolejne kategorie wydatków (gdy Faza 2/parser paragonów powstaną)
dojdą jako kolejne sekcje POD spodem w TYM SAMYM scrollu popupu, nie jako osobne
ekrany z własną nawigacją — user: "tam przeniesie gdzie jest kategoria jedzenie"
czytane jako "przewiń/pokaż w tym samym popupie", nie "przejdź do innego ekranu".

**Zasada na przyszłość (zapisana też w ARCHITECTURE.md §DASHBOARD)**: Dashboard
NIGDY nie dostaje scrolla. Każda treść, która nie mieści się w 4 stałych rzędach,
idzie do osobnego popupu/modala otwieranego z istniejącego lub bardzo kompaktowego
elementu — nie wydłuża głównego ekranu.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
bez błędów. **Niezweryfikowane na urządzeniu.**

## Dashboard — LVL/Pupil zastąpiony kafelkiem "najbliższy termin zadania" (2026-10-30)

User: "tam gdzie lvl27 kafelek przy zadaniach robimy tak jak na górze mamy z tym 27
min do, tylko na zadania, np 2 dni, do końca, i nazwa zadania". Placeholder
`LevelTile` (LVL + liczba, nieustalona koncepcja Pupila) obok kafla Zadań na
Dashboardzie zastąpiony tym samym wzorcem co kafel "INCOMING EVENT" w rzędzie 1
(`StatTile variant="event"`) — zero nowego komponentu, te same propsy
(`value`/`unit`/`detail`), tylko mock dane liczą czas do najbliższego terminu
zadania zamiast do eventu: `value="2" unit="DNI" detail="Projekt\nMarchewka"`
(ten sam tytuł co pilne zadanie "Projekt Marchewka" w `MOCK_TASKS` obok — spójna
narracja dwóch mock-kafli). `LevelTile.tsx` USUNIĘTY (nic go już nie używało) —
koncept Pupil/poziom wraca jako osobna decyzja później, nie jako martwy plik.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
bez błędów. **Niezweryfikowane na urządzeniu.**

## Drobna poprawka — kolejność ikon w wierszu zadania (2026-10-30)

User: "I w zadaniach na odwrót, odznaczenie po prawej a usuń po lewej" — `TaskRow.tsx`
miał checkbox (odznaczenie) z lewej, kosz z prawej; odwrócone na: kosz z lewej,
checkbox z prawej. Tylko kolejność elementów w wierszu, bez zmian logiki/zachowania.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
bez błędów. **Niezweryfikowane na urządzeniu.**

## Build #54 feedback — tygodniowy widok jak Samsung Calendar + modal zamiast stałej listy (2026-10-30)

User podesłał 2 screenshoty Samsung Calendar + feedback na build #54: "Nie o to mi
chodziło... jak w samsung calendar taki tygodniowy bo teraz za dużo miejsca jak kilka
eventów będzie zajmować dopiero po kliknięciu w dzień niech się otwiera jak tam a tak
to zadania pod spodem tylko bo one są ważne". Czyli poprzednia runda (build #54,
kafelki eventów NA STAŁE pod kalendarzem) trafiła w zły format — user chciał:
(1) widok tygodnia pokazujący WSZYSTKIE dni z ich eventami NARAZ (siatka kolumn, nie
pasek numerów), (2) szczegóły dnia TYLKO po tapnięciu (popup/modal, nie stała sekcja),
(3) Zadania bezpośrednio pod kalendarzem jako priorytet, nie odepchnięte przez listę
eventów.

Zmiany:
- `WeekMonthCalendar.tsx` — widok TYGODNIA przebudowany z "numer dnia + 1 kropka"
  na prawdziwą siatkę kolumn (jak Samsung): każda kolumna dnia renderuje WŁASNE
  wydarzenia jako małe kolorowe chipy (tytuł, do 3 na dzień, reszta jako "+N"),
  pogrupowane jednym przebiegiem (`weekEventsByDay`, `useMemo`). Cała kolumna
  (TouchableOpacity) = tap otwiera szczegóły dnia (nowy prop `onOpenDay`). Widok
  miesiąca ZOSTAJE kompaktowy (kropka — za mało miejsca w komórce na chipy), ale
  też teraz woła `onOpenDay` przy tapie, dla spójności.
- `DayDetailModal.tsx` (nowy) — modal (tło + karta wyśrodkowana, tap w tło zamyka)
  pokazujący te same `EventCard` co poprzednio, ale TYLKO gdy user tapnie dzień —
  nagłówek z pełną nazwą dnia, scrollowalna lista, pusty stan "Brak wydarzeń tego
  dnia.".
- `tasks.tsx` — USUNIĘTA stała sekcja "Dzisiaj"/lista eventów pod kalendarzem (to
  co dodałem w poprzedniej rundzie, odrzucone przez usera) — zastąpiona stanem
  `detailDate` + `DayDetailModal`. Teraz zaraz pod kalendarzem jest kompozytor
  dodawania zadania + sekcje Teraz/Terminowe/Bezterminowe, bez niczego pomiędzy —
  dokładnie układ "zadania pod spodem tylko" o który prosił user.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
bez błędów. **Niezweryfikowane na urządzeniu.**

## Build #53 feedback — kafelki eventów jak w sap (2026-10-30)

User: "pamiętasz jak był zrobiony kalendarz w sap... jak wyglądały kafelki eventów?
To tak chce tutaj tylko z domyślnie 7 dniowym widokiem". Poszedłem do `/home/user/sapp`
(oryginalny projekt, lokalnie sklonowany — osobne repo, `SokkiEltanin/sapp`) i
przeczytałem `app/(tabs)/calendar.tsx`/`src/components/calendar/TaskItem.tsx` żeby
zobaczyć DOKŁADNY layout, nie zgadywać z pamięci.

Co tam jest: pod kalendarzem (week/month) sekcja "DayDetail" pokazująca kafelki dla
ZAZNACZONEGO dnia — `eventRow`: kolorowy pasek z lewej (`event.color`, per-event z
Google Calendar) + kolumna z godziną (start/end albo "cały dzień") + tytuł/opis.
sapp2 miało tylko kropki na kalendarzu, zaznaczenie dnia nic nie pokazywało —
brakującego ogniwa.

Dodane:
- `src/components/tasks/EventCard.tsx` (nowy) — port layoutu `eventRow` 1:1 (pasek
  koloru/kolumna czasu/tytuł+opis), na tokenach kolorów sapp2. Kolor paska zostaje
  per-event kolorowy (funkcjonalny akcent jak tag zadania, nie kategoria ekranu —
  ta sama zasada co przy monochromatycznym audycie).
- `app/(tabs)/tasks.tsx` — nowa sekcja zaraz pod `WeekMonthCalendar`: nagłówek
  "Dzisiaj"/pełna nazwa dnia (`fmtDay`, port z sapp) + lista `EventCard` dla
  `selectedDate` (filtr `eventCoversDay`, sort po `startTime`, puste-najpierw).
  Pusty stan: "Brak wydarzeń tego dnia."
- Domyślny widok 7-dniowy (tydzień) — już tak było (`WeekMonthCalendar` startuje
  `expanded=false`), user to potwierdził jako chciane, nic nie trzeba było zmieniać.
- ŚWIADOMIE nieportowane z sapp: `DayTimeline` (oś czasu z slotami godzinowymi dla
  dni z eventami czasowymi), pełnoekranowy `MonthModal` z osobną listą "eventy w tym
  miesiącu", przycisk odświeżania w nagłówku, tryb "monthExpanded" (pull-to-expand).
  Kafelki (to o co user pytał) są — reszta to już inny poziom rozbudowy UI, nie
  proszony teraz.
- Kafelki NIE są klikalne (brak `onPress`) — sapp2 nie ma jeszcze ekranu
  szczegółów eventu (`/calendar/[id]`), nie zmyślam nawigacji donikąd.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
bez błędów. **Niezweryfikowane na urządzeniu.**

## Build #52 feedback — FAB zamiast pełnego wiersza + realne eventy z Google (2026-10-30)

User przetestował build #52 (screenshot Zadań) i napisał: "zależy nam na przestrzeni
bo zbijamy sporo zakładek a dodatkowo patrzymy na dostępność... chcę mieć zamiast
tam przycisk w prawym nad navbarem" + "nie widzę żadnych eventów w kalendarzu
zaciągniętych z googla jak wcześniej w sapp".

**1. "+ Nowe zadanie" z pełnoszerokościowego wiersza na pływający FAB:**
- `AddTaskCard.tsx` — PRZEBUDOWANY z własnego stanu `open`/przycisku-wyzwalacza na
  komponent KONTROLOWANY (`visible`/`onClose` z rodzica) — renderuje WYŁĄCZNIE
  formularz, `null` gdy `!visible`. Usunięty import `Plus`/stare style
  `openBtn`/`openBtnLabel`.
- `app/(tabs)/tasks.tsx` — nowy `composerOpen` (useState) + `TouchableOpacity`
  `s.fab`: okrągły przycisk 52×52, `position: 'absolute'`, `right/bottom:
  spacing[4]`, tło `c.text.bright` (jasne, jak inne akcje "aktywne" w appce), ikona
  Plus/X (toggle — X gdy formularz otwarty, też zamyka). WAŻNE: `bottom` liczony
  względem SafeAreaView TEGO ekranu, nie całego okna — TabBar
  (`app/(tabs)/_layout.tsx`) jest osobnym, sąsiednim elementem flex POD `<Tabs>`,
  nie overlay/position:absolute, więc "dół ekranu" w tasks.tsx już kończy się tuż
  NAD navbarem — nie trzeba doliczać wysokości navbara/insets.bottom ręcznie.
- Zwolnione miejsce w scrollu (był to stały wiersz nad sekcjami) — teraz kalendarz
  i sekcje zaczynają się bezpośrednio pod sobą, mniej przewijania.

**2. Realne wydarzenia z Google Calendar — brakujący auto-fetch, teraz dodany:**
- Root cause: `calendarStore.gcalEvents` nigdy nie było wypełniane poza ręcznym
  testem w Ustawieniach → Diagnostyka → "Sync kalendarza" (który od razu kasuje
  swój testowy event) — `WeekMonthCalendar` poprawnie CZYTAŁ `gcalEvents`, ale
  nikt tam nic nie WPISYWAŁ.
- Fix: `app/(tabs)/tasks.tsx` dostał `useEffect` na mount, woła
  `googleCalendarService.fetchEvents()` (już istniejący serwis z Fazy 1a, REST do
  Google Calendar z paginacją, ~2 lata wstecz + rok w przód) i wypełnia
  `setGcalEvents(...)`. Login appki (`src/services/googleAuth.ts`) już prosi o
  scope `calendar.events` przy logowaniu, więc token powinien być dostępny bez
  dodatkowego ręcznego kroku w Diagnostyce — `fetchEvents` i tak cicho zwraca
  pustą listę gdy brak tokenu (istniejące zachowanie serwisu, nic dodatkowego nie
  trzeba było dopisywać).
- `gcalEvents` CELOWO nie jest trwałe w AsyncStorage (zgodnie z
  `calendarStore.partialize`) — świeże przy każdym wejściu na ekran Zadania, nie
  cache'owane między sesjami.
- **Niezweryfikowane na urządzeniu**: czy po buildzie realnie pokazują się kropki
  wydarzeń na kalendarzu — zależy czy natywna sesja GoogleSignin (ustawiona przy
  logowaniu) faktycznie trzyma ważny/odświeżalny token na tym etapie appki.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx expo export --platform android`
bez błędów. **Niezweryfikowane na urządzeniu.**

## Finanse — Faza 2, plan pełny (2026-10-31)

User: "przejrzyj sobie całego SAPa... zaprojektuj to wszystko... napisz jak masz
zamiar to zrobić, będziemy po kolei to robić, żeby niczego nie zjebać, żeby zostawić
zajebistą optymalizację". Pełny plan (struktura ekranu, parser paragonów, fuzzy-match
produktów, powiadomienia z banku + szablony, edycja produktów, kolejność budowy) jest
rozpisany w `ARCHITECTURE.md` §FINANSE "Faza 2 — plan pełny" — to TAM jest
źródło prawdy (mapa gdzie co żyje), tutaj tylko status + pytania otwarte.

**Status: PLAN, zero kodu jeszcze.** Czeka na odpowiedź usera na pytanie #4 (poniżej)
+ potwierdzenie propozycji kategorii zanim zacznę Fazę 2.1 (fundament danych).

**Odpowiedzi usera (2026-10-31):**
1. **Bank: Pekao, aplikacja PeoPay** (user: "mam bank PKO, ten w sensie POPay" —
   literówka/pomyłka głosowa, "IKO nie mam" potwierdza że to NIE PKO BP/IKO tylko
   Pekao/PeoPay, już pokryte przez istniejący wpis `BANK_PACKAGES` w sapp). **Plus
   Google Wallet** — user czasem dostaje to samo powiadomienie tą drogą (ta sama
   transakcja, inny kanał) — dodać jako DRUGIE źródło obok PeoPay, deduplikacja już
   istnieje w `commitBankTx()` (po kwocie+dniu+sklepie), więc podwójne powiadomienie
   o tej samej płatności nie powinno zdublować wpisu. Przy implementacji: skopiować
   DOKŁADNĄ nazwę pakietu Pekao z istniejącego, działającego wpisu w sapp (nie
   zgadywać z pamięci), do tego dojść nazwę pakietu Google Wallet.
2. **Firestore — TAK, ten sam wzorzec co Kalendarz.** User: "to i tak będzie tylko
   dla mnie... nikt więcej nie będzie miał dostępu" — brak dodatkowych wymagań
   prywatności ponad to co już jest (jeden user, jego własne Firestore).
3. **Portować testy sapp'a — TAK** (user: "posortować testy", potwierdzenie).

**Pytanie #4 wciąż otwarte — user nie zrozumiał, prosi o ponowne, prostsze
zadanie (do zrobienia na czacie, nie tutaj):** "ewentualnie dodać" przy ręcznym
wpisywaniu paragonu — chodziło o: czy oprócz wpisywania pozycja-po-pozycji i wklejania
tekstu user chce też (w jakiejkolwiek przyszłej fazie) robienie zdjęcia paragonu i
automatyczne odczytanie go (OCR), czy wystarczy sam tekst (wpisany/wklejony)?

**NOWE z tej rundy — dwa realne problemy z sapp, do uwzględnienia w projekcie:**

- **A. Płaskie kategorie sapp'a (`groceries/transport/entertainment/health/
  clothing/housing/subscriptions/other`) były niejednoznaczne w praktyce** — user
  używał realnie tylko kilku (jedzenie, mieszkanie, chyba zdrowie), reszta ("inne")
  była śmietnikiem, a przypadki mieszane (wyjazd: paliwo = transport, bilety na
  koncert = rozrywka, ale to "jeden wyjazd") nie dawały się sensownie zaszufladkować
  w JEDNĄ kategorię. **Moja propozycja (do potwierdzenia przez usera, zanim zacznę
  kod)**: zamiast sztywnej, pojedynczej kategorii per wydatek — mały, jednoznaczny
  zestaw kategorii PIERWOTNYCH (na tyle ile realnie napędza Stałe/Zmienne/Jedzenie +
  ikonę/kolor, patrz `fixedVariable.ts`), PLUS dowolne, wielokrotne TAGI (jak już
  działający system tagów `Task.tags` w Zadaniach — wolny tekst, bez limitu) do
  swobodnego, krzyżowego grupowania (np. "Wakacje" na zarówno paliwie jak i bilecie
  na koncert, bez zmuszania do wyboru jednej kategorii). Pozwala filtrować/sumować
  "ile wydałem na wakacje" NIEZALEŻNIE od podziału Stałe/Zmienne/Jedzenie.
- **B. UX edytora paragonów/transakcji w sapp był nieczytelny** (user, dosłownie:
  "200 mini tekstów pod spodem", "w 15 miejscach rozjebane", chce "high-end app",
  "żebym intuicyjnie wiedział co klikać"). To PODNOSI poprzeczkę ponad to co już
  było zapisane ("UI napisać od zera, ładniej") — dotyczy NIE TYLKO ekranu edycji
  produktów, ale całego flow przeglądu/edycji sparsowanego paragonu i transakcji.
  **Nowy wymóg**: dedykowany ekran w Ustawieniach do zarządzania szablonami
  rozpoznawania banku (`bankRulesStore`) — przeglądanie/dodawanie/edycja z jednego,
  czytelnego miejsca, nie tylko ad-hoc przy przeglądzie kolejki powiadomień.


## Finanse — Faza 2.1 UKOŃCZONA: fundament danych (2026-10-31)

Pierwszy krok z "Kolejności budowy" w ARCHITECTURE.md §FINANSE — czysta logika, ZERO
UI jeszcze (nic nowego nie widać w appce). Port z sapp, adaptowany pod model bez
sztywnej kategorii (user: "ciężko mi było dostosować którąś kategorię" → mały zestaw
strukturalnych sygnałów + dowolne, wielokrotne tagi zamiast tego).

Dodane:
- `src/types/finances.ts` — `Expense`/`ReceiptItem` (bez `category`, z `tags: string[]`
  wielokrotnymi, `subscriptionId`, `fvOverride`, `ReceiptItem.foodSubcat`).
- `src/utils/recurringBills.ts` — słownik rachunków (`BILL_TYPES`) + dopasowanie
  tekstu, port 1:1. Pominięte: cała maszyneria Subskrypcji
  (`detectRecurringBills`/`advanceNextBillingDate`/...) — czeka na ekran
  Subskrypcje.
- `src/utils/fixedVariable.ts` — podział Stałe/Zmienne/Jedzenie, port 1:1 logiki
  (`isFixedExpense` zaadaptowane: `subscriptionId` zamiast `category==='subscriptions'`).
- `src/utils/food.ts` — 19-tagowa taksonomia jedzenia (`FOOD_SUBCATS`) 1:1, te same
  kolory co już czekały w mocku `FoodBreakdownCard`. `isFoodItem`/`foodAmountOf`
  uproszczone — źródłem prawdy jest WYŁĄCZNIE `ReceiptItem.foodSubcat`, bez sapp's
  globalnego mechanizmu "to nie jedzenie" (wiązał się z sapp's "Co zjadłem", którego
  sapp2 nie ma).
- `src/utils/productMemory.ts` — fuzzy-matching (trigram), grupowanie, aliasy, pamięć
  wagi/ceny/werdyktów linii — w większości 1:1 (kategorio-niezależne). "Pamięć
  kategorii" przemianowana na "pamięć podkategorii jedzenia". Pominięte: pamięć
  tagów/kcal (sapp-specific, nieaktualne w nowym modelu).
- `src/utils/merchantMemory.ts` — zaufanie/auto-akceptacja sprzedawców, port 1:1,
  `category`→`tags`, `guessCategory`→`guessTags`.
- `src/store/expensesStore.ts` + `src/services/expensesService.ts` — ten sam wzorzec
  co `calendarStore`/`calendarService` (offline-first AsyncStorage + osobna ręczna
  warstwa Firestore).
- **Testy** (user potwierdził: "posortować testy" = portować) — `jest`/`@types/jest`/
  `jest-expo` dodane jako devDependencies (sapp2 nie miało tego wcześniej, mimo że
  `"test": "jest"` już było w `package.json`), `jest.config.js`/`jest.setup.js`/
  `__mocks__/fileMock.js` port 1:1 z sapp. 4 pliki testów (`fixedVariable`/
  `recurringBills`/`merchantMemory`/`productMemory`), przepisane pod nowy model —
  **68 testów, wszystkie zielone** (`npx jest`).

Następny krok: Faza 2.2 (parser paragonów + ręczne dodawanie, port
`receiptParser.ts` + wspólny ekran edycji listy pozycji).

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 68/68 zielone,
`npx expo export --platform android` bez błędów. Czysto logika — nic nowego nie
widać jeszcze w appce (brak UI), nie ma czego testować na urządzeniu w tej rundzie.

## Finanse — Faza 2.2 UKOŃCZONA: parser paragonów + pierwszy ekran "dodaj" (2026-10-31)

Drugi krok z "Kolejności budowy" — **pierwszy prawdziwy, klikalny ekran** Finansów w
sapp2 (user: "dawaj dalej" po Fazie 2.1, która była czystą logiką bez UI).

Dodane:
- `src/utils/receiptParser.ts` — port `receiptParser.ts` z sapp (1319 linii), logika
  struktury paragonu 1:1: detekcja sklepu (`STORE_BRANDS`, ~45 marek), daty, metody
  płatności, router Kaufland (app "Receipt copy" + drukowany + OCR zdjęcie)/Biedronka/
  generic fallback, rabaty/promocje/kaucje (zwrot i opłata)/VAT/waga/skróty nazw
  (`ABBR_MAP`). **Jedyna realna zmiana**: `CATEGORY_KEYWORDS`/`categorize()` (sapp's
  nie-jedzeniowy słownik transport/rozrywka/zdrowie/odzież/mieszkanie/subskrypcje) —
  **usunięte całkowicie**, zero odpowiednika w nowym modelu bez `ExpenseCategory`.
  Zamiast tego pozycja dostaje `foodSubcat` tylko gdy rozpozna się jako jedzenie
  (`categorizeFoodSubcat()` = port `FOOD_TAG_MAP`/`getFoodTags` z sapp + rozstrzyganie
  priorytetu przez `FOOD_SUBCATS` z `food.ts`, dokładnie jak sapp's `foodSubcat()`
  robiło to dla `item.tags`).
- `__tests__/receiptParser.test.ts` — port testów z sapp (paragony Lidl/Kaufland
  realne, ze zwrotem/opłatą kaucji, multi-buy rabaty, 8 kategorii spiżarniowych +
  "sosy"), pominięte testy `categorize()` (funkcja nieportowana). **105/105 testów
  zielonych** (37 nowych + 68 z Fazy 2.1).
- `src/components/finances/ReceiptItemRow.tsx` (nowy) — wiersz pozycji: checkbox
  włącz/wyklucz z sumy (domyślnie odznaczony dla `suspect` — linii które parser
  podejrzewa że to nagłówek/suma, nie produkt), edytowalne pole nazwy, qty×cena
  jednostkowa=cena finalna (edycja qty/ceny jedn. przelicza cenę; edycja ceny
  finalnej jest niezależna — "chyba że się cena zmieni"), `+ zniżka` (doliczana do
  `discount`, odjęta od ceny), picker `foodSubcat` (chipy z kolorami z `food.ts`).
- `src/components/finances/AddExpenseModal.tsx` (nowy) — pełnoekranowy modal
  (ten sam wzorzec co `WydatkiModal`), realizuje "jeden ujednolicony dodaj":
  - Segment Wydatek/Przychód.
  - Pole paste "Wklej tekst paragonu" + "Rozpoznaj paragon" → `parseReceiptText`,
    wypełnia TĘ SAMĄ listę pozycji co "+ Dodaj pozycję" (ręczne, od zera) — jeden
    wspólny stan, nie dwa osobne ekrany jak w sapp (`scan.tsx`/`manual.tsx`).
  - Lista pozycji puste → pole "Kwota" odkrywa się jako zwykły szybki wydatek
    (czynsz, paliwo) bez rozbijania na produkty.
  - Suma pozycji licząca się na żywo + ostrzeżenie gdy nie zgadza się z kwotą
    wykrytą na paragonie (odpowiedź na "muszę mieć możliwość podglądu ile już w
    sumach wychodzi produktów").
  - Data (Dziś/Wczoraj, nadpisywana datą z paragonu jeśli wykryta), sklep, notatka,
    "Rozlicz jako" (Auto/Stałe/Zmienne/Jedzenie = `fvOverride`), metoda płatności,
    tagi (wielokrotne, dodawaj/usuwaj chipami — jak `Task.tags`, nie jak
    `AddTaskCard`'s jedno pole).
  - Zapisuje przez `useExpensesStore().addExpense()`.
- `app/(tabs)/finances.tsx` — FAB (ten sam wzorzec co Zadania) otwiera
  `AddExpenseModal`; "Ostatnie transakcje" czyta TERAZ realnie z `expensesStore`
  (max 4, najnowsze pierwsze) — **tymczasowo**, tylko żeby zapis miał widzialny
  efekt do testowania; pełny redesign (saldo/popup Stałe-Zmienne-Jedzenie) to
  Faza 2.4.

**Świadomie NIE w tej rundzie** (śledzone gapy, nie dead-endy):
- `productMemory.ts` (fuzzy-sugestie nazwy, pamięć wagi/ceny/anomalii) — portowany w
  Fazie 2.1, ale jeszcze NIE podpięty do `ReceiptItemRow`/`AddExpenseModal`. Wpisanie
  nazwy produktu dziś nie podpowiada nic. Do zrobienia razem z Fazą 2.3 (edycja
  produktów), bo obie dzielą tę samą warstwę pamięci.
- Data — tylko Dziś/Wczoraj + auto-detekcja z paragonu, brak pełnego date-pickera
  (ten sam kompromis co `AddTaskCard`, brak biblioteki do tego w projekcie).
- Haptyka ("zrób te wibracje") — czeka na Fazę 2.6 (port `utils/haptics.ts`, nie
  istnieje jeszcze w sapp2).
- Szablony sklepów/produktów z autouzupełnianiem przy wpisywaniu nazwy sklepu —
  `merchantMemory.ts` portowany logicznie, ale `storeName` w `AddExpenseModal` to
  dziś goły `TextInput`, bez podpięcia `guessTags`/trust-auto-accept. Patrz wyżej.

**DO PRZETESTOWANIA NA URZĄDZENIU** (pierwszy raz w Fazie 2 jest coś klikalne):
- FAB na zakładce Finanse → otwiera modal, da się przełączyć Wydatek/Przychód.
- Wklejenie prawdziwego paragonu (Lidl/Biedronka/Kaufland z telefonu) → "Rozpoznaj
  paragon" → sprawdzić czy pozycje/ceny/sklep/data wyglądają sensownie.
- Szybki wydatek bez pozycji (np. "Paliwo", kwota ręcznie) → zapisuje się i pojawia
  w "Ostatnie transakcje".
- Edycja pozycji: zmiana qty/ceny, `+ zniżka`, picker kategorii jedzenia, checkbox
  wyklucz z sumy — czy przelicza się na żywo poprawnie.
- Przychód — prostszy formularz, zapisuje się z `+` na liście transakcji.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 105/105 zielone,
`npx expo export --platform android` bez błędów (bundle buduje się, nowe ekrany
wchodzą do bundla). Następny krok: Faza 2.3 (edycja produktów — nowy ekran +
podpięcie `productMemory`) ALBO dociągnięcie gapów z tej rundy, do ustalenia z
userem po teście na urządzeniu.

## Daily — HUMOR zbudowany (2026-10-31)

User po teście Finansów (odpowiedź na pytanie o doprecyzowanie): "humor" = nastrój
(nie żarty) — chciał dodatkowej rundy obok Finansów: "dodawanie humoru (jeden raz
potem drugi raz dziennie z taką siatką jak w sapp i opcjonalnym tekstem, zapisywanym
tym razem w formie pamiętnika DZIEŃ DATA (można dopisać opisać dzień za dodatkowe
punkty dla roślinki później)". Zbadane 1:1 w sapp (research-fork): kompletny,
battle-tested system `MoodEntry`/siatka/tagi — portowany prawie bez zmian (pure logika/
UI, kategorio-niezależne, zero redesignu danych potrzebne).

Zrobione — patrz ARCHITECTURE.md §DAILY "Humor / Nastrój" po pełny opis:
- `types/mood.ts`, `store/moodStore.ts`, `utils/moodTags.ts` (+ `__tests__/
  moodTags.test.ts`, 19 testów portowanych 1:1) — czysta logika.
- `components/mood/MoodEnergyGrid.tsx` — siatka 5×5 nastrój×energia, port 1:1
  (gestykulacja/matematyka), bez `haptic`/`useColors` (nie istnieją jeszcze w sapp2 w
  tej formie).
- `components/mood/MoodModal.tsx` — NOWY, jeden pełnoekranowy modal z przełącznikiem
  "Dodaj"/"Pamiętnik" (dzień-po-dniu, nagłówek "DZIEŃ · {data}"), zamiast sapp's
  osobnego bottom-sheet check-inu + całego ekranu `app/(tabs)/mood.tsx` ze
  statystykami/wykresami (ŚWIADOMIE nieportowane w tej rundzie — user prosił o samo
  dodawanie+pamiętnik, nie dashboard).
- `components/ui/LiveSectionRow.tsx` (NOWY) — klikalny wariant `ComingSoonRow`, Daily's
  "Humor" nim zamieniony (status "{emoji} zapisane" / "Zapisz →").

**Świadomie NIE w tej rundzie** (spisane też w ARCHITECTURE.md):
- Przypomnienia rano/wieczorem (sapp ma dwa niezależne harmonogramy notyfikacji) —
  sapp2 nie ma jeszcze prostej, lokalnej warstwy notyfikacji (tylko notifee full-screen
  alert dla Zadań, inny mechanizm/zastosowanie) — osobne zadanie.
- Haptyka — czeka na `utils/haptics.ts` (Finanse Faza 2.6, wspólne dla całej appki).
- Punkty/currency dla roślinki za opis dnia — **roślinka jeszcze nie istnieje**
  (§PUPIL/ROŚLINKA wciąż "pomysł do rozważenia"). Hak udokumentowany w ARCHITECTURE.md
  (wzorzec do portowania gdy roślinka powstanie: sapp's `utils/quests.ts`'s
  `d_mood`/`w_mood`/`mo_mood` + `petStore`'s `claimDaily/claimWeekly/claimMonthly`).
- Statystyki/wykresy/achievementy nastroju (sapp's `app/(tabs)/mood.tsx`) — osobna,
  większa decyzja, nie poproszona w tej rundzie.

**DO PRZETESTOWANIA NA URZĄDZENIU**:
- Zakładka Daily → "Humor" wiersz → otwiera modal, siatka 5×5 REALNIE się przeciąga/
  tapnie (to jest TEN element który w sapp dwa razy łapał buga z gestami wewnątrz
  Modala — priorytet #1 do sprawdzenia).
- Zapisanie check-inu (wymaga wybrania nastroju+energii) → zamyka modal, "Humor" na
  Daily pokazuje emoji.
- Zrobienie DRUGIEGO check-inu tego samego dnia → tytuł "Humor 2. raz dziś".
- Przełącznik "Pamiętnik" w headerze → widać dzisiejsze wpisy pod "DZIEŃ · {data}",
  notatka (jeśli wpisana) wyświetla się jako tekst. Tap na wpis → wraca do edycji.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 124/124 zielone (19 nowych),
`npx expo export --platform android` bez błędów.

## Runda poprawek (2026-11-01) — kalendarz miesiąc, Finanse, Dashboard realne zadania

User po testach Finansów/Daily, trzy niezależne poprawki do już zbudowanych rzeczy:

**1. Kalendarz, widok miesiąca → pełnoekranowy popup z chipami**
"Kalendarz w trybie rozłożonym niech też ma takie kafelki jak tygodniowy widok, może
być nawet na cały ekran". Dawny inline widok miesiąca (ciasna siatka 6×7, sama
kropka) zastąpiony `MonthViewModal.tsx` (nowy, pełnoekranowy, wzorzec
WydatkiModal/AddExpenseModal) — te same kolorowe chipy wydarzeń co widok tygodnia
(max 2/komórkę + "+N"), nawigacja miesiącami, tap dnia zamyka popup i otwiera
`DayDetailModal` jak dotąd. `WeekMonthCalendar.tsx` zostaje WYŁĄCZNIE widokiem
tygodnia (inline) + przyciskiem otwierającym ten popup — `expanded`/inline-miesiąc
USUNIĘTE, nie dwa tryby w jednym komponencie.

**2. Finanse (AddExpenseModal) — trzy poprawki naraz**
- **Klawiatura nie zasłania pola** (user: "ogólnie w całej apce uważaj na to") —
  `useKeyboardHeight.ts` (port z sapp, hook mierzący realną wysokość klawiatury)
  zamiast `KeyboardAvoidingView`, który jest niewiarygodny wewnątrz RN's `Modal` na
  Androidzie (osobna natywna hierarchia). Podpięte też w `MoodModal.tsx` (ten sam
  problem, ten sam fix) — **ale NIE jeszcze w `AddTaskCard`/innych miejscach z
  inputami** — to inline karty, nie `Modal`, więc prawdopodobnie nie mają tego
  problemu, ale nie przetestowane bezpośrednio; zgłosić jeśli też zasłania.
- **Parser bliżej prawego kciuka** — nowy pływający przycisk (ClipboardPaste, taki
  sam wzorzec jak FAB) w prawym dolnym rogu modala: jedno tapnięcie czyta schowek i
  od razu parsuje, bez przewijania do pola na górze. Pole paste zostaje jako ścieżka
  zapasowa (tekst wpisany/zdyktowany).
- **Kto płacił + saldo odzwierciedlające konto bankowe** — NOWE pole
  `Expense.payer?: 'me' | 'partner'` (domyślnie "ja" = Olesia nigdy nie jest
  domyślna). Sekcja "Zapłacono: Ja · Karta" w modalu ZWINIĘTA domyślnie (user: "żeby
  to miejsca nie zajmowało, ale żeby dało się zmienić"), tap rozwija wybór
  Ja/Olesia + metody płatności razem. `utils/balance.ts` (nowy): `affectsBalance(e)`
  = `(payer??'me')==='me' && paymentMethod!=='cash'` — gotówka i płatności Olesi
  NIGDY nie ruszają salda (user: "chcę saldo żeby odzwierciedlało ile mam na koncie
  w banku"). `app/(tabs)/finances.tsx`'s kafel Saldo PODPIĘTY realnie
  (`accountBalance(expenses, offset)`), tap na kafel → mały popup "Ustaw aktualne
  saldo" do kalibracji (offset w AsyncStorage, `getBalanceOffset`/`setBalanceOffset`,
  port uproszczony z sapp's `accountBalance.ts` — BEZ osobnego pulu gotówki, user go
  nie prosił, gotówka jest po prostu wyłączona z sumy).

**3. Dashboard — kafel Zadań i "najbliższy termin" podpięte do realnych danych**
User: "zadania które dodaję żeby pokazywały się już realnie na dashboardzie żebym
zobaczył czy działa wszystko". Oba kafle w `app/(tabs)/index.tsx` czytały na sztywno
`MOCK_TASKS`/"2 DNI Projekt Marchewka" — ZASTĄPIONE `useCalendarStore`'owymi
zadaniami: kafel Zadań = do 4 pozycji (z terminem rosnąco, potem bez terminu
najnowsze pierwsze), tag per zadanie (pilne=termin dziś/po terminie, nazwany
skrót=pierwszy tag, dzwonek=ma termin w przyszłości, puste=żadne z tych); kafel
"najbliższy termin" = dni do najbliższego terminu + tytuł tego zadania, "Brak
terminów" gdy żadne zadanie go nie ma.

**DO PRZETESTOWANIA NA URZĄDZENIU**:
- Zadania → strzałka/header kalendarza → pełnoekranowy miesiąc z chipami, nawigacja,
  tap dnia otwiera szczegóły.
- Finanse → dodaj wydatek → klawiatura NIE zasłania pola notatki/kwoty przy pisaniu.
- Finanse → pływający przycisk schowka → skopiuj tekst paragonu PRZED otwarciem
  modala, tapnij przycisk, powinno sparsować bez dotykania pola tekstowego.
- Finanse → zwiń/rozwiń "Zapłacono", zmień na Olesia/gotówka, zapisz → saldo na
  ekranie Finanse NIE powinno się zmienić dla tego wydatku (sprawdzić przed/po).
- Finanse → tap na kafel Saldo → wpisać realny stan konta → saldo się kalibruje.
- Dashboard → dodaj zadanie z terminem w Zadaniach → wróć na Dashboard → widoczne w
  kaflu Zadań i/lub jako "najbliższy termin".

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 129/129 zielone (5 nowych —
`balance.test.ts`), `npx expo export --platform android` bez błędów.

## Finanse — Faza 2.3 UKOŃCZONA: edycja produktów + pamięć podpięta (2026-11-01)

User: "dawaj dalej" po rundzie poprawek. Trzeci krok z "Kolejności budowy" —
jednocześnie zamyka śledzony gap z Fazy 2.2 ("Podpowiadanie produktu po nazwie...
PORTOWANE, ale NIE podpięte").

Dodane:
- `src/utils/productCatalog.ts` (nowy) — `buildProductCatalog(expenses, aliases)`
  agreguje katalog produktów Z HISTORII (sapp2 nie ma osobnego store'u "Produkty"),
  grupowanie `productGroupKey`/`productGroupLabel` (1:1 sapp), aliasy zastosowane
  PRZED grupowaniem. `findDuplicateCandidates()` — pary wpisów w paśmie
  `0.45–0.60` (literówka/OCR-szum w PIERWSZYM tokenie → inny `groupKey`, nie
  grupuje się samo). `__tests__/productCatalog.test.ts` — 6 testów (w tym jeden
  wymagający realnych par tekstowych znalezionych empirycznie, żeby faktycznie
  wpadały w pasmo niepewności, nie tylko w teorii).
- `src/components/finances/ProductsModal.tsx` (nowy) — pełnoekranowy katalog,
  karty-wiersze (jak `TaskRow`, nie ciasny centered-modal sapp's
  `app/products.tsx`), szukajka, baner "Możliwe duplikaty (N)" z Połącz/To różne,
  tap na kartę → edycja inline (nazwa → `saveNameAliases`, kategoria jedzenia →
  chipy z `food.ts` → `saveFoodSubcatMemory` dla całej scalonej grupy). Wejście:
  `app/(tabs)/finances.tsx` → "Obszary" → nowy klikalny wiersz "Produkty"
  (`LiveSectionRow`, status = liczba wpisów).
- **`AddExpenseModal.tsx`/`ReceiptItemRow.tsx` — pamięć produktowa PODPIĘTA**
  (dotąd portowana logika, ale nic jej nie wołało):
  - `runParse()`: `canonicalProductName()` naprawia nazwę przez aliasy/marki OD
    RAZU (twarda reguła, nie pytanie), `applyFoodSubcatMemory()` jako fallback
    TYLKO dla pozycji których `receiptParser.ts`'s słownik słów-kluczowych nie
    złapał wcale.
  - `ReceiptItemRow`: na BLUR pola nazwy → `suggestSimilarName()` (pasmo
    niepewności) → "Czy to: {nazwa}?" tap-to-accept, auto-uzupełnia też
    `unitPrice` z `priceFor()` gdy pole było puste (user: "wpisuję nazwę...
    sugeruje... klikam, cena się uzupełnia" — DOSŁOWNIE ten mechanizm).
    `priceAnomaly()` → "Zwykle ~X zł" ostrzeżenie przy rażąco wysokiej cenie.
  - **`handleSave()` teraz REALNIE uczy pamięć** (`saveFoodSubcatMemory`/
    `savePriceMemory` dla finalnych pozycji) — to był kluczowy brakujący krok:
    pamięć była portowana i czytana, ale NIC jej nigdy nie zapisywało, więc
    nigdy by się nic nie nauczyła, niezależnie od tego jak dobre było UI.

**Świadomie NIE w tej rundzie**: `weightFor`/`parseWeightFromName` (pamięć
wagi) — `ReceiptItemRow` nie ma wcale pola na `weightKg` w UI, mniejszy priorytet,
nie było w bezpośredniej prośbie usera. Odrzucone duplikaty w `ProductsModal` NIE
są trwale pamiętane (tylko na czas sesji) — drobna niedoróbka, do rozważenia jeśli
user zgłosi że te same pary wracają zbyt często.

**DO PRZETESTOWANIA NA URZĄDZENIU**:
- Finanse → Obszary → "Produkty" → lista się wypełnia po zapisaniu wydatków z
  pozycjami, tap na kartę → zmiana nazwy/kategorii zapisuje się i widać od razu.
- Wklej ten sam paragon (albo bardzo podobny) dwa razy → druga pozycja z tą samą
  nazwą produktu — wpisanie nazwy ręcznie (pozycja dodana przyciskiem "Dodaj
  pozycję") powinno po `onBlur` zaproponować "Czy to: {znana nazwa}?".
  Zaakceptowanie powinno uzupełnić cenę, jeśli pole było puste.
  - Wpisanie bardzo wysokiej ceny dla znanego produktu (np. 10× typowej) →
    ostrzeżenie "Zwykle ~X zł".
- Scalenie dwóch podobnych produktów w "Produkty" (przez baner duplikatów albo
  ręczną zmianę nazwy) → sprawdzić że następny paragon z tym produktem respektuje
  nową, scaloną nazwę.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 135/135 zielone (6 nowych —
`productCatalog.test.ts`), `npx expo export --platform android` bez błędów.

## Runda poprawek 2 (2026-11-01) — 6 zgłoszeń po teście na urządzeniu

1. **Finanse → edycja transakcji** — "Ostatnie transakcje" były statycznym
   `View`em, tap nie robił nic. `AddExpenseModal` dostał nowy opcjonalny prop
   `editingExpense?: Expense | null`: gdy ustawiony, formularz wypełnia się z
   istniejącego wydatku, nagłówek "Edytuj wydatek/przychód" + kosz (usuwa przez
   `deleteExpense`), "Zapisz" → "Zaktualizuj" (woła `updateExpense` zamiast
   `addExpense`). `app/(tabs)/finances.tsx`: wiersz transakcji teraz
   `TouchableOpacity`, tap ustawia `editingExpense` i otwiera TEN SAM modal co
   FAB — zero duplikacji formularza.
2. **Dashboard, kafel Zadań — wiersze się rozciągały** — `TaskListTile`'s
   wiersze miały `flex: 1`, więc z REALNYMI danymi (często <4 zadania, nie
   zawsze równo 4 jak w starym mocku) rozciągały się żeby wypełnić cały kafel —
   2 zadania wyglądały ~2× grubsze niż powinny. Zmienione na STAŁĄ wysokość
   (23.5 — przeliczone 1:1 z komentarza który już był w kodzie przy chipie
   taga, TILE_ROW_HEIGHT=120 minus paddingi/odstępy /4) — teraz zawsze ten sam
   rozmiar wiersza, reszta kafla pod nimi po prostu pusta gdy <4 zadania.
   Usunięty też `adjustsFontSizeToFit` z tytułu zadania (user: "zawsze stały
   tekst, który ewentualnie znika") — tytuł ma teraz STAŁY rozmiar czcionki,
   za długi obcina się wielokropkiem (`numberOfLines={1}`), nie kurczy się.
3. **StatTile — niekonsekwentne rozmiary etykiet w streaku** — `label` miał
   `adjustsFontSizeToFit`, więc KAŻDY kafel skalował czcionkę niezależnie
   względem WŁASNEJ treści — krótkie "WODA" renderowało się wyraźnie większe
   niż długie "ĆWICZENIA" w tym samym rzędzie. Usunięty auto-shrink, fontSize
   zmniejszony na stały `11` (dociągnięty tak żeby "ĆWICZENIA" mieściło się
   bez kurczenia) — teraz wszystkie etykiety tego samego typu renderują się w
   JEDNYM, stałym rozmiarze.
4. **Kalendarz, widok miesiąca — tap dnia wywalał z powrotem do tygodnia** —
   `MonthViewModal`'s `selectDay` zamykał SAM SIEBIE przy wyborze dnia, więc po
   zamknięciu `DayDetailModal` user widział pod spodem WIDOK TYGODNIA (jedyny
   zamontowany). Fix: `MonthViewModal` NIE zamyka się już przy wyborze dnia —
   oba modale (ten + `DayDetailModal`) to niezależne `Modal`-e, mogą być
   widoczne naraz jeden na drugim, więc po zamknięciu szczegółów dnia user
   wraca do MIESIĄCA, tak jak już działało dla tygodnia. Kolory lekko
   poprawione (user: "zbyt szarawiaste") — domyślny kolor chipa wydarzenia bez
   przypisanego koloru zmieniony z płaskiego szarego na `accent.blue`,
   obwódka na komórce "dziś", jaśniejsze etykiety dni tygodnia.
5. **ReceiptItemRow — pole nazwy nie wyglądało jak edytowalne** — BYŁO już
   edytowalnym `TextInput`em, ale bez tła/obwódki wyglądało jak zwykły,
   statyczny tekst (w odróżnieniu od pól liczbowych niżej, które MIAŁY tło) —
   user: "nie mogę edytować... jak kliknę chcę mieć edycję". Dodane to samo
   tło/obwódka co pola liczbowe, teraz wizualnie oczywiste że to pole do
   kliknięcia.
6. **Zaokrąglanie liczb pozycji paragonu** — wagowe produkty (owoce/warzywa)
   czasem dawały długie, zaszumione floaty po przeliczeniu. Dodana funkcja
   `round(n, dp)` w `ReceiptItemRow.tsx`: `quantity` zaokrąglane do 3 miejsc
   (waga w kg), `unitPrice`/`price` do 2 (złotówki) — i przy EDYCJI (w `setNum`)
   i przy WYŚWIETLANIU (defensywnie, na wszelki wypadek gdyby coś długiego
   przeszło inną ścieżką).

**DO PRZETESTOWANIA NA URZĄDZENIU**:
- Finanse → tap na transakcję z listy → otwiera się wypełniony formularz,
  zmiana czegokolwiek + "Zaktualizuj" → zmiana widoczna na liście. Kosz w
  nagłówku → usuwa i wraca.
- Dashboard → kafel Zadań z 1-3 realnymi zadaniami → wiersze powinny być
  SMUKŁE (nie grube), reszta kafla pusta/czarna pod nimi.
- Streak (rząd 1 Dashboardu) → WODA/SŁODYCZE/ĆWICZENIA powinny mieć teksty
  tej samej wielkości.
- Zadania → otwórz miesiąc → kliknij dzień → zamknij szczegóły dnia →
  powinieneś wrócić do WIDOKU MIESIĄCA, nie tygodnia.
- Paragon z owocami/warzywami na wagę → cena/ilość powinny mieć max 2-3 miejsca
  po przecinku, nie długi ciąg cyfr.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 135/135 zielone,
`npx expo export --platform android` bez błędów.

## Alerty (test OLED/dźwięk) + Humor (ergonomia kciuka) — 2026-11-01

Po teście na urządzeniu (4 screenshoty) user: Expo MAX i oba warianty notifee
(bez przycisku / Tak-Nie) działają — pełny ekran pokazuje się poprawnie. ALE:
1. "Notifee za 5 min (test OLED)" **nie zadziałał w ogóle** mimo że identyczny
   mechanizm za 5s działa.
2. **Brak dźwięku we WSZYSTKICH wariantach**.
3. Pytanie: appka nie pytała o zgodę na powiadomienia — czy to normalne? TAK,
   `app.json` ma `POST_NOTIFICATIONS` poprawnie zadeklarowane, zgoda była już
   przyznana w którejś z wcześniejszych rund testowych na tym urządzeniu — brak
   ponownego promptu jest oczekiwany, nie błąd.

Dla (1): dodane dwa przyciski diagnostyczne w Ustawienia → Alerty:
"Optymalizacja baterii" i "Dokładne alarmy" (oba przez wbudowane API notifee,
zero nowej zależności) — otwierają systemowe ekrany zgody, które TYLKO user może
zaakceptować (appka nie może tego włączyć sama). Dodatkowo `sendNotifeeAlert`
dla opóźnień ≥60s teraz LOGUJE ostrzeżenie jeśli optymalizacja baterii jest
włączona, zamiast cicho "udawać sukces". To najbardziej prawdopodobna przyczyna:
na Androidzie 12+ dokładny alarm (`allowWhileIdle`) bez wykluczenia z
optymalizacji baterii może zostać cicho zdegradowany/opóźniony przez system,
mimo że `createTriggerNotification` nie rzuca błędem.

Dla (2): kanał `expo-notifications` ('alerts-max' → `alerts-max-v2`) nigdy
wcześniej nie był wersjonowany mimo że kanały są niemutowalne po utworzeniu —
możliwe że stary, sprzed-konfiguracji-dźwięku kanał siedział cicho na
urządzeniu. Kanał notifee (`alerts-fullscreen-v3`) już był bumpowany DWA razy
wcześniej po tym samym objawie i nadal cicho — **to NIE jest naprawione**,
najbardziej prawdopodobna przyczyna to coś po stronie urządzenia (głośność
powiadomień/dzwonka wyciszona w systemie, albo "Dostęp Nie przeszkadzać" nie
przyznany appce ręcznie — `bypassDnd` w kodzie samo tego nie załatwia).

**DO SPRAWDZENIA NA URZĄDZENIU** (zanim kolejna próba w kodzie — już dwa razy
zgadywaliśmy "kanał" bez skutku):
- Głośność POWIADOMIEŃ (nie multimediów) w systemowych ustawieniach dźwięku —
  czy jest > 0.
- Ustawienia → Aplikacje → Sapp2 → Powiadomienia → kanał "Alerty pełnoekranowe
  (test) v3" → czy DŹWIĘK jest tam ręcznie ustawiony na "Brak".
- Ustawienia → Aplikacje → Specjalny dostęp → Nie przeszkadzać → czy Sapp2 ma
  tam zgodę.
- Po "Optymalizacja baterii"/"Dokładne alarmy" z Ustawień → powtórz test OLED
  za 5 min, zablokuj ekran, poczekaj pełne 5 min.

## Humor — siatka nastroju/energii przesunięta niżej (2026-11-01)

User (ironicznie, nawiązując do wcześniejszej prośby "bliżej kciuka" przy
paragonach): *"ja mam być wygodnie wpisywać i ogarniać jak to jest na górze
ekranu wszystko"* — siatka 5×5 (jedyny element wymagający przeciągania kciukiem)
siedziała najwyżej w scrollu "Dodaj", najdalej od naturalnej pozycji kcioba przy
trzymaniu telefonu jedną ręką. Kolejność w `MoodModal.tsx` odwrócona: tagi →
notatka → siatka, siatka teraz tuż nad przyciskiem "Zapisz" (najbliżej kciuka,
ten sam priorytet co FAB wklejania paragonu w Finansach). `MoodEnergyGrid.tsx`
bez zmian, tylko kolejność renderu w rodzicu.

**DO PRZETESTOWANIA NA URZĄDZENIU**:
- Humor → "Dodaj" → siatka powinna być NA DOLE (tuż nad "Zapisz"), tagi i
  notatka wyżej — sprawdź czy wygodniej się tym posługiwać jedną ręką.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 135/135 zielone,
`npx expo export --platform android` bez błędów.

## Finanse — Faza 2.4 "Przebudowa ekranu" UKOŃCZONA (2026-11-01)

User: "dawaj" na zaproponowany plan Fazy 2.4. Zrobione:

1. **Ekran Finanse przestał się scrollować** — zgodnie z ustaloną zasadą
   "Dashboard (i teraz Finanse) nigdy nie dostają scrolla" (była to świadomie
   odłożona różnica od tymczasowego szkieletu z Fazy 2.2).
2. **`TransactionsModal.tsx` (nowy)** — pełnoekranowy popup z wyszukiwarką
   (sklep/notatka/tag), pełna lista WSZYSTKICH transakcji. Otwiera się tapem na
   nagłówek "Ostatnie transakcje" (sekcja na ekranie dalej pokazuje tylko 4).
   Tap na wiersz w popupie → edycja (ten sam `AddExpenseModal`), lista pod spodem
   NIE zamyka się (poprawiony wcześniej wzorzec z `MonthViewModal`).
3. **`WydatkiModal.tsx` dostał 3-way segmented tab Stałe/Zmienne/Jedzenie** —
   wcześniej pokazywał TYLKO Jedzenie. Nowe karty `FixedBreakdownCard.tsx`
   (rachunki stałe + odznaka odchylenia gdy nietypowy skok vs. własna historia) i
   `VariableBreakdownCard.tsx` (top 5 zmiennych wydatków miesiąca). Ten sam modal
   otwiera się TERAZ z dwóch miejsc: Dashboard (kafel "#JEDZENIE",
   `initialTab="food"`) i nowy wiersz "Stałe / Zmienne / Jedzenie" w Finansach
   → "Obszary" (`initialTab="fixed"`).
4. **`utils/wydatkiData.ts`/`hooks/useWydatkiData.ts` (nowe)** — jedno miejsce
   liczące dane dla WSZYSTKICH trzech kubłów dla obu ekranów, żeby Dashboard i
   Finanse nie rozjeżdżały się w definicji "ten miesiąc"/"zmiana %". Logika
   bucketowania (`fixedBreakdown`/`fixedDeviations`/`topVariableContributors`)
   istniała w `fixedVariable.ts` od Fazy 2.1 z testami — to pierwsze realne
   podpięcie pod UI.

**DO PRZETESTOWANIA NA URZĄDZENIU**:
- Finanse → ekran nie powinien się scrollować (balans + 4 ostatnie transakcje +
  Obszary mieszczą się na ekranie).
- "Ostatnie transakcje" → tap na nagłówek sekcji (nie na wiersz) → pełna lista z
  wyszukiwarką. Tap na wiersz tam → edycja, po zamknięciu wracasz do listy.
- "Obszary" → "Stałe / Zmienne / Jedzenie" → popup z 3 zakładkami, zawartość
  zgadza się z realnie dodanymi wydatkami (rachunki w Stałe, resztę w Zmienne,
  jedzenie w Jedzenie — tak jak w AddExpenseModal przy dodawaniu).
- Dashboard → kafel "#JEDZENIE" → ten sam popup, ale otwiera się na zakładce
  Jedzenie, z resztą dwóch zakładek też dostępnych przez tapnięcie.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 137/137 zielone (2 nowe testy
`wydatkiData.test.ts`), `npx expo export --platform android` bez błędów.

## Finanse — Faza 2.5 "Powiadomienia z banku" UKOŃCZONA (2026-11-01)

User: "dawaj dalej" po Fazie 2.4 → kolejny, ostatni nieruszony krok z planu Finansów
(ARCHITECTURE.md §FINANSE "Kolejność budowy"), świadomie opisany jako "najbardziej
ryzykowny, natywny kawałek, celowo na końcu". Port z sapp (ten sam user, te same
banki: Pekao PeoPay/Pekao24 + PKO BP IKO), ADAPTOWANY do sapp2's modelu bez
kategorii i offline-first zapisu — pełne szczegóły adaptacji w
ARCHITECTURE.md § "Powiadomienia z banku (Faza 2.5)".

Skrót co powstało: natywny `NotificationListenerService`
(`plugins/withBankNotificationListener.js`) → `bankNotificationDrain.ts` (czyta przy
każdym foreground) → `bankIngest.ts`/`utils/bankNotification.ts` (parsuje, dopasowuje
pamięć sprzedawcy) → `bankQueueStore.ts` (kolejka) → `bankAutoProcess.ts`
(auto-zatwierdza zaufanych) → `bankCommit.ts` (zapisuje `Expense`, dedup, uczy
`merchantMemory`). Ręczny przegląd: nowy route `app/bank-review.tsx`. Ustawienia →
Finanse: włącznik, link do "Dostęp do powiadomień" (systemowy ekran), "Dodawaj
automatycznie", "Sprawdź teraz (diagnostyka)", link do przeglądu z licznikiem
oczekujących. Świadomie ODŁOŻONE: integracja z Subskrypcjami/Pracą/wypłatą (te ekrany
jeszcze nie istnieją w sapp2). Historia/cofnięcie/szablony → patrz Faza 2.7 niżej.

**TO JEDYNA funkcja w tej rundzie sesji, której CI/`tsc`/`jest`/`expo export` NIE
mogą realnie zweryfikować** — sprawdzają tylko że kod się kompiluje i że
config-plugin generuje poprawny natywny Kotlin/manifest (zweryfikowane lokalnie przez
`npx expo prebuild` — plik `Sapp2NotificationListener.kt` i wpis `<service>` w
AndroidManifest.xml wygenerowane poprawnie). Czy nasłuch FAKTYCZNIE łapie
powiadomienia na tym konkretnym telefonie/OEM da się sprawdzić tylko na urządzeniu.

**DO PRZETESTOWANIA NA URZĄDZENIU** (w tej kolejności):
1. Ustawienia → Finanse → "Powiadomienia z banku" → włącz.
2. "Dostęp do powiadomień" → otwiera systemowy ekran → znajdź Sapp2 → włącz
   (jednorazowo, bez tego nasłuch nic nie dostanie).
3. Jeśli telefon ma agresywny battery-saver (Samsung/Xiaomi itp.) — to ten sam
   problem co w Alertach (patrz runda "Alerty: diagnostyka baterii/alarmów" wyżej):
   użyj "Optymalizacja baterii" w Alertach, żeby appka nie usypiała nasłuchu.
4. Zapłać czymkolwiek kartą/BLIK-iem (albo poczekaj na przelew) → powinno przyjść
   powiadomienie z Pekao/PKO.
5. "Sprawdź teraz (diagnostyka)" w Ustawieniach → powinno pokazać "Przechwycono N
   powiadomień" + czy coś trafiło do kolejki. Jeśli "nasłuch NIC nie odbiera" —
   krok 2 nie zadziałał albo OEM usypia usługę (krok 3).
6. "Płatności do zatwierdzenia" → karta z kwotą/sklepem/tagami → edytuj tagi →
   Zatwierdź → sprawdź że wydatek pojawił się w "Ostatnie transakcje" na Finanse.
7. Zapłać w TYM SAMYM sklepie jeszcze 4 razy (albo edytuj pamięć ręcznie) — po 5
   czystych akceptacjach sprzedawca powinien przejść na automat (patrz "Zaufanie
   N/5" na karcie, potem "Sklep na automacie" przy kolejnej płatności).
8. Jeśli bank przyśle przelew przychodzący (nie kartowy) — sprawdź że trafia jako
   przychód, nie wydatek, z opcją "To wypłata z pracy".

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 164/164 zielone (27 nowych
testów: `bankNotification`/`bankAmountMatch`/`bankNotificationDedup`/`bankCommit`),
`npx expo export --platform android` bez błędów, `npx expo prebuild --platform
android` generuje poprawny natywny serwis + wpis w manifeście.

**CI zielone (run #71)** — natywny `Sapp2NotificationListener.kt` wygenerowany przez
plugin skompilował się poprawnie w Gradle, APK gotowy.

## Finanse — Faza 2.6 "Wibracje" UKOŃCZONA (2026-11-01)

User: "dawaj dalej" po Fazie 2.5 → ostatni krok z planu Finansów. `utils/haptics.ts`
(port z sapp, uproszczony pod lokalny AsyncStorage-flag zamiast sapp's
`appSettings.ts`) + JEDEN globalny przełącznik w Ustawieniach → Ogólne (nowa sekcja).
Wpięte w Finanse: toggle taga (AddExpenseModal, ReceiptItemRow — checkbox i chipy
`foodSubcat`, bank-review.tsx), zatwierdź (AddExpenseModal zapis, bank-review
akceptacja, kalibracja salda), połącz duplikat (ProductsModal).

**DO PRZETESTOWANIA NA URZĄDZENIU**:
- Ustawienia → Ogólne → "Wibracje" → powinno buczeć przy tapie (i WŁ, i WYŁ pokazują
  ten sam ostatni "potwierdzający" bzyk zanim się przełączy).
- Z wibracjami włączonymi: w Finansach — zaznacz/odznacz checkbox pozycji paragonu,
  dodaj/usuń tag, zapisz wydatek, zatwierdź płatność z banku, połącz duplikat w
  Produktach — każde powinno dać krótki, wyczuwalny bzyk.
- Wyłącz wibracje w Ustawieniach → te same akcje powinny być całkowicie ciche.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 164/164 zielone,
`npx expo export --platform android` bez błędów.

## Poprawki po teście na urządzeniu (2026-11-01, runda 3)

User po kolejnym teście: "1. Nie dodałeś kalendarza jak klikam w transakcjach, 2. W
alarmach jest problem że otwiera się czasami ekran 2 razy, i nadal nie ma dźwięku
zaraz przetestuję jeszcze na oled".

1. **Kalendarz w edycji transakcji** — `AddExpenseModal.tsx`'s pole "Data" miało
   tylko "Dziś"/"Wczoraj" + statyczną odznakę, bez sposobu wybrania dowolnego dnia.
   Dodany `@react-native-community/datetimepicker` (nowa natywna zależność),
   odznaka daty jest teraz tappable i otwiera systemowy picker Androida.
2. **Alarm otwierał się czasem dwa razy** — `useNotifeeAlertLaunch.ts` używał
   `router.push` zamiast `router.replace`. `sendNotifeeAlert`'s test z
   `includeInstant=true` wysyła DWA powiadomienia na jeden tap (natychmiastowe +
   opóźnione), każde z tym samym `data.route` — oba osobno potrafiły odpalić
   nawigację i nałożyć się na stosie. `replace` naprawia to (szczyt stosu się
   podmienia, nie dubluje).
3. **Dźwięk w alertach — wciąż bez zmian w kodzie** (user sam to zaznaczył, idzie
   testować OLED dalej) — jak opisane w poprzedniej rundzie, to prawdopodobnie coś
   po stronie urządzenia (głośność powiadomień/dostęp "Nie przeszkadzać"), nie
   kolejny blind-guess w kodzie dopóki nie ma nowego sygnału z urządzenia.

**DO PRZETESTOWANIA NA URZĄDZENIU**:
- Finanse → tap na transakcję → pole "Data" → tap na odznakę z datą → powinien
  otworzyć się systemowy kalendarz, wybór dowolnego dnia działa.
- Alerty → uruchom dowolny test notifee → alarm powinien otworzyć się RAZ, nie
  dwa razy nałożone na siebie.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 164/164 zielone,
`npx expo export --platform android` bez błędów, `npx expo prebuild --platform
android` generuje poprawny projekt z nowym datetimepicker-pluginem.

## Ustawienia — stopniowany układ + toggle/odznaka zgody (2026-11-01)

User zrzutem ekranu sekcji Finanse: "nie rozróżniam nazwy kategorii od
podkategorii, oraz jak coś jest pozwoleniem żeby miało symbol albo było jakoś
oznaczone że to zgoda albo miało toggle jak w ustawieniach telefonów".

Przeprojektowany `app/settings.tsx` (pełne szczegóły w ARCHITECTURE.md §Ogólne
"Ustawienia — przeprojektowany wygląd wierszy"):
- Prawdziwe przełączniki (`Switch` z react-native, wygląd 1:1 jak w systemowych
  Ustawieniach) dla: Wibracje, Powiadomienia z banku, Dodawaj automatycznie.
- Odznaka "Zgoda" + ikona tarczy przy wierszach prowadzących do ekranu
  systemowego (Dostęp do powiadomień, Optymalizacja baterii, Dokładne alarmy) —
  appka nie potrafi sprawdzić prawdziwego stanu tych uprawnień bez nowego
  natywnego modułu, więc to oznaczenie, nie udawany toggle.
- Wiersze zależne od innego ustawienia (4 pozycje pod "Powiadomienia z banku")
  są teraz wcięte i mniejsze — widać że są "pod" rodzicem, nie na tym samym
  poziomie.
- Podtytuły (`description`) WRESZCIE są widoczne pod każdą etykietą — wcześniej
  istniały tylko do wyszukiwania, nigdy się nie renderowały, co był większy
  powód "nie widzę różnicy między wierszami" niż sam brak wcięcia.

**DO PRZETESTOWANIA NA URZĄDZENIU**:
- Ustawienia → Finanse → "Powiadomienia z banku" powinno wyglądać jak
  prawdziwy przełącznik (suwak), nie przycisk. Po włączeniu pod spodem
  pojawiają się 4 mniejsze, wcięte wiersze.
- "Dostęp do powiadomień" / Alerty → "Optymalizacja baterii"/"Dokładne alarmy"
  powinny mieć małą niebieską odznakę "Zgoda" przy nazwie.
- Pod każdą nazwą ustawienia powinien być widoczny krótki opis/stan (np.
  "łap płatności kartą/przelewy z Pekao i PKO automatycznie").

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 164/164 zielone,
`npx expo export --platform android` bez błędów.

## Dashboard — widget #JEDZENIE podpięty do realnych danych (2026-11-01)

User: *"czemu na dashboardzie nie ma widgetu ostatniego tego na dole z wydatkami
jedzenie (tylko miał być bez scrolla - czyli skrócona jego wersja jakby - pełna po
kliknięciu)"* — kafle (StatTile "DZIENNIE #JEDZENIE" + `FoodBarsTile` +
`WydatkiModal`) były fizycznie na ekranie dokładnie w tym bez-scrolla/popup-po-
kliknięciu wzorcu, jakiego user pyta — ale renderowały `MOCK_FOOD_*` z 2026-10-30,
więc nigdy nie zmieniały się mimo realnie dodawanych paragonów. To czytało się jako
"nie ma go".

Nowy `src/utils/foodStats.ts` (`foodByMonth`, `foodDailyAverageThisMonth`,
`foodByWeekOfMonth`, `foodByCategory`) — wszystko na `fvSplitOf` z
`fixedVariable.ts`, patrz ARCHITECTURE.md §DASHBOARD. `app/(tabs)/index.tsx` rząd 4
teraz czyta `useExpensesStore` zamiast stałych `MOCK_FOOD_COLUMNS`/
`MOCK_FOOD_WEEKS`/`MOCK_FOOD_CATEGORIES` (usunięte całkiem).

Przy tej samej okazji drobny fix bezpieczeństwa w `FoodBarsTile.tsx`/
`FoodBreakdownCard.tsx`: `Math.max(1, ...)` floor na dzielnikach wysokości/
szerokości słupków — z mockiem (zawsze >0) nigdy się to nie ujawniało, ale realne
dane (nowy user/miesiąc bez paragonów = same zera) dawały `NaN%` na wysokości
słupka bez tego floora.

**DO PRZETESTOWANIA NA URZĄDZENIU**:
- Dashboard, rząd 4 → "DZIENNIE #JEDZENIE" powinno pokazywać realną dzienną
  średnią (0,0 jeśli brak paragonów tego miesiąca, nie crashować).
- `FoodBarsTile` ("#JedzeniePerMiesiąc") → 5 kolumn: "~ŚR" (średnia) + 4 ostatnie
  miesiące, ostatni (bieżący) jaśniejszy (`kind:'highlight'`).
- Tap na kafel → `WydatkiModal` → tytuł miesiąca/suma/% zmiany vs poprzedni
  miesiąc, 5 słupków T1-T5, lista kategorii (`foodSubcat`) z kwotami — wszystko
  realne, zgodne z faktycznie dodanymi paragonami.
- Dodaj nowy wydatek z jedzeniem → wartości na Dashboardzie/w popupie powinny się
  zmienić po zapisaniu (bez potrzeby przeładowania appki — `useExpensesStore` jest
  reaktywny).

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 135/135 zielone,
`npx expo export --platform android` bez błędów.

## Finanse — Faza 2.7 "Historia, cofnięcie, szablony" UKOŃCZONA (2026-11-01)

User po Fazie 2.5/2.6, dwuczęściowe zgłoszenie: *"1. Okej ale mam nadzieję ze
zrobiles w zatwierdzeniu historie żebym mógł cofnąć albo stworzyć szablon z
wylapanych nie? 2. Jak kilkam w jedzenie nie mam tam robite na taki na popupie jak
w sap na dahsbordzie"*. Pełne szczegóły w ARCHITECTURE.md §FINANSE "Historia,
cofnięcie, szablony (Faza 2.7)" i §DASHBOARD "Drill-down kategorii jedzenia".

**Część 1 — historia/cofnij/szablon** (bank-review.tsx, nowy `app/bank-history.tsx`):
- `bankQueueStore.ts`'s `history` istniał od Fazy 2.5, ale nigdy nie był wyświetlany
  i nie niósł `expenseId`/`matched` — teraz dopisywane PO commicie, napędzają "Cofnij".
- "Cofnij" (`bankCommit.ts`'s `undoBankHistoryEntry`) — nowy wydatek → usuwa go
  całkiem; scalony z istniejącym → tylko odpina `bankMatched`, nie usuwa.
- "Stwórz szablon z tego" — NIE drugi mechanizm dopasowywania (sapp's
  `bankRulesStore` zostaje nieportowany) — fast-track `merchantMemory`
  (`saveMerchant`+`setMerchantAuto` od razu, pomija `AUTO_THRESHOLD`). Przycisk w
  `bank-review.tsx` (karta, gdy sprzedawca jeszcze nie `auto`) i w nowym
  `app/bank-history.tsx` (per wpis, też na już-zaksięgowanych — czyli dokładnie
  "z wyłapanych").
- Wejście: Ustawienia → Finanse → "Historia i szablony" (`tier:'sub'`), + ikona w
  nagłówku `bank-review.tsx`.

**Część 2 — drill-down #JEDZENIE** (`FoodBreakdownCard.tsx`, nowy
`FoodCategoryItemsModal.tsx`): wiersze kategorii w popupie "Wydatki" → zakładka
Jedzenie miały strzałkę ">" od szkieletu (2026-10-30), ale były dekoracją, bo dane
wtedy były mockiem. Teraz realne (Faza 2.4), więc stuknięcie w kategorię (np.
"Pieczywo") otwiera popup z konkretnymi pozycjami paragonów złożonymi na nią w
danym miesiącu — drugi modal STACKUJĄCY SIĘ na `WydatkiModal`, nie zamykający go.

**DO PRZETESTOWANIA NA URZĄDZENIU**:
1. Zaakceptuj płatność z banku w "Płatności do zatwierdzenia" → otwórz "Historia i
   szablony" (Ustawienia → Finanse, albo ikona w nagłówku przeglądu) → wpis powinien
   się tam pojawić z tagami jakie faktycznie ustawiłeś (nie podpowiedzią).
2. "Cofnij" na tym wpisie → wydatek powinien zniknąć z Finansów/"Ostatnie
   transakcje", wpis w historii zostaje (wyszarzony, "cofnięte"), bez "Cofnij" drugi
   raz.
3. "Cofnij" na wpisie który był SCALONY z już istniejącym wydatkiem (dodanym
   ręcznie wcześniej, ta sama kwota/dzień/sklep) → ten wydatek powinien ZOSTAĆ (nie
   zniknąć), tylko traci oznaczenie "złapane z banku".
4. "Stwórz szablon z tego" (w przeglądzie LUB w historii) → sprzedawca powinien od
   razu pokazać "Sklep na automacie" przy następnej płatności, bez czekania na 5
   akceptacji.
5. Dashboard (albo Finanse) → kafelek #JEDZENIE → popup "Wydatki" → zakładka
   Jedzenie → stuknij w kategorię z pozycjami (np. "Pieczywo") → powinna otworzyć
   się lista konkretnych produktów/kwot/dat złożonych na tę kategorię w tym miesiącu,
   suma na górze zgodna z kwotą na liście kategorii pod spodem.
6. "Wyczyść" w nagłówku Historii → czyści log (bez dialogu potwierdzenia, appka tego
   nigdzie nie robi) — nie dotyka już zaksięgowanych wydatków, tylko log.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 170/170 zielone (6 nowych
testów: `expenseId`/`undoBankHistoryEntry` w `bankCommit.test.ts`, `items` w
`wydatkiData.test.ts`), `npx expo export --platform android` bez błędów (w tym
nowy route `app/bank-history.tsx`).

## Redesign rdzenia UI — Faza 3.1 "Fundament" UKOŃCZONA (2026-11-01)

User podesłał pełny spec HTML (`design/app-design.html`, skopiowany do repo z
uploadu) i napisał: *"UZNAJ TEN DESIGN JAKO ABSOLUTNY CORE NASZEJ APK SAPP2 zacznij
przebudowe"*. Pełny opis zakresu/decyzji w ARCHITECTURE.md §"REDESIGN RDZENIA UI
(Faza 3)" — tu tylko skrót + checklist.

**Zakres tej rundy = fundament, NIE ekrany.** Żaden ekran się jeszcze wizualnie nie
zmienił — to nowe, nieużywane jeszcze tokeny/fonty/komponenty/bottom-sheet, gotowe
pod kolejne fazy (3.2 Dashboard, potem Nav/Daily/Finanse/Zadania/Ustawienia).

Co powstało: `@gorhom/bottom-sheet`+`expo-blur` (nowe zależności, zero nowych
wpisów w `app.json` plugins), `GestureHandlerRootView`+`BottomSheetModalProvider`
w `app/_layout.tsx`, tokeny wyrównane do spec w `colors.ts`/`theme/index.ts`, fonty
600/800 dodane, 9 nowych komponentów w `src/components/design/` (Tile/StatTile/Row/
Tag/PricePill/Segmented/ChipRow/StackBar/Bars) + `AppBottomSheet` (ten sam kontrakt
`visible`/`onClose`/`children` co istniejące modale — migracja = zamiana wrappera).

**Dwie decyzje od usera, OD RAZU po Fazie 3.1** (patrz ARCHITECTURE.md):
1. Zakładka **Pupil** → "usuwamy pupila zupełnie go nie będzie zakładka odpada" —
   USUNIĘTA tego samego dnia (`app/(tabs)/pupil.tsx` + `PlaceholderScreen.tsx`
   skasowane, `TabBar.tsx`/`_layout.tsx` zejście na 4 korzenie). Patrz niżej.
2. Metryki zdrowia — "odłóż na osobną fazę (polecam)", potwierdzone. Kafle
   dostaną `ComingSoonRow`-placeholder przy Fazie 3.2, nie fałszywe dane.

## Pupil usunięty całkowicie (2026-11-01)

Natychmiastowa realizacja decyzji #1 wyżej. Usunięte: `app/(tabs)/pupil.tsx` (route),
`src/components/ui/PlaceholderScreen.tsx` (jedyny konsument, teraz osierocony).
Zmienione: `TabBar.tsx`'s `TABS` (4 wpisy, bez `pupil`/`PawPrint`), `app/(tabs)/
_layout.tsx`'s `ROUTES` (bez wpisu `pupil`), drobne odświeżenie nieaktualnych
komentarzy wzmiankujących Pupila w `daily.tsx`/`colors.ts`/ARCHITECTURE.md.
NIE dotknięte (świadomie, osobna decyzja na przyszłość jeśli w ogóle potrzebna):
hooki na "przyszłą roślinkę/Pupila" głębiej w ekranie Ćwiczeń (punkty za
ukończone treningi — nieużywana, ale niezepsuta infrastruktura, patrz
ARCHITECTURE.md §ĆWICZENIA).

**DO PRZETESTOWANIA NA URZĄDZENIU**: navbar ma teraz 4 ikony (Dashboard/Daily/
Finanse/Zadania) + Ustawienia osobno, bez Pupila — sprawdź że nic nie próbuje
nawigować na `/pupil` (powinno dawać 404 expo-router, nie crash) i że pasek wygląda
OK z czterema ikonami (mogą się trochę poszerzyć/wycentrować inaczej niż z pięcioma).

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 170/170 zielone, `npx expo
export --platform android` bez błędów.

**DO PRZETESTOWANIA NA URZĄDZENIU**: nic wizualnie widocznego jeszcze (fundament
bez ekranów) — ale warto zweryfikować, że appka w ogóle startuje i działa normalnie
po dodaniu `GestureHandlerRootView`/`BottomSheetModalProvider` (nawigacja między
zakładkami, otwieranie istniejących modali/alertów typu `alert-test`) — te dwa
providery owijają CAŁĄ appkę, więc regresja tutaj uderzyłaby wszędzie, nie w jeden
ekran.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 170/170 zielone (bez zmian —
nowa warstwa to czyste UI-komponenty, nic do testu jednostkowego na tym etapie),
`npx expo export --platform android` bez błędów, `npx expo prebuild --platform
android` generuje poprawny natywny projekt z nowymi zależnościami.

## Redesign rdzenia UI — Faza 3.2 "Dashboard" UKOŃCZONA (2026-11-01)

User: "dawaj" po Fazie 3.1 (fundament) + decyzjach o Pupilu/Health Connect.
Dashboard przebudowany na nowy system komponentów (`Tile`/`StatTile`/`Row`/
`PricePill`/`Bars`/`FitList`), układ 1:1 z `design/app-design.html`'s `#dash`.
Pełny opis co realne/co stub w ARCHITECTURE.md §DASHBOARD — skrót: Woda/Słodycze/
Trening/Sen = stub "Wkrótce" (brak store'a nawyków/Health Connect, uczciwie
nieinteraktywne); hot-event-tile/Ciekawostka/Jedzenie/#JedzeniePerMiesiąc/Ostatnie
transakcje/Bezpieczne wydatki (uproszczone, bez rachunków cyklicznych)/Najbliższe
48h = REALNE dane z istniejących store'ów (kalendarz, wydatki, saldo).

Stare komponenty Dashboardu USUNIĘTE (po przełączeniu nic ich już nie
importowało): `src/components/dashboard/{StatTile,FactTile,SleepTile,
TaskListTile,FoodBarsTile,PatternTileBackground,tilePosition}.*`. Nowy
`src/components/design/FitList.tsx` — generyczny "lista pokazuje tyle ile się
zmieści" (`onLayout`→`Math.floor`→`slice`, CLAUDE.md regl #1), użyty w "Ostatnie
transakcje"/"Najbliższe 48h" zamiast sztywnego "pierwsze 4".

**DO PRZETESTOWANIA NA URZĄDZENIU**:
- Dashboard musi się WCIĄŻ NIE scrollować, na różnych wysokościach ekranu/z
  włączonymi dużymi czcionkami systemowymi (to jest pierwszy prawdziwy test
  `FitList` na prawdziwym urządzeniu — w symulacji/eksporcie liczy się tylko że
  się kompiluje, nie że dociąga poprawną liczbę wierszy).
- "Ostatnie transakcje"/"Najbliższe 48h" — powinny pokazać TYLE wierszy ile się
  zmieści w danym rzędzie, bez ucinania w połowie wiersza i bez nadmiarowego
  odstępu pod listą.
- Hot-event-tile — jeśli masz dziś/wkrótce wydarzenie w kalendarzu (lokalnym lub
  Google), powinno się pojawić z odwróconymi kolorami + pulsującą kropką gdy
  zaczyna się w ciągu 90 min, inaczej neutralny kafel z godziną startu. Brak
  wydarzeń → "BRAK WYDARZENIA", nie crash.
- Ciekawostka — tap cyklicznie zmienia tekst (4 fakty w kółko), ta sama
  ciekawostka przy ponownym wejściu na Dashboard tego samego dnia.
- Bezpieczne wydatki — liczba powinna być saldo/dni-do-końca-miesiąca (bez
  rachunków, bo ich jeszcze nie ma), pasek czerwony gdy dzisiejsze wydatki
  przekroczą ten limit.
- Jedzenie PLN/dzień, #JedzeniePerMiesiąc, tap→`WydatkiModal` — bez zmian
  funkcjonalnych względem wcześniejszych rund, tylko nowy wygląd.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 170/170 zielone, `npx expo
export --platform android` bez błędów.
