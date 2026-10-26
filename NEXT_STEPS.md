# NEXT_STEPS.md — sapp2

Co dalej / otwarte wątki między sesjami. Jedyne miejsce w repo śledzące to na bieżąco —
aktualizuj po skończeniu/odkryciu czegoś nowego (patrz `CLAUDE.md`).

## Zdecydowane, jeszcze niezbudowane

- **Nawigacja: pozioma belka 5 ekranów, ściśnięta do prawej krawędzi** (nie pełna
  szerokość, nie D-pad z okręgiem na środku — rozważany, odrzucony na rzecz mniejszego
  zasłaniania treści i prostszej budowy). Kolejność od lewej do prawej wg częstości
  użycia (najrzadszy → najczęstszy, bo prawy skraj = najbliżej kciuka = najkrótszy
  ruch):
  `Dashboard → Daily → Finanse → Notatki(+Kal) → Pupil`
  Dashboard na lewym (najdalszym) końcu celowo — to i tak zawsze pierwszy ekran po
  starcie appki, więc rzadko trzeba go kliknąć ręcznie.
- **Domyślna ręka: prawa**, z możliwością przełączenia na lewą w ustawieniach
  (wtedy belka pewnie lustrzanie do lewej krawędzi — do dopracowania przy budowie).

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
