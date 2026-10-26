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
- Satelickie ekrany z `sapp` (produkty, pojazdy, nawyki) — nierozstrzygnięte czy
  zostają jako osobne ekrany czy wtapiają się w kontekst innych ekranów.

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
- Kafelek pogody — brak pełnej specyfikacji typografii jak reszta, duża ikona
  CloudSun zamiast dolnej etykiety to przybliżenie.

## Navbar + Ustawienia — zbudowane (2026-10-26)

`TabBar.tsx` przebudowany: klaster 5 zakładek ściśnięty do prawej krawędzi (nie pełna
szerokość), kolejność `Dashboard → Daily → Finanse → Zadania → Pupil` (Pupil skrajnie
prawy = najczęstszy = najbliżej kciuka). "Notatki" z wcześniejszej notatki zastąpione
realnie istniejącym "Zadania" — **do potwierdzenia przez usera czy to poprawne
podstawienie, czy "Notatki" miało być osobnym, jeszcze niezbudowanym ekranem**. Ikona
Ustawień przeniesiona z pływającego przycisku na Dashboardzie (nachodził na kafelek
pogody) na stałe miejsce w lewym dolnym rogu paska, osobno od klastra 5 zakładek.

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
