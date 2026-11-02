# ARCHITECTURE.md — sapp2

Mapa ekranów i połączeń między nimi. Rozpisana przez usera (2026-10-26), zapisana tu
żeby się nie zgubiła między sesjami. Aktualizuj przy każdej decyzji o nowym
ekranie/połączeniu (patrz `CLAUDE.md`).

**Stan budowy** (2026-10-30): Dashboard w pełni zbudowany (monochromatyczny redesign,
patrz NEXT_STEPS.md). **Zadania ma teraz realne UI** (kalendarz tydzień↔miesiąc +
CRUD listy, offline-first przez `calendarStore`, patrz sekcja ZADANIA niżej) —
widget na pulpit JESZCZE NIE zrobiony. Daily/Finanse wciąż mają **lekki szkielet
struktury** (layout, sekcje, nagłówki — bez głębokiej logiki) — kolejność faz:
Zadania UI (zrobione) → widget → Finanse+parsery → Praca/Daily. *(Ten akapit jest z
2026-10-30, mocno nieaktualny co do Daily/Finanse — patrz NEXT_STEPS.md dla
faktycznego stanu. Pupil USUNIĘTY całkowicie, Faza 3.1 — patrz §PUPIL niżej.)*

Oznaczenia głębokości nawigacji:
- **GE** — Główny Ekran (jeden z 5 w navbarze)
- **PE** — Pod Ekran (`>`, jeden poziom głębiej)
- **PPE** — Pod Pod Ekran (`>>`, dwa poziomy głębiej)

## REDESIGN RDZENIA UI — "Sokki App Design" (Faza 3, 2026-11-01)

User: *"UZNAJ TEN DESIGN JAKO ABSOLUTNY CORE NASZEJ APK SAPP2 zacznij przebudowe"* —
pełny spec HTML (tokeny/zasady/komponenty/ekrany/logika) zapisany w repo jako
**`design/app-design.html`** (dokładnie ten plik, otwórz w przeglądarce — każdy ekran
klikalny, to ŹRÓDŁO PRAWDY dla kolejnych faz, nie ten opis). To w dużej mierze
FORMALIZUJE kierunek, w który appka już szła (monochromatyczny audyt Dashboardu
2026-10-30, "#D6D6D6 to domyślny biały", "tło = perfect BLACK" — user używał już
tych sformułowań wcześniej) — nie przypadkowy zwrot o 180°.

**Zakres tej rundy = FUNDAMENT (tokeny + fonty + biblioteka komponentów bazowych +
infrastruktura bottom-sheet), NIE przebudowa samych ekranów.** Ekrany
(Dashboard/Daily/Finanse/Zadania/Ustawienia) idą jako kolejne, osobne fazy
(3.2, 3.3, …), ten sam rytm co Finanse (2.1→2.7) — zbyt duży, nietestowalny skok
żeby robić to w jednej rundzie bez weryfikacji między krokami.

**Trzy decyzje zakresu podjęte SAMODZIELNIE (do korekty na życzenie)**:
1. **Spec = warstwa WIZUALNA/interakcji, NIE mandat na model danych.** Mockup ma
   przykładowe dane ze sztywną `category` per transakcja (`c:'Rozrywka'`) i parser
   bankowy po słowie-kluczowym z wyciągu — to jest DEMO-treść do zrobienia mockupu
   konkretnym, nie żądanie przywrócenia sztywnych kategorii (user sam je odrzucił,
   patrz redesign modelu niżej w §FINANSE) ani zastąpienia już działającego,
   przetestowanego nasłuchu powiadomień bankowych (Faza 2.5) parserem wyciągu.
   Realne dane/logika (tagi, nasłuch banku, receiptItems) ZOSTAJĄ — nowe komponenty
   renderują je, nie zastępują.
2. **Metryki zdrowia (Sen/Kroki/Tętno/Waga/Woda, Galaxy Watch/Health Connect) —
   ŚWIADOMIE ODŁOŻONE jako osobna, duża faza.** Appka NIE MA jeszcze żadnej
   integracji Health Connect — to byłby nowy natywny moduł/uprawnienia/sync, nie
   "tylko UI". Dopóki nie zbudowane: te kafle renderują się jako `ComingSoonRow`-owy
   placeholder (ten sam wzorzec co Subskrypcje/Praca/Pojazdy), NIE fałszywe dane.
3. **Bottom-sheet zastępuje `Modal`/dedykowane route PO EKRANIE, nie wszystkie
   naraz.** `AppBottomSheet` (patrz niżej) ma TEN SAM zewnętrzny kontrakt
   (`visible`/`onClose`/`children`) co `WydatkiModal`/`TransactionsModal`/
   `FoodCategoryItemsModal`/`AddExpenseModal` — migracja każdego popupu to zamiana
   JEDNEGO wrappera, nie przepisanie logiki. Dashboard jako pierwszy (najbardziej
   szczegółowo opisany w spec), reszta w kolejności faz.

**Decyzje usera (od razu po Fazie 3.1)**: zakładka **Pupil** USUNIĘTA CAŁKOWICIE
("usuwamy pupila zupełnie go nie będzie zakładka odpada" — patrz §PUPIL). Metryki
zdrowia POTWIERDZONE jako osobna, odłożona faza (opcja 1 z dwóch zaproponowanych) —
`ComingSoonRow` dla nich w Fazie 3.2, nie fałszywe dane.

### Fundament — ZROBIONE (Faza 3.1, 2026-11-01)

- **Nowe zależności**: `@gorhom/bottom-sheet` (^5.2.14), `expo-blur` (~15.0.8) —
  `react-native-reanimated`/`react-native-gesture-handler` appka już miała (zero
  nowego ryzyka tam). `app/_layout.tsx` owinięte w `GestureHandlerRootView` +
  `BottomSheetModalProvider` (wymóg biblioteki, montowane RAZ na szczycie drzewa,
  obejmuje też ekran spinnera logowania).
- **Tokeny** (`src/theme/colors.ts`) — WYRÓWNANE do dokładnych hexów ze spec gdzie
  się różniły (`text.bright`→`#F2F2F2`, `text.muted`→`#6E6E6E`, `accent.green`→
  `#22C55E`; `bg.primary`/`bg.card`/`text.primary` już były identyczne). Nowe grupy:
  `colors.ui` (`in`/`in2`/`line`/`dim`/`ur`/`urTxt` — tła wierszy/chipów, obrysy,
  JEDYNY realnie kolorowy akcent w systemie), `colors.sleep` (fazy snu, gotowe na
  Health Connect później). `colors.accent`/`colors.stat` ZOSTAJĄ na razie (~14 miejsc
  użycia) — wymierają screen-po-screenie przy migracji, nie wyrywane teraz.
- **Promienie** (`src/theme/index.ts`) — `radius.tile/inner/sheet/btn/chip` (18/10/
  28/16/12) dodane obok istniejących `sm/md/lg/xl/full`. `spacing` (indeksowany,
  `spacing[2]=8`/`spacing[3]=12`) już pokrywał `S{screenX,gap,tilePad}` ze spec 1:1 —
  zero nowych tokenów odstępu potrzebnych.
- **Fonty** — dodane `Inter_600SemiBold`/`Inter_800ExtraBold` (miała
  200/400/500/700/900) w `app/_layout.tsx`'s `useFonts`.
- **Biblioteka komponentów** (`src/components/design/`, NOWY folder — sibling
  `dashboard/finances/mood/tasks/ui`): `Tile` (kontener kafla, scale-on-press przez
  `Pressable` z `react-native-gesture-handler` — NIE zwykły RN `Pressable`, żeby
  współpracował z gesture-context otwartego sheeta; warianty `default/hot/static`,
  pulsująca kropka na `hot` odtworzona jako rozchodzący się pierścień, nie CSS
  box-shadow), `StatTile` (liczba/jednostka/etykieta, identyczna struktura),
  `Row` (dawne "Item" ze spec — wiersz listy, opcjonalny `sublabel` dla 2-liniowych
  transakcji w Finanse), `Tag` (warianty `default/ur/fr/jd/alarm` — dzwonek z
  lucide), `PricePill` (wydatek=wypełniony, przychód=obrys zielony), `Segmented`
  (zakładki Teraz/Terminowe/Bez terminu z licznikiem), `ChipRow` (wariant zawijający
  i poziomo-scrollowalny z fade — `expo-linear-gradient`, appka już go miała,
  odtwarza CSS `mask-image` którego RN nie ma), `StackBar` (proporcjonalny pasek +
  legenda), `Bars` (słupkowy wykres kolumnowy, `Math.max(1,...)` na mianowniku to
  obowiązek wołającego, jak już w `foodStats.ts`).
- **`AppBottomSheet`** (`src/components/design/AppBottomSheet.tsx`) — `visible`/
  `onClose`/`children` + opcjonalne `header`/`footer`/`scrollable` (ostatnie dwa,
  2026-11-02, dodane przy migracji `MoodModal.tsx`, pierwszego realnego konsumenta).
  WEWNĄTRZ `BottomSheetModal` (nie plain `BottomSheet` — portal poza drzewem
  wołającego ekranu). `detached`+`bottomInset` (jedyny sposób w v5 na pływający sheet
  z marginesem z KAŻDEJ strony, nie tylko z góry — spec: `left/right/bottom:8px`).
  `enableDynamicSizing`+`maxDynamicContentSize`=78% wysokości ekranu. Backdrop:
  `BottomSheetBackdrop` + `BlurView` (`expo-blur`) + 60% czarny, dziecko nad dzieckiem
  (blur nie steruje przezroczystością tła, tylko rozmyciem pod nim).
  `header` renderuje się w stałym `BottomSheetView` NAD treścią (nie scrolluje —
  tytuł/przyciski-ikony zawsze widoczne). `children` idzie przez `BottomSheetScrollView`
  domyślnie (`scrollable=false` → zwykły `BottomSheetView`, dla krótkiej, statycznej
  treści bez potrzeby scrolla). `footer`, jeśli podany, idzie przez `footerComponent`
  (`BottomSheetFooter`) — osobna, ABSOLUTNIE pozycjonowana warstwa, zawsze przypięta
  do dołu sheeta i automatycznie odpychana przez klawiaturę (`keyboardBehavior=
  "interactive"`, `android_keyboardInputMode="adjustResize"`); `body` dostaje dodatkowy
  `paddingBottom`, żeby treść się pod nią nie chowała. `TextInput`y WEWNĄTRZ sheeta
  muszą być gorhom's `BottomSheetTextInput` (nie zwykły `TextInput` z 'react-native' —
  gubi fokus/zaznaczenie przy przewijaniu).
- **Pierwszy realny konsument: `MoodModal.tsx`** (2026-11-02, patrz §DAILY). Pozostałe
  popupy (AddExpenseModal/ProductsModal/TransactionsModal/WydatkiModal, balance-edit,
  DayDetailModal, AddTaskCard-composer) wciąż `Modal` — migracja screen-po-screenie,
  patrz "Następne fazy" niżej.

Zweryfikowane: `npx tsc --noEmit` czysto, `npx jest` 170/170 zielone (bez zmian w
testach — nowa warstwa to czyste komponenty UI, nic do testowania jednostkowo na
tym etapie), `npx expo export --platform android` bez błędów (fonty 600/800
spakowane), `npx expo prebuild --platform android` generuje poprawny natywny projekt
z nowymi zależnościami (zero nowych wpisów w `app.json`'s `plugins` — `expo-blur`/
`@gorhom/bottom-sheet` autolinkują się bez config-pluginu).

**Faza 3.2 (Dashboard) — ZROBIONA (2026-11-01, "dawaj")**, patrz §DASHBOARD wyżej
po pełny opis co realne/co stub.

**Faza 3.3 (Daily) — ZROBIONA (2026-11-01, "dawaj skończ wszystko")**, patrz
§DAILY wyżej.

**Faza 3.4 (Finanse, główny ekran) — ZROBIONA (2026-11-01, "dawaj skończ
wszystko")**, patrz §FINANSE niżej. Popupy świadomie bez zmian (ciąg dalej).

**Faza 3.5 (Zadania) — ZROBIONA (2026-11-01, "dawaj skończ wszystko")**, patrz
§ZADANIA niżej.

**Faza 3.6 (bottom-sheet: pierwszy popup, `MoodModal`/Daily) — ZROBIONA
(2026-11-02)**, user po zrzucie ekranu Daily: "wgle sie nie postarałeś... ze
animacje jak blur wylatuje, wyglądało 1do1 jak tam". Dwie rzeczy naraz:
1. **Realny bug, nie estetyka** — kafel "Nastrój" renderował się jako wąski,
   wyśrodkowany pasek, nie pełna szerokość rzędu. Naprawione w `Tile.tsx` (patrz
   komentarz tam), zweryfikowane zmierzonym `getBoundingClientRect()` w izolowanym
   `react-native-web` renderze (nie samym screenem — pierwsze podejście screenem
   wygłądało identycznie dla buggy/fixed wersji i zmyliło). Dotyczy KAŻDEGO
   interaktywnego kafla na wszystkich 4 przebudowanych ekranach, jeden fix w
   jednym miejscu.
2. **Brakująca fidelity bottom-sheet/blur** — `AppBottomSheet.tsx` istniał od
   Fazy 3.1, ale ŻADEN popup go nie używał. `MoodModal.tsx` (jedyny popup na
   Daily, dokładnie to co user miał na ekranie) jako pierwszy realny migrant —
   `header`/`footer` propsy dodane do `AppBottomSheet` przy tej okazji (potrzebne
   bo MoodModal ma stały nagłówek z przełącznikiem widoku + przypięty przycisk
   "Zapisz", nie goły blob treści). Szczegóły: §DAILY "Humor / Nastrój" wyżej,
   AppBottomSheet opis wyżej.

**Ustawienia — styl 1:1 z Fazy 3.1, struktura NIE identyczna co spec
(uzasadnione, patrz niżej).** Poprawka (2026-11-02, user: "miało być 1do1...
żeby wszystko miało ten sam styl nawet ustawienia") do wcześniejszej wersji
tego akapitu, która błędnie opisywała `design/app-design.html`'s `#set` jako
"5 kafli-kategorii, tap wchodzi w pełną listę" — PO ponownym przeczytaniu
mockupu, `#set` wcale nie ma drugiego poziomu: to 5 `.tile.static` kart
(Profil/Połączenia/Finanse/Cele/Aplikacja) z wierszami `.set` WPROST w środku,
ZAWSZE widocznymi, bez tapu. `app/settings.tsx` miał inaczej: kafel-kategoria →
tap → osobny widok pełnej listy (port wzorca z sapp). Naprawione:
- **Drill-down USUNIĘTY** — `activeSectionId` i cały "kategoria → pełna lista"
  stan/branch zniknęły. Sekcje renderują się TERAZ wszystkie naraz, jedna pod
  drugą, każda jako podpis `.cap` (ten sam co podpisy kafli na Daily/Zadaniach)
  + karta z wierszami wprost pod nim — dokładnie mechanika spec.
- **`radius.lg`(16) → `radius.tile`(18)** na kartach sekcji/polu szukania —
  dokładny token, nie "podobny".
- **`Toggle`** (`src/components/design/Toggle.tsx`, nowy) zamiast natywnego
  `Switch` z `trackColor.true: colors.accent.green` — natywny Switch kolorował
  stan "włączone" ZIELENIĄ, co łamało własną zasadę appki "kolor TYLKO jako
  funkcjonalny akcent" (patrz colors.ts) i nie miało odpowiednika w spec.
  `Toggle` matchuje `.tog` 1:1 (monochromatyczny: jasny tor + czarna kropka
  gdy włączone, ciemny tor + wygaszona kropka gdy wyłączone).
- Nagłówek: `fontSize`/`fontFamily`/`color` wyrównane do `.h1` (22→20/
  Inter_900Black/`text.bright`), ten sam co inne ekrany. Wyśrodkowanie +
  `ChevronLeft` ZOSTAJE (Ustawienia to pushowany ekran z realnym "wstecz" w
  `app/settings.tsx`, nie tab — to nawigacja, nie styl, spec jej nie definiuje).

**Co NIE zmienione, świadomie** — `app/settings.tsx` to WCIĄŻ przeszukiwalna,
scrollowalna lista dziesiątek realnych ustawień (bank-nasłuch, diagnostyka,
alerty, haptyka, konto Google…), nie nieprzewijalny czteropolowy grid jak
pozostałe 4 ekrany. Spec's `#set` jest `overflow:hidden`/nieprzewijalny jak
wszystkie inne screeny, ale to DZIAŁA tam tylko bo to uproszczone demo (5 kart
× 2-4 wiersze = ~12 wierszy total, mieści się). Realna treść Ustawień jest
WIELE RAZY większa (dziesiątki pozycji w 6 sekcjach) — upakowanie w
nieprzewijalny ekran by je OBCIĘŁO (spec's `overflow:hidden`, nie scroll), nie
pomieściło. Pole szukania (nie istnieje w spec — tam niepotrzebne przy 12
wierszach total) ZOSTAJE z tego samego powodu realnej skali. Odznaki ikon/
"Zgoda"/opisy-podtytuły pod etykietami też ZOSTAJĄ — to realna, celowo
dodana wcześniej w tej sesji wartość (user explicite prosił o te konkretne
rzeczy 2026-11-01, "nie rozróżniam nazwy kategorii od podkategorii... jak coś
jest pozwoleniem żeby miało symbol"), nie niedopasowanie stylu do usunięcia —
demo mockupu nie ma ich TYLKO bo demo nie ma nic do opisywania/oznaczania.

**Następne fazy** — bottom-sheet-yfikacja istniejących popupów Finansów/Zadań
(osobna, jeszcze nieumówiona faza, patrz §FINANSE). "Płatności cykliczne"
(store `bills`, odblokuje pełne "Bezpieczne wydatki"/"Najbliższe 48h" z Fazy 3.2
i "Praca"/"Najbliższa opłata" z Fazy 3.4) potrzebuje osobnej, uczciwej fazy —
dziś stub `Tile` w miejsce Subskrypcji/Pracy/bills, nie udawane na żadnym
ekranie. Health Connect (Sen/Kroki/Tętno/Waga/Woda) to trzecia duża, odłożona
faza.

## DASHBOARD [GE]

**Przebudowany na nowy system komponentów (Faza 3.2, 2026-11-01)** — patrz
§"REDESIGN RDZENIA UI" wyżej. Poniższy opis to AKTUALNA struktura; starszy opis
(4 stałe rzędy, `getTilePosition`/`StatTile.tsx`/`MOCK_TASKS`) jest historią,
te komponenty USUNIĘTE z repo.

**NIEprzewijalny, celowo** (bez zmian od 2026-10-31) — 5 rzędów o układzie
DOKŁADNIE jak w `design/app-design.html`'s `#dash` (4 kolumny, `grid-template-rows:
auto 96px auto 1fr 1.3fr`, w RN: `View flexDirection:'column'`, rzędy 1-3 content-
sized, rzędy 4-5 `flex:1`/`flex:1.3`). Listy w rzędach 4-5 używają `FitList`
(`src/components/design/FitList.tsx`) — mierzą realną dostępną wysokość przez
`onLayout` i docinają dane do tego co się zmieści, zero sztywnego "pierwsze 4"
(CLAUDE.md regl #1, dosłowny przepis `onLayout→Math.floor(h/rowH)→slice`).

**Rząd 1** — 3× `StatTile` streak (Woda/Słodycze/Trening) + hot event tile.
**Rząd 2 (96px)** — Ciekawostka + Sen.
**Rząd 3** — Jedzenie PLN/dzień (`StatTile`, tap→`WydatkiModal`) + #JedzeniePerMiesiąc
(`Bars`, tap→`WydatkiModal`).
**Rząd 4 (flex:1)** — Ostatnie transakcje (`FitList`+`Row`+`PricePill`) + Bezpieczne
wydatki.
**Rząd 5 (flex:1.3, najwyższy)** — Najbliższe 48h (`FitList`+`Row`).

**Co jest realne, co stub — ŻADEN kafel nie udaje danych których appka nie zbiera**
(decyzje #1/#2 z Fazy 3.1, zastosowane konkretnie tutaj):
- **Woda/Słodycze/Trening (streaki) — STUB, naprawiony pre-existing problem.**
  Stary Dashboard renderował tu SZTYWNE liczby ("74"/"4"/"12") jak gdyby realne —
  appka nie ma i nigdy nie miała store'a nawyków/odhaczania dni. Teraz: `StatTile`
  bez `onPress` (nieinteraktywna), `value="—"`, `unit="WKRÓTCE"`. Realny licznik to
  osobna, świadoma faza (potrzebuje: co liczy się jako "dzień czysty", UI
  odznaczania, nowy store) — nie zgadywana teraz.
- **Sen — STUB** (Health Connect nieistniejący, decyzja #2 z Fazy 3.1).
- **Hot event tile — REALNE.** Najbliższe nadchodzące wydarzenie z
  `calendarStore`'s `events`+`gcalEvents` (scalone, oba już realne od Fazy 1
  kalendarza) z godziną startu; `variant="hot"` (odwrócone kolory + pulsująca
  kropka) gdy start ≤90 min od teraz, licznik minut ("TERAZ" gdy już trwa). Brak
  nadchodzących wydarzeń → neutralny kafel "BRAK WYDARZENIA", nie fałszywy mock.
- **Ciekawostka — REALNE.** Statyczna lista 4 faktów (z mockupu), wybór
  deterministyczny po dniu roku (`dayOfYear(now) % FACTS.length` — ta sama
  ciekawostka cały dzień, nie losowa przy każdym wejściu), tap = następna (lokalny
  stan, bez popupu na razie — bottom-sheet-yfikacja popupów to inna faza).
- **Jedzenie PLN/dzień, #JedzeniePerMiesiąc, Ostatnie transakcje — REALNE, bez
  zmian w danych** (`utils/foodStats.ts`/`useExpensesStore`, od wcześniejszych
  rund), tylko nowy wygląd (`StatTile`/`Bars`/`Row`+`PricePill`).
- **Bezpieczne wydatki — REALNE, ale UPROSZCZONE.** `utils/balance.ts`'s
  `accountBalance()` (realne saldo) / dni do końca miesiąca — BEZ odjęcia
  nieopłaconych płatności cyklicznych, bo appka nie ma jeszcze store'a "bills"
  (patrz Finanse §Kolejność budowy — Subskrypcje/Praca wciąż `ComingSoonRow`).
  Pasek pod liczbą porównuje DZISIEJSZE realne wydatki (`affectsBalance`-
  filtrowane) do tego limitu, czerwony gdy przekroczony. Gdy store rachunków
  powstanie, odjęcie wraca — to jawne uproszczenie, nie fałszywe dane.
- **Najbliższe 48h — REALNE.** Merge `calendarStore`'s wydarzeń (start w oknie
  teraz→+48h) i zadań z terminem w tym oknie (`status:'pending'`), sortowane po
  czasie. Płatności cykliczne NIE wchodzą do merge'a (jak wyżej, store nie
  istnieje) — gdy powstanie, dołącza się jako trzeci typ wpisu.

Kliknięcie w kafelek z danymi finansowymi otwiera `WydatkiModal.tsx` (bez zmian —
pełnoekranowy `Modal`, NIE jeszcze `AppBottomSheet`; bottom-sheet-yfikacja istnieją-
cych popupów Finansów to kolejna, osobna faza, patrz §"REDESIGN RDZENIA UI"
"Następne fazy"). Streaki/Sen są NIEINTERAKTYWNE (brak `onPress` → `Tile` renderuje
się jako plain `View`, nie `Pressable` — zero udawanej klikalności).

## DAILY [GE]

**Przebudowany na nowy system komponentów (Faza 3.3, 2026-11-01)** — układ 1:1 z
`design/app-design.html`'s `#daily` (4 kolumny, `grid-template-rows: auto auto
auto 1fr auto`), NIEprzewijalny (był jedynym `ScrollView`-owym głównym ekranem w
appce — teraz zgodny z resztą). Rzędy: **Sen** (s4, stub) → **Kroki**+**Tętno**
(s2+s2, stub) → **Waga**+**Woda** (s2+s2, stub) → **Ćwiczenia** (s4, flex, stub) →
**Nastrój** (s4, REALNE — jedyna niestubowa sekcja). Wszystkie stuby = `Tile` bez
`onPress` (nieinteraktywne, `value="—"`/`unit="WKRÓTCE"`) — Health Connect
nieistniejący (Faza 3, decyzja #2) i brak store'a treningów, ten sam powód i ten
sam wzorzec co Dashboardu stuby (§DASHBOARD). `ComingSoonRow`/`LiveSectionRow`
(stary wzorzec listy wierszy) USUNIĘTE Z TEGO EKRANU — zostają w Finansach, gdzie
wciąż są używane (Subskrypcje/Praca w "Obszary").

### Humor / Nastrój (user, 2026-10-31: "dodawanie humoru... taka siatka jak w sapp i
opcjonalnym tekstem, zapisywanym w formie pamiętnika DZIEŃ DATA")
- Port z sapp 1:1, kategorio-niezależne, już dobrze zaprojektowane: `types/mood.ts`
  (`MoodEntry`: `mood`+`energy` 1-5, `note?`, `tags: string[]`), `utils/moodTags.ts`
  (56 presetów, sortowanie po trafności nastrój/energia + pora dnia + recency).
  `store/moodStore.ts` — wzorzec `calendarStore` (AsyncStorage, bez auto-Firestore
  jak sapp miało wbudowane — ta granica żyje gdzie indziej w sapp2, patrz Finanse).
- **`MoodEnergyGrid.tsx` → `src/components/design/MoodPad.tsx` (Faza 3.3)** —
  siatka 5×5 nastrój×energia, `Gesture.Pan()`/`GestureDetector`/`runOnJS`
  PRZENIESIONE bez zmian (już battle-tested na urządzeniu, port sapp) — zmienił się
  WYGLĄD, nie mechanika: zero emoji (było `MOOD_EMOJIS` jako tekst kropki — reguła
  #5 ze spec, "Zero emoji"), zero widocznych linii siatki 5×5 (subtelny krzyż przez
  środek zamiast), nowy `mini` wariant (podgląd w Daily, czysto wizualny, bez
  `GestureDetector`) i `big` wariant (etykiety narożników, w `MoodModal`). Model
  danych BEZ ZMIAN (wciąż kwantyzacja do 5 poziomów — "już dobrze zaprojektowany").
  ŚWIADOMIE uproszczone vs spec: brak tekstury tła z powtarzających się kropek i
  blurowanego "glow" pod kropką (wymagałoby SVG-wzoru/obrazka, kosmetyczny niuans).
- **Brak limitu wpisów/dzień** (jak w sapp) — UI liczy "ile już dziś" i tytułuje kolejne
  check-iny "Humor 2. raz dziś" itd. — to NATURALNIE realizuje "raz, potem drugi raz
  dziennie" z prośby usera, bez sztywnej reguły w danych.
- **`MoodModal.tsx`** — PIERWSZY popup przeniesiony na `AppBottomSheet` (2026-11-02,
  user: "animacje jak blur wylatuje... 1do1 jak tam" — mockup chce bottom-sheeta z
  blurem dla KAŻDEJ interakcji, nie pełnoekranowego `Modal`). `header`/`footer` jako
  nowe propsy `AppBottomSheet` (patrz tam) — nagłówek z przełącznikiem widoku: "Dodaj"
  (siatka+tagi+notatka) / "Pamiętnik" (wpisy grupowane po dniu, nagłówek "DZIEŃ ·
  {data po polsku}", notatki z check-inów renderowane jak akapity dziennika) stały NAD
  scrollem, przycisk "Zapisz" przypięty PRZEZ `BottomSheetFooter` (tylko w widoku
  "Dodaj"). **Brak NOWEGO pola na "dziennik dnia"** — notatka żyje na `MoodEntry.note`
  jak w sapp, "dopisać więcej o dniu" = kolejny check-in tego dnia z własną notatką.
  Tap na wpis w Pamiętniku → edycja.
  `GestureHandlerRootView`+RNGH `ScrollView`, które port z sapp wymagał wewnątrz
  pełnoekranowego `Modal`-a, ODPADŁY — `AppBottomSheet` renderuje się WEWNĄTRZ
  jedynego `GestureHandlerRootView` z `app/_layout.tsx` (przez
  `BottomSheetModalProvider`), więc `MoodPad`'owy `Gesture.Pan()` routuje się
  poprawnie bez dodatkowego roota; `TextInput`y zamienione na gorhom's
  `BottomSheetTextInput` (zwykły `TextInput` gubi fokus przy przewijaniu sheeta).
- **Wejście**: `app/(tabs)/daily.tsx`'s "Nastrój" kafel (rząd 5, Faza 3.3) — `Tile`
  z `MoodPad mini` + ostatni dzisiejszy wpis, tap na CAŁY kafel otwiera `MoodModal`
  (wcześniej: "Humor" wiersz, `LiveSectionRow` — ZASTĄPIONE przy przebudowie grida).
- **Kolejność sekcji "Dodaj" ODWRÓCONA (2026-11-01)**, user: "mam być wygodnie
  wpisywać... jak to jest na górze ekranu wszystko" — siatka (jedyny element
  wymagający przeciągania kciukiem) siedziała NAJWYŻEJ w scrollu, najdalej od
  naturalnej pozycji kciuka przy trzymaniu telefonu jedną ręką. Teraz: tagi →
  notatka → siatka, siatka na SAMYM DOLE tuż nad przyciskiem "Zapisz" — ten sam
  "bliżej kciuka" priorytet co FAB wklejania paragonu w `AddExpenseModal`
  (patrz §FINANSE). `MoodEnergyGrid.tsx` sam w sobie bez zmian, przeniesiony
  tylko w kolejności renderu w `MoodModal.tsx`.
- **Świadomie NIE w tej rundzie**: przypomnienia rano/wieczorem (sapp ma
  `scheduleDailyMoodReminder`/`scheduleMorningMoodReminder` — port wymaga najpierw
  prostej (nie full-screen-alert) warstwy lokalnych notyfikacji, której sapp2 jeszcze
  nie ma w tej formie), haptyka (czeka na `utils/haptics.ts`, Finanse Faza 2.6),
  integracja z pet/quest/coins (sapp ma to end-to-end dla swojego zwierzaka — analog
  dla przyszłej roślinki Pupila, patrz notatka niżej), sortowanie/eksport CSV,
  wykresy/statystyki/achievementy nastroju (sapp's `app/(tabs)/mood.tsx` ma tego sporo —
  dashboard-owa część, osobna decyzja czy/kiedy wchodzi do sapp2).
- **Hak na przyszłość (roślinka/Pupil)**: user explicite poprosił o "dodatkowe punkty
  dla roślinki" za opisanie dnia — roślinka jeszcze NIE istnieje (patrz §PUPIL/
  ROŚLINKA), więc żadnych punktów/currency nie dodano teraz. Gdy roślinka powstanie,
  najbliższy wzorzec do portowania to sapp's `utils/quests.ts`'s `d_mood`/`w_mood`/
  `mo_mood` (coins+XP za check-in dziennie/tygodniowo/miesięcznie, anti-double-claim
  przez `dayClaims` keyowane `${questId}:${date}`) + `petStore.claimDaily/claimWeekly/
  claimMonthly` — NIE zaczynać od zera.

## ZADANIA [GE]

**Przebudowany na nowy system komponentów (Faza 3.5, 2026-11-01)** — układ z
`design/app-design.html`'s `#tasks` (4 kolumny, `grid-template-rows: auto auto
1fr`): WeekStrip → agenda wybranego dnia (glance, max 3) → lista zadań (JEDEN
aktywny `Segmented` segment naraz, + przycisk "+" INLINE przy segmencie — nie
floating FAB jak wcześniej, spec pokazuje przycisk w tej samej karcie co lista).
Ekran PRZESTAŁ być `ScrollView`-owy (był kolejnym, po Daily, głównym ekranem ze
scrollem).

**`WeekMonthCalendar.tsx`/`TaskRow.tsx`/`DayDetailModal.tsx` BEZ ZMIAN** — już
matchowały spec koncepcyjnie (7-kolumnowy tydzień z chipami wydarzeń per dzień =
dokładnie `WeekStrip`). Widok miesiąca (popup) to realna, poza-spec funkcja
zachowana — ten sam traktowanie co "Produkty" w Finansach. `AddTaskCard.tsx` —
kontrakt bez zmian, ale teraz OPAKOWANY w `Modal` (wzorzec balance-edit z
finances.tsx) zamiast inline-renderować się w scrollu, który już nie istnieje —
otwiera go teraz przycisk "+" przy `Segmented`, nie floating FAB.

**UI zbudowane (2026-10-30, Faza 1b)** — `app/(tabs)/tasks.tsx` + 3 komponenty w
`src/components/tasks/`:
- `WeekMonthCalendar.tsx` — kalendarz domyślnie **tygodniowy** (zawsze bieżący
  Pon-Nd, inline w karcie, chipy wydarzeń per dzień) → tap na nagłówek karty otwiera
  **`MonthViewModal.tsx`** (NOWY, 2026-11-01, user: "kalendarz w trybie rozłożonym
  niech też ma takie kafelki jak tygodniowy widok, może być nawet na cały ekran") —
  pełnoekranowy popup (wzorzec WydatkiModal/AddExpenseModal) z siatką 6×7, TYCH SAMYCH
  kolorowych chipów co tydzień (max 2/komórkę + "+N"), nawigacja miesiącami + "Dziś".
  Dawny inline widok miesiąca (ciasna siatka, sama kropka) USUNIĘTY — miesiąc nigdy
  nie renderuje się ściśnięty, zawsze w popupie z miejscem na treść. Kropka pod dniem
  w widoku tygodnia zastąpiona chipami (`eventCoversDay`, obsługuje wielodniowe).
  Czyta `events`+`gcalEvents` z `calendarStore`. Zaznaczenie dnia (`selectedDate`)
  jest na razie czysto wizualne/nawigacyjne, NIE filtruje listy zadań niżej (dwa
  osobne widoki tego samego ekranu, nie master-detail).
- `TaskRow.tsx` — checkbox (ukończ, znika z listy), tytuł, tagi (neutralne szare
  chipy), kosz (usuń od razu, bez potwierdzenia).
- `AddTaskCard.tsx` — formularz dodawania: tytuł, jeden tag (tekst), termin przez
  4 szybkie wybory (Dziś/Jutro/Za tydzień/Bez terminu — brak date-pickera jako
  zależności).
- **Lista zadań** — kategoryzacja TERAZ/TERMINOWE/BEZTERMINOWE napędzana jednym
  polem `deadline` (logika sekcji wzięta z `sapp`, zadanie #42 tam, ale UI/UX
  zupełnie nowy, jak ustalone 2026-10-26). `deadline <= dziś` → Teraz, w przyszłości
  → Terminowe, brak → Bezterminowe.
- **Offline-first, ŚWIADOMIE bez auto-sync do Firestore/Google Calendar** przy
  CRUD z tego ekranu — leci tylko przez `useCalendarStore` (AsyncStorage). Pełny
  dwukierunkowy sync to osobny krok (patrz NEXT_STEPS.md), już istnieje jako
  ręczny test w Ustawieniach → Diagnostyka → "Sync kalendarza", ale nie spięty z
  normalnym UI.
- Zewnętrzna referencja zachowania kalendarza: TickTick (pasek kalendarza u góry +
  lista pod spodem) — zachowana.

**Widget na pulpicie Androida — JESZCZE NIE ZROBIONY** (user, 2026-10-26: "jak
będziemy robić zadania to musimy zrobić to tak jak tam [w `sapp`]"; ponowiona
prośba 2026-10-30 przy okazji feedbacku o kalendarzu — świadomie odłożone w tej
rundzie, osobny ciężki kawałek natywnej roboty). `sapp` ma to zrobione jako
**własny, natywny Kotlin wpięty przez config-plugin** (`plugins/
withTasksWidget.js`) — ŚWIADOMIE bez zewnętrznej biblioteki (np.
`react-native-android-widget`), bo `sapp` już raz złapał build-breaking problem z
zależnością zewnętrznego pakietu widgetów (namespace/AGP8 na SDK 54). Mechanizm:
`AppWidgetProvider` + `RemoteViews`, JS (`widgetSync.ts`) pisze JSON snapshot do
`filesDir`, natywny most (`TasksWidgetModule.requestUpdate()`) odświeża widget, 6
stałych slotów (RemoteViews nie wspiera scrolla bez `RemoteViewsService`), tap →
deep link schematem appki. Ten sam wzorzec do powtórzenia w `sapp2`, nie szukać
biblioteki od zera.

**Warstwa danych** (2026-10-28, Faza 1a): `src/types/calendar.ts`,
`src/services/calendarService.ts` (Firestore), `src/services/
googleCalendarService.ts` + `src/utils/googleCalendarMap.ts` (Google Calendar REST),
`src/store/calendarStore.ts` (Zustand, AsyncStorage-persisted) — to na niej stoi UI
wyżej.

## FINANSE [GE]

**Przebudowany na nowy system komponentów (Faza 3.4, 2026-11-01)** — główny ekran
(nie popupy, patrz niżej) na układzie z `design/app-design.html`'s `#fin` (4
kolumny, `grid-template-rows: auto auto auto auto 1fr`): Saldo (+realne miesięczne
wpływy/wydatki pod liczbą) → Podział (`StackBar`, Stałe/Jedzenie/Zmienne) →
Jedzenie · kategorie (`StackBar`, top 3 + "+N" w legendzie, link do "Produkty" w
nagłówku — ta realna funkcja nie jest w spec, dostała mały link żeby nie zginąć)
→ Praca + Najbliższa opłata (stub `Tile`, s2+s2 — store'a "bills"/godzin z
kalendarza wciąż nie ma) → Ostatnie transakcje (flex, `FitList`+`Row`+`PricePill`,
2-liniowe wiersze jak w spec). Dane BEZ ZMIAN (ten sam `useWydatkiData`/
`accountBalance`/`useExpensesStore` co wcześniej) — czysto wizualny przebudowanie
głównego ekranu.

**POPUPY (AddExpenseModal/ProductsModal/TransactionsModal/WydatkiModal,
balance-edit) ŚWIADOMIE BEZ ZMIAN** — wciąż `Modal`, NIE `AppBottomSheet`.
Bottom-sheet-yfikacja istniejących, złożonych popupów (5 różnych modali, każdy z
własną logiką) to osobna, jeszcze nieumówiona faza — zbyt duże ryzyko robić to w
tej samej rundzie co przebudowa głównego ekranu. `ComingSoonRow`/`LiveSectionRow`
(stary wzorzec listy "Obszary") USUNIĘTE Z REPO CAŁKOWICIE — po przebudowie
Finansów nic ich już nie importowało (Daily zrzucił je w Fazie 3.3).

**Faza 2 — plan pełny (2026-10-31)**, rozpisany po tym jak user poprosił: "przejrzyj
sobie całego SAPa... zaprojektuj to wszystko... napisz jak masz zamiar to zrobić".
Źródło: dokładny przegląd `/home/user/sapp`'s `src/utils/{fixedVariable,food,
receiptParser,productMemory,merchantMemory,recurringBills,bankNotification}.ts`,
`src/store/{bankQueueStore,bankRulesStore,expensesStore}.ts`, `src/services/
{bankIngest,bankCommit,bankAutoProcess}.ts`, `plugins/withBankNotificationListener.js`,
`app/expenses/{scan,manual}.tsx`, `app/products.tsx`, `app/(tabs)/finances.tsx`. Pełne
ustalenia z 2026-10-26 (poniżej) WCIĄŻ obowiązują — ten plan je rozwija, nie zastępuje.

### Struktura ekranu (user, 2026-10-31)
- **Kafel salda** (góra) — duża liczba, tyle ile na koncie. Logika 1:1 z sapp's
  `accountBalance.ts`: `balanceOffset + wpływy_całość − wydatki_całość` (karta, NIE
  gotówka — sapp świadomie ignoruje cash, user tam dbał tylko o saldo karty).
- **Kafel "Ostatnie transakcje"** — **TYLKO 4 pozycje**, tap → pełny, przeszukiwalny/
  filtrowalny spis w PEŁNOEKRANOWYM POPUPIE. **UWAGA**: sapp NIE MA tego dokładnie —
  tam lista rozwija się W MIEJSCU (przycisk "Pokaż starsze", 31-dniowe okno), nie
  osobny ekran. To nowy wzorzec dla sapp2 — ale mamy już gotowy, sprawdzony kawałek:
  dokładnie ten sam `WydatkiModal`-owy wzorzec (pełnoekranowy `Modal`,
  `presentationStyle="fullScreen"`) co dla kafla Jedzenie (patrz niżej) — **Dashboard
  (i teraz Finanse) NIGDY nie dostają scrolla, nadmiarowa treść zawsze idzie do
  popupu z WŁASNYM scrollem** (ta sama zasada co w §DASHBOARD).
- **Stałe / Zmienne / Jedzenie — podział na 3** (user, 2026-10-31). **Nie trzeba
  projektować tej taksonomii od zera — sapp JĄ JUŻ MA**, jako wyliczaną (nie
  przechowywaną) wartość: `src/utils/fixedVariable.ts` (`isFixedExpense`,
  `fvSplitOf`, `fixedVariableMonths`, `fixedBreakdown`, `bucketTransactions`) —
  dzieli KAŻDY wydatek (nawet pojedynczy paragon z mieszanymi produktami) na wkład do
  Stałe/Zmienne/Jedzenie, z ręcznym nadpisaniem (`fvOverride`) które zawsze wygrywa.
  Stałe = kategoria `housing`/`subscriptions` LUB dopasowanie do słownika
  rachunków (`recurringBills.ts`'s `BILL_TYPES`: czynsz/prąd/internet/gaz/woda/
  ogrzewanie/ubezpieczenie/telefon). Jedzenie = suma produktów oznaczonych jako
  jedzeniowe (`food.ts`). Zmienne = cała reszta. **PORTOWAĆ 1:1**, logika
  przetestowana (`__tests__/fixedVariable.test.ts` w sapp). Te 3 zakładki w sapp2 =
  3-way segmented tab w popupie "Wydatki" (`WydatkiModal`), z Jedzenie jako PIERWSZY
  realny konsument kafla `FoodBreakdownCard` zbudowanego w poprzedniej rundzie (jego
  mock dane tam czekały dokładnie na to).

### Parser paragonów (user, 2026-10-31: "jak w notatkach dodać plusik parser")
- Wejście: **FAB** (ten sam wzorzec co Zadania — pływający okrągły przycisk nad
  navbarem), rozwiązuje stare "Kolizja lewy dolny róg" z `NEXT_STEPS.md` dokładnie
  jak tam rekomendowano. **Jeden ujednolicony "dodaj"** (ustalenie z 2026-10-26, patrz
  niżej) — jeden FAB, tap pokazuje wybór trybu: Wklej paragon / Dodaj ręcznie / Dodaj
  przychód.
- **Parser tekstu** (`receiptParser.ts`, 1319 linii w sapp) — **PORTOWANE (2026-10-31)**,
  battle-tested na prawdziwych polskich paragonach (Biedronka/Lidl/Kaufland + generic
  fallback), obsługuje rabaty/kaucje/VAT/wagę/skróty nazw, 1:1 logika struktury
  paragonu. JEDNA realna zmiana vs sapp: `CATEGORY_KEYWORDS`/`categorize()` (sapp's
  non-food słownik transport/rozrywka/zdrowie/odzież/mieszkanie/subskrypcje) **USUNIĘTE
  CAŁKOWICIE** — sapp2 nie ma `ExpenseCategory` (patrz redesign kategorii niżej), więc
  pozycja dostaje `foodSubcat` TYLKO gdy rozpozna się jako jedzenie
  (`categorizeFoodSubcat()`, port `FOOD_TAG_MAP`+`getFoodTags` 1:1), inaczej zostaje
  bez kategorii — user ewentualnie doda tag na poziomie całego wydatku. UI do
  wklejania — nowe (`AddExpenseModal.tsx`), w stylu sapp2 (nie kopiujemy `scan.tsx`).
- **Dodawanie ręczne, pozycja po pozycji — ZROBIONE jako JEDEN wspólny ekran**
  (`AddExpenseModal.tsx` + `ReceiptItemRow.tsx`), zgodnie z ustaleniem "jeden
  ujednolicony dodaj": pole paste + "+ Dodaj pozycję" operują na TEJ SAMEJ liście
  stanu, różni się tylko punkt startowy. Brak pozycji wcale → pole "Kwota" odkrywa
  się jako szybki wydatek bez rozbijania na produkty (czynsz, paliwo).
- **Podpowiadanie produktu po nazwie — PODPIĘTE (2026-11-01)** (user: "wpisuję
  nazwę... sugeruje... klikam, cena się uzupełnia"). W `AddExpenseModal.tsx`
  (`runParse`): `canonicalProductName()` (aliasy + marki, np. "jezykicherry" →
  "Jeżyki") naprawia nazwę OD RAZU, bez pytania — to twarde reguły, nie niepewne
  sugestie; `applyFoodSubcatMemory()` jako FALLBACK dla pozycji, których słownik
  słów-kluczowych (`receiptParser.ts`) nie rozpoznał wcale (nigdy nie nadpisuje
  trafienia parsera). W `ReceiptItemRow.tsx`: `suggestSimilarName()` (pasmo
  `0.45–0.60`) sprawdzane na BLUR pola nazwy → "Czy to: {nazwa}?" tap-to-accept
  (auto-uzupełnia też `unitPrice` z `priceFor()` gdy pole było puste), `priceAnomaly()`
  → ostrzeżenie "Zwykle ~X zł" przy rażąco wysokiej cenie jednostkowej. **Zapis
  (`handleSave`) teraz REALNIE uczy pamięć** (`saveFoodSubcatMemory`/
  `savePriceMemory`) — to był brakujący krok w Fazie 2.2: pamięć istniała, ale nic
  jej nigdy nie zasilało, więc nigdy nic by się nie nauczyła. **Nadal NIE
  podpięte**: `weightFor`/`parseWeightFromName` → auto-uzupełnienie `weightKg` (brak
  pola wagi w `ReceiptItemRow`'s UI wcale — mniejszy priorytet, nie było w
  bezpośredniej prośbie usera).
- **Kalendarz przy edycji daty — DODANE (2026-11-01, user: "nie dodałeś kalendarza
  jak klikam w transakcjach")**. Pole "Data" w `AddExpenseModal.tsx` miało TYLKO
  chipy "Dziś"/"Wczoraj" + statyczną odznakę z wartością — żadnego sposobu wybrania
  DOWOLNEGO dnia, realny problem przy edycji starszej/zaimportowanej transakcji.
  `@react-native-community/datetimepicker` (nowa zależność, natywny Androidowy
  picker przez imperatywne `DateTimePickerAndroid.open()` — tak działa ten pakiet na
  Androidzie, inaczej niż inline-komponent na iOS) — zero własnego kalendarza do
  budowania/utrzymywania. Odznaka daty jest teraz tappable (ikona + wartość),
  otwiera systemowy picker.
- **Nadpisanie ceny/ilości/rabatu** (user: "kupiłem taniej... dodaj zniżkę, dodaj
  ilość") — pola już są w `ReceiptItem` (portowany typ): `price`/`quantity`/
  `unitPrice`/`discount`. UI: edytowalne inline na liście review, nie osobny ekran.
- **Podgląd sumy w trakcie** (user: "ile już w sumach wychodzi") — trywialne, liczone
  na żywo z aktualnej listy pozycji w review-screenie, zero logiki do portowania.
- **Kategorie jedzeniowe z sapp** (user: "z SAFa wyciągnąć kategorie... żeby
  przypisywało artykuły") = `food.ts`'s `FOOD_SUBCATS` — 19-tagowa taksonomia
  (mięso/nabiał/pieczywo/warzywa/owoce/słodycze/napoje/mrożonki/itd., każdy z
  kolorem) + `getFoodTags()`/`isFoodItem()`/`foodSubcat()`. **PORTOWAĆ 1:1** — to
  DOKŁADNIE te same kolory/kategorie co już czekają w `MOCK_FOOD_CATEGORIES`
  (`app/(tabs)/index.tsx` → `WydatkiModal`), więc po porcie ten kafel przechodzi z
  mocka na realne dane bez zmiany struktury.

### Edycja produktów — ZROBIONE (2026-11-01) (user: "jak złapie źle... wejść w
produkty i edytować, ale dużo ładniej zrobione niż w SAPie")
- **Brak osobnego store'u "Produkty"** — sapp2 nie przechowuje listy produktów,
  katalog jest WIDOKIEM agregowanym z historii `Expense.receiptItems`
  (`src/utils/productCatalog.ts`'s `buildProductCatalog(expenses, aliases)`):
  grupowanie przez `productGroupKey`/`productGroupLabel` (1:1 z sapp — "Serek
  wiejski lekki"/"Serek wiejski Pilos" → "Serek"), aliasy zastosowane PRZED
  grupowaniem (`canonicalProductName`) żeby scalenie duplikatu odbiło się na
  widoku NATYCHMIAST, bez przepisywania historycznych wydatków. Per wpis: ile razy
  kupione, ostatnia/suma cen, dominująca `foodSubcat`.
- **`ProductsModal.tsx`** (nowy, pełnoekranowy, wzorzec WydatkiModal) — karty-wiersze
  (jak `TaskRow`), NIE ciasny centered-modal sapp's `app/products.tsx`. Szukajka,
  tap na kartę rozwija edycję inline (nazwa → zapisuje alias przez
  `saveNameAliases`, kategoria jedzenia → chipy z `food.ts`, zapisuje przez
  `saveFoodSubcatMemory` dla WSZYSTKICH scalonych nazw grupy naraz).
- **Wykrywanie duplikatów** — `findDuplicateCandidates()` (pasmo `0.45–0.60`,
  `productNameSimilarity` między ETYKIETAMI już-pogrupowanych wpisów — łapie
  literówkę/OCR-szum w PIERWSZYM tokenie, który inaczej dałby różny `groupKey` i
  nigdy by się same nie zgrupowały). Baner "Możliwe duplikaty (N)" nad listą,
  "Połącz" (zapisuje alias, scala przy następnym przeliczeniu katalogu) / "To
  różne" (odrzuca na tę sesję, bez trwałego zapamiętywania odrzutu — lista i tak
  skraca się realnymi scaleniami).
- Wejście: `app/(tabs)/finances.tsx`'s "Obszary" → nowy, klikalny wiersz "Produkty"
  (`LiveSectionRow`, status = liczba wpisów katalogu).
- To PRZESĄDZA starą notatkę "POJAZDY / PRODUKTY — odłożone na koniec" — PRODUKTY
  weszły (explicit ask usera), POJAZDY zostają odłożone (nieporuszone w tej
  prośbie).

### Powiadomienia z banku + szablony (user: "w SAP mamy wyłapywanie powiadomień z
banku... plus szablony wyłapywań")
- **Natywna warstwa** — ten sam, sprawdzony wzorzec co `withTasksWidget.js`/
  `withFullScreenAlert.js`: `plugins/withBankNotificationListener.js` (w sapp)
  wstrzykuje przez `withDangerousMod` minimalny Kotlin
  `NotificationListenerService` + rejestruje `<service>` z
  `BIND_NOTIFICATION_LISTENER_SERVICE` przez `withAndroidManifest`. Łapie
  `onNotificationPosted` + `onNotificationRemoved` (dla powiadomień skasowanych
  zanim serwis się obudził) + `onListenerConnected` (re-skan całej tacki po
  zabiciu przez oszczędzanie baterii OEM). **PORTOWAĆ wzorzec 1:1**, to już
  TRZECI natywny moduł tego typu w tym projekcie (po LockScreenModule i
  — docelowo — TasksWidgetModule), sprawdzony, bez ryzyka niespodzianek.
  **PAKIETY BANKOWE DO POTWIERDZENIA Z USEREM** — sapp miał zaszyte na sztywno
  Pekao PeoPay/Pekao24 + PKO IKO, sapp2 potrzebuje realnych nazw pakietów banku(ów)
  usera (pytanie niżej).
- **Parser treści powiadomienia** (`bankNotification.ts`) — regex na
  kwotę/walutę/kierunek/datę/nadawcę/metodę płatności, wykrywanie przelewu do
  siebie i wypłaty. **PORTOWAĆ 1:1**, dostrojony pod format Pekao — może wymagać
  korekty pod inny bank.
- **Szablony** (user: "łapię to, to np. opłata za mieszkanie... automatycznie") =
  `bankRulesStore.ts` — user z góry deklaruje `{wzorzec, nazwa, rodzaj, kategoria,
  tagi}` (np. "czynsz.pl"→Stałe/Mieszkanie), dopasowywane substring-iem do
  nazwy/treści powiadomienia. **PORTOWAĆ 1:1** — to dokładnie "szablony wyłapywań"
  z prośby usera.
- **Kolejka + zatwierdzanie** — `bankQueueStore.ts` (oczekujące) +
  `bankCommit.ts` (jeden punkt zapisu: deduplikacja po kwocie+dniu+sklepie, blokada
  współbieżności, dopasowanie do już zeskanowanego paragonu zamiast duplikatu,
  auto-przesuwanie terminu subskrypcji przy trafieniu). Ekran przeglądu — nowy UI
  (styl sapp2), logika `commitBankTx()` **PORTOWANA 1:1**.
- **Zaufanie/auto-akceptacja** (`merchantMemory.ts`) — licznik czystych akceptacji
  per-sprzedawca, próg `5` włącza auto-zatwierdzanie (reset przy korekcie), kwoty
  `>1500 zł` zawsze wymuszają ręczny przegląd. **PORTOWAĆ 1:1** — to dokładnie
  mechanizm który sprawia że po kilku powtórzeniach appka "się uczy" i przestaje
  pytać o te same rachunki, idealnie pasuje do opisu usera.

### Runda poprawek (2026-11-01) — kto płacił, saldo konta, ergonomia
- **`payer?: 'me' | 'partner'`** na `Expense` (domyślnie "ja") — NOWE, nie istniało w
  sapp. `src/utils/balance.ts`'s `affectsBalance(e)` = `(payer??'me')==='me' &&
  paymentMethod!=='cash'` — saldo ma odzwierciedlać WYŁĄCZNIE stan konta bankowego
  usera (user: "chcę saldo żeby odzwierciedlało ile mam na koncie w banku"), więc
  gotówka i płatności partnerki (Olesia) nigdy go nie ruszają, niezależnie od drugiej
  zmiennej. `accountBalance(expenses, offset)` = offset + Σ(wpływy−wydatki gdzie
  `affectsBalance`). Offset w AsyncStorage (`getBalanceOffset`/`setBalanceOffset`) —
  uproszczony port sapp's `accountBalance.ts` (sapp śledzi KARTĘ i GOTÓWKĘ jako dwa
  osobne pule z osobnymi offsetami; sapp2 świadomie NIE portuje pulu gotówki, user nie
  prosił o jej podgląd, tylko o wyłączenie z salda).
- `app/(tabs)/finances.tsx`'s kafel Saldo czyta `accountBalance` na żywo, tap otwiera
  mały popup kalibracji ("Ustaw aktualne saldo" → przelicza offset od wpisanej,
  realnej kwoty).
- `AddExpenseModal.tsx`'s "Płatność" zastąpione zwiniętą domyślnie sekcją
  "Zapłacono: Ja · Karta" (user: "ta opcja mniej widoczna po rozwinięciu... żeby to
  miejsca nie zajmowało") — tap rozwija wybór Ja/Olesia + metoda płatności razem.
- **Klawiatura nie zasłania pola** (user, ogólna uwaga na całą appkę) —
  `src/hooks/useKeyboardHeight.ts` (port z sapp) zamiast `KeyboardAvoidingView`,
  niewiarygodnego wewnątrz RN's `Modal` na Androidzie (osobna natywna hierarchia,
  poza zasięgiem `windowSoftInputMode`). Podpięte w `AddExpenseModal.tsx` — **jedyny
  ekran z inputami wewnątrz pełnoekranowego `Modal` na razie**; każdy następny
  formularz w `Modal`-u powinien dostać ten sam fix. `MoodModal.tsx` (2026-11-02,
  przeniesiony na `AppBottomSheet`) tego hooka już NIE potrzebuje — `keyboardBehavior`
  gorhom's `BottomSheetModal` rozwiązuje to wewnętrznie (patrz §DAILY/AppBottomSheet).
- **Parser bliżej prawego kciuka** (user) — pływający przycisk (`ClipboardPaste`,
  wzorzec FAB) w prawym dolnym rogu `AddExpenseModal`, czyta schowek i parsuje jednym
  tapnięciem, bez przewijania do pola tekstowego na górze.

### Model danych
- `src/types/finances.ts` (nowy) — port `Expense`/`ReceiptItem` z sapp
  (`src/types/index.ts`), BEZ pól które sapp2 jeszcze nie potrzebuje
  (`vehicleId`/`reimbursedAmount`/`reimbursedFromId` — Pojazdy i zwroty wciąż poza
  zakresem, dodamy pola gdy/jeśli te funkcje realnie powstaną, nie wcześniej).
- `src/store/expensesStore.ts` (nowy, Zustand) — ten sam wzorzec co
  `calendarStore.ts`: offline-first AsyncStorage, Firestore sync jako osobna,
  ręczna warstwa (serwis), NIE auto-sync przy każdym CRUD (ta sama, już ustalona
  zasada co w Zadaniach — patrz §ZADANIA).

### Kolejność budowy
1. **Fundament danych — ZROBIONE (2026-10-31)**. `src/types/finances.ts` +
   `fixedVariable.ts`/`food.ts`/`recurringBills.ts`/`productMemory.ts`/
   `merchantMemory.ts` portowane jako czysta logika (zero UI), `expensesStore.ts` +
   `expensesService.ts` (wzorzec `calendarStore`/`calendarService`). Jest
   skonfigurowany, 68 portowanych testów zielonych. Szczegóły: NEXT_STEPS.md "Faza
   2.1 UKOŃCZONA".
2. **Parser + ręczne dodawanie — ZROBIONE (2026-10-31)**. `receiptParser.ts`
   portowany (adaptacja: `foodSubcat` zamiast `categorize()`/`ExpenseCategory`, patrz
   wyżej), `__tests__/receiptParser.test.ts` portowane i zielone (105/105 testów w
   repo). `AddExpenseModal.tsx` (pełnoekranowy modal, Wydatek/Przychód, paste+ręczne
   na WSPÓLNEJ liście pozycji, kwota-bez-pozycji dla szybkich wydatków, daty/tagi/
   metoda płatności/`fvOverride` chipy, ostrzeżenie przy niezgodności sumy pozycji z
   kwotą z paragonu) + `ReceiptItemRow.tsx` (checkbox włącz/wyklucz, edytowalne
   qty×cena=suma, `+ zniżka`, picker `foodSubcat`). FAB na `app/(tabs)/finances.tsx`
   (ten sam wzorzec co Zadania), "Ostatnie transakcje" czyta TERAZ z `expensesStore`
   (tymczasowo, do Fazy 4). **Celowo NIE w tej rundzie**: podpięcie `productMemory`
   (fuzzy-sugestie/pamięć wagi-ceny — patrz gap wyżej), saldo/popup Stałe-Zmienne-
   Jedzenie (Faza 4), haptyka (Faza 6).
3. **Edycja produktów — ZROBIONE (2026-11-01)**. `ProductsModal.tsx` (katalog
   agregowany z historii, karty-wiersze, edycja nazwy/kategorii, wykrywanie
   duplikatów) + `productMemory` PODPIĘTE do `AddExpenseModal`/`ReceiptItemRow`
   (gap z kroku 2 zamknięty: aliasy/marki auto-apply, fuzzy-sugestia nazwy na blur,
   ostrzeżenie o anomalii ceny, zapis UCZY pamięć przy każdym "Zapisz"). Szczegóły:
   NEXT_STEPS.md "Faza 2.3 UKOŃCZONA". Nadal nie podpięte: pamięć wagi (brak pola
   wagi w UI wcale).
4. **Przebudowa ekranu Finanse — ZROBIONE (2026-11-01)**. Ekran PRZESTAŁ być
   `ScrollView`-owym szkieletem — teraz, jak Dashboard, NIGDY się nie scrolluje.
   "Ostatnie transakcje" dalej TYLKO 4 pozycje, tap na nagłówek sekcji →
   `TransactionsModal.tsx` (nowy, pełnoekranowy popup, przeszukiwalna pełna lista,
   tap na wiersz → edycja przez ISTNIEJĄCY `AddExpenseModal`, bez zamykania listy
   pod spodem — ten sam wzorzec co `MonthViewModal`+`DayDetailModal`). Nowy wiersz
   "Stałe / Zmienne / Jedzenie" w "Obszary" otwiera `WydatkiModal.tsx`, który dostał
   3-way segmented tab (Stałe/Zmienne/Jedzenie) ZAMIAST pokazywania tylko Jedzenia —
   WSPÓLNY punkt wejścia z Dashboardu (kafel "DZIENNIE #JEDZENIE",
   `initialTab="food"`) i Finansów (`initialTab="fixed"`), dane dla wszystkich
   trzech kubłów liczy jedno miejsce: `utils/wydatkiData.ts`/`hooks/
   useWydatkiData.ts` (`fixedBreakdown`/`fixedDeviations`/`topVariableContributors`
   z `fixedVariable.ts`, już przetestowane od Fazy 2.1 — tylko teraz pierwszy raz
   realnie podpięte pod UI). Nowe karty `FixedBreakdownCard.tsx`/
   `VariableBreakdownCard.tsx` — bliźniaki `FoodBreakdownCard.tsx`, bez wykresu
   tygodniowego (rachunki/zmienne nie mają sensownego podziału na tygodnie jak
   jedzenie). Kafel salda już realny od rundy poprawek 2026-11-01.
5. **Powiadomienia z banku — ZROBIONE (2026-11-01, user: "dawaj dalej")**, PODSTAWOWA
   pętla (nasłuch → parser → kolejka → przegląd → zaksięgowanie), bez szablonów —
   patrz `### Powiadomienia z banku (Faza 2.5)` niżej po szczegóły i co świadomie
   odłożone.
6. **Wibracje — ZROBIONE (2026-11-01, "dawaj dalej")**. `utils/haptics.ts` (port z
   sapp, uproszczony: zamiast sapp's dużego `appSettings.ts` — lokalny,
   AsyncStorage-cache'owany flag jak `ownName.ts`), JEDEN globalny przełącznik w
   Ustawieniach → Ogólne (zgodnie z zasadą niżej w §Ogólne). Wpięte w "toggle taga"
   (`AddExpenseModal`'s tagi, `ReceiptItemRow`'s checkbox+`foodSubcat` chipy,
   `bank-review.tsx`'s tagi), "zatwierdź" (`AddExpenseModal.handleSave`,
   `bank-review.tsx`'s accept, kalibracja salda w `finances.tsx`) i "połącz
   duplikat" (`ProductsModal.mergeInto`).
7. **Historia, cofnięcie, szablony — ZROBIONE (2026-11-01, user: "mam nadzieję że
   zrobiłeś w zatwierdzeniu historię żebym mógł cofnąć albo stworzyć szablon z
   wyłapanych")** — zamyka ostatni gap z Fazy 2.5. Patrz
   `### Historia, cofnięcie, szablony (Faza 2.7)` niżej.

### Powiadomienia z banku (Faza 2.5, 2026-11-01)

Port z sapp (`bankNotification.ts`/`bankQueueStore.ts`/`bankIngest.ts`/
`bankCommit.ts`/`bankAutoProcess.ts`/`bankNotificationDrain.ts`/
`withBankNotificationListener.js`), ADAPTOWANY (nie 1:1 — sapp2 brakuje kilku
podsystemów które sapp's `bankCommit.ts` zakładał, patrz niżej). Dostrojony pod Bank
Pekao S.A. (PeoPay/Pekao24) + PKO BP (IKO) — te same banki co w sapp, ten sam user.

**Mechanizm** (identyczny jak sapp): natywny `NotificationListenerService`
(`Sapp2NotificationListener.kt`, wstrzyknięty przez
`plugins/withBankNotificationListener.js` — ten sam wzorzec config-pluginu co
`withFullScreenAlert.js`) filtruje powiadomienia apek bankowych i dopisuje
`{title,text,pkg,time}` do pliku JSON w `filesDir` (= expo-file-system's
`documentDirectory`). `services/bankNotificationDrain.ts` czyta/czyści ten plik przy
każdym wejściu appki na pierwszy plan (`app/_layout.tsx`), przepuszcza przez
`bankIngest.ts` (parsuje przez `utils/bankNotification.ts`, dopasowuje pamięć
sprzedawcy) → `store/bankQueueStore.ts` (kolejka do przeglądu) →
`services/bankAutoProcess.ts` (auto-zatwierdza zaufanych sprzedawców) →
`services/bankCommit.ts` (zamienia w prawdziwy `Expense`, dedup, uczy
`merchantMemory`). Przegląd ręczny: `app/bank-review.tsx` (nowy route, nie modal —
jak `settings.tsx`), wejście z Ustawień → Finanse → "Płatności do zatwierdzenia".
User musi RAZ ręcznie przyznać "Dostęp do powiadomień" (przycisk w Ustawieniach
otwiera systemowy ekran, `Linking.sendIntent`) — appka nie może tego zrobić sama.

**Adaptacje vs sapp** (żadna NIE jest przeoczeniem, wszystkie świadome):
- **Kategoria → tagi**: sapp pamiętał `category: ExpenseCategory` per sprzedawca/
  transakcję — sapp2 nie ma `ExpenseCategory` w ogóle (patrz redesign kategorii na
  początku tego pliku), więc wszędzie `tags: string[]`. Ten sam wzorzec już
  zastosowany w `merchantMemory.ts` (portowane w Fazie 2.1, czekało dokładnie na tę
  rundę).
- **Offline-first, zapis SYNCHRONICZNY**: sapp's `bankCommit.ts` pisał do Firestore
  NAJPIERW (`await expensesService.add()`), dopiero potem lokalnie — sapp2 jest
  celowo offline-first (ta sama zasada co `AddExpenseModal.tsx`), więc
  `useExpensesStore.getState().addExpense()` bezpośrednio, zero awaited network w
  krytycznej ścieżce. To też usunęło całą klasę UX-complexity z sapp's
  `bank-review.tsx` (multi-tap guard + spinner na 10s Firestore timeout) — commit
  jest praktycznie natychmiastowy.
- **Szablony powiadomień (`bankRulesStore`/osobny mechanizm dopasowywania) —
  ŚWIADOMIE NIE PORTOWANE, ale "szablon" jako FUNKCJA jest zrobiony inaczej, patrz
  `### Historia, cofnięcie, szablony (Faza 2.7)` niżej**. Nierozpoznany sprzedawca
  dostaje puste `tags: []`, user otaguje raz ręcznie w przeglądzie, od tego momentu
  `merchantMemory` się uczy — kompletna, nie-dziurawa pętla nawet bez tego kroku.
- **Subskrypcje / Praca / przypomnienie o wypłacie — POMINIĘTE CAŁKOWICIE**. sapp's
  `bankCommit.ts` auto-opłacał subskrypcje (`subscriptionsStore`/`subscriptionAuto`),
  oznaczał "payday handled" i dopisywał prefiks z pracy (`workStore`) — żaden z tych
  trzech podsystemów nie istnieje w sapp2 (wciąż `ComingSoonRow` w Finanse →
  Obszary). Gdy/jeśli powstaną, ich bank-integracja wraca jako osobna, świadoma
  runda — nie teraz.
- **Waluta obca — ZAWSZE do ręcznego przeglądu**. sapp miał `plnOverride`/
  `originalAmount`/`originalCurrency` na `Expense` (user ręcznie wpisywał przeliczoną
  kwotę PLN w `bank-review.tsx`) — sapp2's `Expense` nie ma tych pól. Płatność w
  obcej walucie dostaje `flagReason`, nigdy nie auto-księguje się; po zatwierdzeniu
  kwota wchodzi TAK JAK PODANA (bez przeliczenia) — user widzi walutę w karcie
  przeglądu i może ręcznie poprawić kwotę przed zatwierdzeniem.
- **Przelew własny (Revolut/inne konto) — ZAWSZE do ręcznego przeglądu**.
  `fixedVariable.ts`'s `FvBucket` ma tylko `fixed`/`variable`/`food`, bez
  sapp's pseudo-kategorii `'transfer'` wykluczonej ze statystyk wydatków. Zamiast
  rozszerzać `FvBucket` dla jednego, wąskiego przypadku, przelew własny dostaje
  `flagReason` i tag `'przelew własny'` — user może ręcznie ustawić `fvOverride` po
  dodaniu, jeśli chce go wykluczyć z sum Stałe/Zmienne/Jedzenie.
- **Toasty — brak** (sapp2 nie ma jeszcze systemu toastów, żaden inny ekran go nie
  używa) — znikająca kolejka + log diagnostyczny w Ustawieniach (reużyty istniejący
  `append()`) to dotychczasowy sposób dawania feedbacku w tej appce.

**NEXT_STEPS.md** ma pełną listę "do przetestowania na urządzeniu" — to JEDYNA
funkcja w tej rundzie sesji wymagająca prawdziwego urządzenia + prawdziwego
powiadomienia z banku do realnej weryfikacji (CI/`tsc`/`jest`/`expo export` sprawdzają
tylko że kod się kompiluje i plugin generuje poprawny natywny kod — nie że nasłuch
faktycznie łapie powiadomienia na danym telefonie/OEM).

### Historia, cofnięcie, szablony (Faza 2.7, 2026-11-01)

User po teście Fazy 2.5: *"mam nadzieję że zrobiłeś w zatwierdzeniu historię żebym
mógł cofnąć albo stworzyć szablon z wyłapanych"* — `bankQueueStore.history` już
istniał (log do wglądu od samego początku Fazy 2.5), ale NIGDZIE nie był
wyświetlany i nie niósł wystarczająco danych żeby cofnąć zatwierdzenie. Ten krok
zamyka obie dziury bez dodawania drugiego, równoległego mechanizmu dopasowywania.

- **`BankIngestHistoryEntry` rozszerzony**: `storeKey` (do "Stwórz szablon"/dopasowania
  z poziomu historii), `expenseId`/`matched` (dopisywane PO commicie w
  `bank-review.tsx`'s `accept`/`bankAutoProcess.ts`, NIE przy `enqueue` — w tym
  momencie wydatek jeszcze nie istnieje), `undone` (ustawiane przez `undoBankHistoryEntry`).
  Nowa akcja store'a: `updateHistoryEntry(id, patch)`.
- **"Cofnij"** — `services/bankCommit.ts`'s `undoBankHistoryEntry(entry)`, para do
  `commitBankTx`. `matched:false` (commit DODAŁ nowy wydatek) → usuwa go całkiem
  (`deleteExpense`). `matched:true` (commit tylko SCALIŁ z już istniejącym wydatkiem)
  → NIE usuwa tego wydatku (mógł być dodany ręcznie, niezależnie od banku) — tylko
  odpina `bankMatched`. Nie "oducza" `merchantMemory` (osobny, nieproszony problem:
  wymagałoby wiedzieć czy user zaakceptował inne płatności tego sprzedawcy w
  międzyczasie). Ekran: `app/bank-history.tsx`, przycisk "Cofnij" per wpis (tylko gdy
  `expenseId` ustawione i jeszcze nie `undone`).
- **"Stwórz szablon z tego"** — ŚWIADOMIE NIE jest drugim, równoległym mechanizmem
  dopasowywania (sapp's `bankRulesStore` zostaje nieportowany). To jednorazowy
  fast-track ISTNIEJĄCEGO `merchantMemory`: `saveMerchant(storeKey, {tags, name})` +
  `setMerchantAuto(storeKey, true)` od razu, zamiast czekać na `AUTO_THRESHOLD`
  czystych akceptacji. Przycisk w `bank-review.tsx` (na karcie, widoczny gdy sprzedawca
  jeszcze nie jest `auto`) ORAZ w `app/bank-history.tsx` (per wpis, działa też na
  pozycjach już zaksięgowanych wcześniej — "z wyłapanych"). Następna płatność z tego
  samego `storeKey` już łapie się w `bankIngest.ts`'s istniejącej ścieżce
  `matchedSource:'learned'`, zero nowego kodu dopasowywania.
- **`app/bank-history.tsx`** (nowy route) — lista `bankQueueStore.history` (najnowsze
  pierwsze), per wpis: sklep/kwota/data/tagi/flagi, "Cofnij" + "Stwórz szablon",
  "Wyczyść" w nagłówku (`clearHistory()`, bez dialogu potwierdzenia — appka
  konsekwentnie nie ma żadnych `Alert.alert`-confirmów, usuwanie jest zawsze
  bezpośrednie, patrz `AddExpenseModal`'s delete). Wejście: Ustawienia → Finanse →
  "Historia i szablony" (`tier:'sub'`, obok "Płatności do zatwierdzenia"), też
  ikona-link w nagłówku `bank-review.tsx`.
- **Drill-down w `FoodBreakdownCard`** (DASHBOARD/Wydatki popup, nie bank) — osobna,
  niezależna poprawka w tej samej rundzie (user: "jak klikam w jedzenie nie mam tam
  zrobione na popupie jak w sap na dashboardzie"), patrz §DASHBOARD.

**PRACA / SUBSKRYPCJE** [PE] — bez zmian względem wcześniejszego ustalenia (niżej),
wciąż osobne, mniejsze podekrany. **POJAZDY** [PE] — wciąż odłożone.

- **UI/UX kompletnie inny niż w `sapp`** (user, 2026-10-26, ta sama zasada co w Zadaniach)
  — dotyczy WYGLĄDU, nie logiki danych (ta jest portowana 1:1 jak opisano wyżej).
- **Jeden ujednolicony "dodaj"** (user, 2026-10-26) zamiast rozdzielonych w `sapp`
  ścieżek "dodaj wydatek zwykły" / "dodaj przez paragon" — user: w `sapp` denerwowało
  go że zwykły (ręczny) wydatek nie dawał pola "sklep" (to było tylko przy paragonie),
  i że nazwę złapaną z powiadomienia banku (np. "Zapłacono blikiem dla X firmy") nie
  dało się ręcznie przeredagować na coś schludniejszego. Nowy model: JEDNO miejsce,
  które obsługuje: (a) parser tekstu z paragonu (share-intent), (b) ręczne tworzenie
  "custom paragonu" z tymi samymi polami co parsowany (w tym sklep), (c) dodawanie
  przychodu — i wszędzie pełna edytowalność wyświetlanej nazwy, także tej złapanej
  automatycznie z powiadomienia. **Rozwiązane (2026-10-31): FAB**, dokładnie jak
  rekomendowano w "Kolizja lewy dolny róg" (`NEXT_STEPS.md`) — ten sam wzorzec już
  sprawdzony w Zadaniach.

## PUPIL — USUNIĘTY (Faza 3.1, 2026-11-01)

Zakładka CAŁKOWICIE usunięta (user: "usuwamy pupila zupełnie go nie będzie zakładka
odpada" — nav ze `design/app-design.html` ma tylko Dashboard/Daily/Finanse/Zadania +
Ustawienia, bez 5. ikony). `app/(tabs)/pupil.tsx` i `src/components/ui/
PlaceholderScreen.tsx` (jego jedyny konsument) usunięte z repo, `TabBar.tsx`/
`app/(tabs)/_layout.tsx`'s `ROUTES` zaktualizowane do 4 korzeni. Mechanika
"roślinka zamiast bossów" (była tu opisana, patrz NEXT_STEPS.md "Pomysł do
rozważenia" — teraz oznaczony jako nieaktualny) nigdy nie wyszła poza etap pomysłu,
więc nie ma nic do migracji/zachowania.

## Ogólne do appki (cross-cutting)

- **Ustawienia — przeprojektowany wygląd wierszy (2026-11-01)**, user zrzutem
  ekranu sekcji Finanse: "nie rozróżniam nazwy kategorii od podkategorii, oraz jak
  coś jest pozwoleniem żeby miało symbol... albo toggle jak w ustawieniach
  telefonów". `SettingsItem` (`app/settings.tsx`) ma teraz, obok `'action'`/`'value'`:
  - **`kind: 'switch'`** — `Toggle` (`src/components/design/Toggle.tsx`,
    2026-11-02; był tu natywny `Switch` z kolorowym `trackColor`, zamienione na
    monochromatyczny komponent 1:1 ze spec's `.tog`, patrz §"REDESIGN RDZENIA
    UI" wyżej) dla stanów które appka faktycznie zna i kontroluje:
    `haptics-enabled`, `bank-enabled`, `bank-auto-all`. Cały wiersz jest
    tappable (woła ten sam handler co `Toggle` bezpośrednio), nie tylko sam
    suwak.
  - **`permission: true`** (tylko na `'action'`) — odznaka "Zgoda" + ikona tarczy
    (`ShieldCheck`) przy akcjach prowadzących do EKRANU SYSTEMOWEGO (dostęp do
    powiadomień, optymalizacja baterii, dokładne alarmy) — appka nie ma jak
    programowo sprawdzić/zmienić stan takiego uprawnienia bez nowego natywnego
    modułu (do rozważenia później, nie teraz — to był świadomy wybór niższego
    ryzyka niż dorzucanie kolejnego natywnego modułu w tej samej rundzie), więc
    wizualne oznaczenie zamiast udawanego/mylącego stanu.
  - **`tier: 'sub'`** — wcięty, mniejszy wiersz pod rodzicem (np. 4 wiersze pod
    "Powiadomienia z banku", widoczne tylko gdy włączony) — odpowiada na "nie
    rozróżniam kategorii od podkategorii".
  - **`item.description` NARESZCIE się renderuje** jako podtytuł pod etykietą —
    wcześniej istniało WYŁĄCZNIE do wyszukiwania (dopasowanie tekstu w pasku
    szukania), nigdy nie było widoczne na ekranie, mimo że dla wielu wierszy
    niosło realny stan ("WŁĄCZONE"/"N czeka" itp.) — to był WIĘKSZY powód "nie
    widzę różnicy między wierszami" niż sam brak wcięcia. Zasada na przyszłość:
    `description` ZAWSZE jest widoczne, pisz je z myślą o tym, nie tylko pod kątem
    wyszukiwarki.
  Wzorzec do naśladowania przy nowych sekcjach: prawdziwy toggle → `kind:'switch'`,
  prowadzi do systemowego ekranu zgody → `permission: true`, zależy od innego
  wiersza wyżej → `tier: 'sub'` (i warunkowe dodanie do listy jak już robi Finanse).
- **Wibracje — ZROBIONE (2026-11-01)** — JEDEN globalny toggle w Ustawieniach →
  Ogólne (`utils/haptics.ts`), nie per-ekran (jeśli jakiś ekran okaże się zbyt
  "wibrujący", wyciszamy to w kodzie tego ekranu, nie dodajemy osobnego
  przełącznika w UI). Na razie wpięte tylko w Finanse (Faza 2.6, §FINANSE) —
  kolejne ekrany (Zadania/Daily/Dashboard) dostają haptykę gdy ktoś realnie tam
  doda nowe, warte potwierdzenia interakcje, nie z wyprzedzeniem.
- **Powiadomienia** — do zaprojektowania: zwykłe vs. "ciekawsze" typy (full-screen
  przypomnienie blokujące do odhaczenia, jak budzik) + integracja z trybem focus
  Pupila/roślinki. Patrz rozmowa 2026-10-26 w historii sesji po szczegóły wykonalności
  (Android full-screen intent — wymaga więcej niż goły `expo-notifications`,
  prawdopodobnie `notifee` albo custom native code).
  Sandbox testowy w `app/settings.tsx` sekcja "Alerty" (`app/alert-test.tsx` + `src/
  hooks/useNotifeeAlertLaunch.ts` + `plugins/withFullScreenAlert.js`/`src/services/
  lockScreen.ts`) — 4 warianty testowe, oba diagnostyczne przyciski niżej oznaczone
  `permission: true` (patrz "Ustawienia — przeprojektowany wygląd wierszy" niżej) —
  **2 przyciski diagnostyczne (2026-11-01)**:
  "Optymalizacja baterii" (`notifee.isBatteryOptimizationEnabled`/
  `openBatteryOptimizationSettings`/`openPowerManagerSettings` dla OEM-specific
  autostart) i "Dokładne alarmy" (`notifee.openAlarmPermissionSettings`) — dodane po
  tym jak test "za 5 min (OLED)" nie odpalił się w ogóle, mimo że identyczny
  mechanizm za 5s działał: na Androidzie 12+ `allowWhileIdle` NIE gwarantuje
  dokładnego alarmu jeśli appka ma włączoną optymalizację baterii — system cicho
  degraduje/opóźnia zamiast rzucić błędem, więc log pokazuje "sukces" mimo że nic
  finalnie nie przyjdzie. Obie zgody appka może tylko POPROSIĆ o (systemowy
  dialog/ekran), nie włączyć sama — stąd przyciski, nie automatyczny fix w kodzie.
  Kanał `expo-notifications` 'alerts-max' zbumpowany do `alerts-max-v2` (brak
  dźwięku zgłoszony przez usera — ten kanał, w odróżnieniu od notifee'owego, nigdy
  wcześniej nie był wersjonowany, mimo że kanały są niemutowalne po utworzeniu).
  **Nadal nierozwiązane**: brak dźwięku w wariantach notifee mimo dwukrotnego już
  bumpowania kanału (`-v3`) — najbardziej prawdopodobna przyczyna to coś PO stronie
  urządzenia (głośność powiadomień/dzwonka wyciszona, albo brak ręcznie przyznanego
  dostępu "Nie przeszkadzać" mimo `bypassDnd` w kodzie), nie kod — do zweryfikowania
  na urządzeniu przed kolejną próbą w kodzie.
  **Fix (2026-11-01, user: "czasami ekran otwiera się 2 razy")** —
  `useNotifeeAlertLaunch.ts`'s `goToAlert` zmienione z `router.push` na
  `router.replace`. Root cause: `sendNotifeeAlert` z `includeInstant=true` wysyła
  DWA powiadomienia na jeden tap (natychmiastowe + opóźnione), oba z tym samym
  `data:{route:'alert-test'}` — każde osobno mogło odpalić
  `onForegroundEvent`/`onBackgroundEvent` i osobno zepchnąć nowy wpis na stos
  nawigacji (`push`), więc user widział dwa nałożone na siebie ekrany alarmu.
  `replace` podmienia szczyt stosu zamiast go nakładać — powtórne wywołania zlewają
  się w jeden ekran.
- **Logowanie (wymagane od razu)** — 2026-10-28, user: "wymagaj logowania Google od
  razu". W przeciwieństwie do sapp (sesja anonimowa cały czas, Google Sign-in tam
  tylko dla Google Calendar API, nigdy nie dotyka Firebase Auth), sapp2 NIE wpuszcza
  nigdzie bez zalogowanego Firebase-usera:
  - `app/_layout.tsx` (`useAuthGate`) — bramka: `useSegments()[0] === 'login'` +
    `useAuthUser()` (`src/hooks/useAuthUser.ts`) decydują czy przekierować na
    `/login` czy na `/`. Krótki spinner na czas `initializing`.
  - `app/login.tsx` — jedyny ekran dostępny bez usera, przycisk woła
    `signInWithGoogle()` (`src/services/googleAuth.ts` — JEDYNE miejsce które realnie
    robi `signInWithCredential` do Firebase; test Diagnostyki w `app/settings.tsx`
    woła samo `GoogleSignin.signIn()`, bez linkowania, bo sprawdza tylko konfigurację
    Google Cloud/Firebase Console).
  - `src/utils/userData.ts` (`userCol`/`userDoc`/`requireUid`) — jedyna droga do
    Firestore per-user (`users/{uid}/...`), bez anonimowego fallbacku jak w sapp.
    Każdy przyszły serwis (kalendarz, finanse) idzie przez to, nie przez gołe
    `collection(db, ...)`.
  - "Konto" w Ustawieniach (e-mail + Wyloguj) — żeby logowanie nie było dead-endem.
