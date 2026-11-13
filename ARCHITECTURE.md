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
- **Fokus/klawiatura w popupie (2026-11-11)** — NIE używaj gołego `autoFocus` na
  `TextInput` w środku `AppBottomSheet` (na Androidzie klawiatura się nie
  pokazuje — `Modal` jeszcze nie ma fokusu). Zamiast tego `ref` na polu +
  `<AppBottomSheet initialFocusRef={ref}>` (fokus z `Modal`'s `onShow`). Wzorzec:
  `app/(tabs)/tasks.tsx` → `AddTaskCard`'s `titleRef`.
- **Kopia zapasowa (2026-11-11)** — `services/cloudBackup.ts` zrzuca CAŁY
  AsyncStorage (poza `firebase:…`/`cloud_backup_…`) do `users/{uid}/backup`
  w Firestore, automat co ≥6h (`hooks/useAutoBackup.ts`). **Nowy store z
  `persist` = dopisz go do listy `rehydrate()` w `restoreBackup`**, inaczej po
  przywróceniu pokaże stare dane aż do restartu appki. Dane same w sobie
  trafiają do kopii automatycznie (generyczne `getAllKeys`).
- **Nawigacja z otwartego sheeta (2026-11-11)** — przejście na inny ekran z
  wnętrza `AppBottomSheet` ZAWSZE przez jego `onClosed` (po animacji
  zamykania), nigdy w tym samym handlerze co zamknięcie — inaczej puste okno
  `Modal`a zostaje na wierzchu nowego ekranu (Android). Wzorce:
  `app/settings.tsx`'s `leave()`/`runPendingNav`, Dashboard's
  `goToTasksAfterClose`.
- **Pola liczbowe (2026-11-11)** — `components/design/NumberInput.tsx`
  (`value: number | undefined`, `onChangeValue`), NIGDY `value={String(liczba)}`
  z parsowaniem co znak (gubi przecinek, nie da się skasować "0"). Nie dodawaj
  `selectTextOnFocus` na tych polach — na webie zjadał pierwszy wpisany znak.
- **`AppBottomSheet`** (`src/components/design/AppBottomSheet.tsx`) — `visible`/
  `onClose`/`children` + opcjonalne `header`/`footer`/`scrollable`/
  `initialFocusRef`. Kontrakt bez
  zmian od Fazy 3.1, ale WEWNĘTRZNA implementacja PRZEBUDOWANA OD ZERA w Fazie
  3.15 (2026-11-04, KRYTYCZNE — patrz NEXT_STEPS.md punkt 6 po pełną historię
  dochodzenia). **Już NIE `@gorhom/bottom-sheet`** (biblioteka CAŁKOWICIE
  usunięta z appki po tym jak user na realnym Samsungu zgłosił, powtarzalnie,
  że ŻADEN popup w ogóle się nie otwierał — dwa targetowane fixy w gorhom
  samym, włącznie z `overrideReduceMotion`, nie pomogły; diagnostyka
  `Alert.alert()` potwierdziła że JS/dotyk/natywne nakładki działają OGÓLNIE
  na urządzeniu, problem był w 100% izolowany do samej biblioteki).
  Teraz: goły, wbudowany RN `Modal` (`transparent`, `statusBarTranslucent`,
  `animationType="none"` — WŁASNA animacja zamiast wbudowanej, patrz niżej),
  ZERO zależności od reanimated/worklets/gorhom w samym mechanizmie
  prezentacji. Backdrop własny: `TouchableWithoutFeedback` (tap=zamknij) +
  `BlurView` (`expo-blur`, `experimentalBlurMethod="dimezisBlurView"` na
  Androidzie — domyślny tryb tam to `'none'`, czyli CICHE spadnięcie do
  samego przyciemnienia bez realnego rozmycia) + `rgba(0,0,0,.6)`.
  Backdrop (opacity) i sheet (translateY) animowane NIEZALEŻNIE przez
  OSOBNE JS-driven `Animated.Value`y z 'react-native' (ŚWIADOMIE nie
  reanimated — cel przebudowy był wyeliminować tę warstwę jako podejrzaną)
  — konieczne bo `Modal`'s wbudowane `animationType="slide"` animowało
  CAŁĄ zawartość (backdrop+sheet) jako jedną bryłę, więc blur wjeżdżał od
  dołu razem z sheetem zamiast po prostu płynnie się pojawić w miejscu
  (2026-11-04, user: "ten blur powinien być natychmiastowy smooth a on się
  wysuwa od dołu"); `modalVisible` (stan lokalny, osobny od propa
  `visible`) trzyma `Modal` zamontowany przez czas trwania animacji
  zamykania. "Dynamiczny" rozmiar (rośnie do treści, max 78% ekranu, od
  tego momentu scrolluje) osiągnięty BEZ żadnej biblioteki pomiarowej —
  `sheet` ma `maxHeight`, `header`/`footer` są zwykłymi (nie-flex) dziećmi,
  środkowy `ScrollView` dostaje WŁASNY `style` (NIE tylko
  `contentContainerStyle`!) z `flexShrink:1` — bez tego `style` na samym
  komponencie `ScrollView` nie ma ograniczonej wysokości i rośnie do pełnej
  treści zamiast przycinać się i scrollować (2026-11-04, user: długi
  paragon w Finansach — "nadal nie działa scroll... nie da się
  scrollować" — DRUGI, inny bug niż wcześniejszy konflikt zagnieżdżonych
  scrolli, patrz `nestedScrollEnabled` w ChipRow/ReceiptItemRow). `TextInput`y
  WEWNĄTRZ sheeta to zwykły `TextInput` z 'react-native' (NIE gorhom's
  `BottomSheetTextInput` — ten sheet nie ma już własnego gestu
  przeciągania, więc nie ma z czym konkurować o fokus; 6 konsumentów z
  `BottomSheetTextInput`/`BottomSheetFlatList` przełączonych z powrotem na
  zwykłe `TextInput`/`FlatList`). `BottomSheetModalProvider` USUNIĘTY z
  `app/_layout.tsx` (nic go już nie potrzebuje) — `GestureHandlerRootView`
  w `app/_layout.tsx` ZOSTAJE, ale `AppBottomSheet` ma TERAZ WŁASNY, DRUGI
  `GestureHandlerRootView` WEWNĄTRZ `Modal`-a — `Modal` renderuje swoją
  treść w OSOBNYM natywnym oknie (Android `ReactModalHostView`), poza
  hierarchią głównego roota, więc gesty `react-native-gesture-handler`
  (MoodPad's `Gesture.Pan()`, `Toggle`/`Segmented`) bez własnego roota W TYM
  oknie po prostu się nie rejestrują (2026-11-04, user: w Humorze "nie mogę
  kliknąć" — regresja z przejścia na `Modal`, dokładnie ten mechanizm który
  `MoodModal.tsx`'s stary komentarz już raz opisywał jako "rozwiązany"
  pod gorhom). Klawiatura: `KeyboardAvoidingView behavior="height"` na
  Androidzie (nie `undefined`) — `Modal` jako własne natywne okno NIE
  dziedziczy `android:windowSoftInputMode="adjustResize"` z manifestu
  Activity, więc bez tego klawiatura całkowicie zasłaniała sheet zamiast
  go przesunąć (2026-11-04, user: zrzut z zasłoniętym "Nowe zadanie").
- **Wszystkie popupy w appce** używają `AppBottomSheet` (MoodModal/
  AddExpenseModal/ProductsModal/TransactionsModal/WydatkiModal/HabitsModal/
  FoodCategoryItemsModal/DayDetailModal/MonthViewModal/AddTaskCard-composer/
  balance-edit) — zero plain `Modal` nigdzie w repo (Faza 3.8 dokończyła
  migrację; Faza 3.15 wymieniła implementację pod spodem, bez dotykania
  żadnego z tych konsumentów poza usunięciem gorhom-specific TextInput/
  FlatList wariantów).

Zweryfikowane: `npx tsc --noEmit`/`npx jest` 180/180 czysto, `npx expo prebuild
--platform android` generuje poprawny natywny projekt (Faza 3.15 to czysto JS
fix, zero zmian natywnych). **Pierwsza w całej tej serii sesji rzeczywista
weryfikacja WIZUALNA treści popupu** — `expo web`+Playwright nigdy wcześniej
nie renderował ŻADNEJ zawartości bottom-sheeta pod `react-native-web` (znany
ślepy punkt od Fazy 3.9, bo gorhom's portal tam nie działał); z nowym
`Modal`-em Humor i "Nowe zadanie" oba renderują się w pełni.

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

**Faza 3.8 (bottom-sheet: WSZYSTKIE pozostałe popupy) — ZROBIONA (2026-11-02,
user: "dawaj")** — kontynuacja Fazy 3.6. KAŻDY popup w appce (Dashboard/Daily/
Finanse/Zadania) jest teraz `AppBottomSheet`, zero plain `Modal` nigdzie w repo
(zweryfikowane grepem `<Modal` po całym `app/`+`src/`). Migrowane: `WydatkiModal`+
`FoodCategoryItemsModal` (Dashboard/Finanse), `AddExpenseModal`/`ProductsModal`/
`TransactionsModal`/balance-edit (Finanse), `DayDetailModal`/`MonthViewModal`/
`AddTaskCard`-kompozytor (Zadania). Szczegóły per-popup w §DASHBOARD/§FINANSE/
§ZADANIA niżej i w NEXT_STEPS.md "Faza 3.8".

**Faza 3.9 (real-device bugi + pętla wizualna `expo web`) — ZROBIONA (2026-11-02,
user zrzutami z telefonu: kafel "Nastrój" skurczony do ~0 wysokości, kafel
"Jedzenie PLN/dzień" pusty, kolumny rzędów nierówne; potem DESIGN.md + `design/rn/`
referencja).**

1. **`Tile.tsx` — DRUGA runda tego samego bugu, inny fix.** Faza 3.6/3.7's
   dwuwidokowa struktura (`Pressable` owijający `Animated.View`, każdy ze swoim
   `style`) WYGLĄDAŁA naprawiona w zweryfikowanym `react-native-web` teście, ale
   na prawdziwym Androidzie dalej kolapsowała. Powtórzony test (dokładna kopia
   realnej struktury obu ekranów) TYM RAZEM NIE odtworzył błędu wcale —
   rozbieżność między silnikiem CSS przeglądarki a prawdziwym Yoga, której nie
   dało się dalej zdiagnozować bez urządzenia. Zamiast kolejnej łatki: dwuwidokowa
   struktura USUNIĘTA CAŁKOWICIE. Interaktywny kafel to teraz JEDEN element
   (`Animated.createAnimatedComponent(Pressable)`), strukturalnie identyczny ze
   statycznym kaflem (który nigdy nie miał tego bugu — najmocniejszy dostępny
   dowód że podwójny widok, nie flex sam w sobie, był źródłem problemu). `s.fill`/
   `s.stretch` (martwe po refaktorze) USUNIĘTE.
2. **Pętla wizualna `expo start --web` + Playwright — NOWA, trwała infrastruktura**
   (DESIGN.md §9: "Weryfikacja wizualna jest obowiązkowa... Ekran jest skończony
   dopiero, gdy wyglądają tak samo [jak `app-design.html`]"). Zainstalowane:
   `react-dom`/`react-native-web`/`@expo/metro-runtime`. Dwie przeszkody
   naprawione PERMANENTNIE (nie obejściami jednorazowymi):
   - `babel-strip-import-meta.js` + warunek `platform==='web'` w `babel.config.js`
     — Metro-na-webie parsuje `import.meta` (martwa gałąź wewnątrz zustand's
     `devtools` middleware, bundlowana mimo że appka używa TYLKO `persist`, bo
     Metro nie tree-shake'uje nieużywanych eksportów) jako twardy SyntaxError w
     zwykłym `<script>`. Dotyczy WYŁĄCZNIE web-buildu, native/Hermes buduje się
     bez tego od zawsze.
   - `useAuthUser.ts`'s `Platform.OS==='web'` → fake zalogowany user, pomija
     prawdziwe Firebase `onAuthStateChanged`. Prawdziwe logowanie Google w
     headless Playwright nie jest wykonalne; appka i tak jest WYŁĄCZNIE na
     Androida (CLAUDE.md), `Platform.OS==='web'` NIGDY nie zachodzi w prawdziwym
     buildzie — bezpieczne na stałe w repo, nie "do usunięcia przed commitem".
   - Użycie: `npx expo start --web --port 8081` (w tle) + Playwright
     `page.goto('http://localhost:8081/<trasa>')`, viewport 390×844, screenshot
     obok `page.goto('file://.../design/app-design.html')`'s `.phone` elementu
     (ten sam viewport) — PIERWSZA metoda weryfikacji tej sesji, która renderuje
     PRAWDZIWY kod appki (nie ręcznie kopiowaną aproksymację jak poprzednie
     `react-native-web`-testy w scratchpadzie) i faktycznie złapała/potwierdziła
     powyższe bugi.
3. **Konkretne, zweryfikowane TĄ pętlą naprawy:**
   - `Bars.tsx`'s `minHeight: 2` → `3` (DESIGN.md §"Stany puste": "słupki z zerem
     → słupek 3 px", dokładna wartość ze spec).
   - Dashboard's "Bezpieczne wydatki" — `safePerDay < 0` pokazywało surową ujemną
     liczbę ("-2 PLN/DZIEŃ", ze zrzutu usera) zamiast DESIGN.md's "bezpieczne
     wydatki < 0 → czerwone 0 + „brak X zł", nigdy liczba ujemna". Naprawione w
     `app/(tabs)/index.tsx`.
   - `app/(tabs)/daily.tsx`'s `moodRow: {minHeight: 100}` zostaje jako dodatkowa
     siatka bezpieczeństwa (nieszkodliwa, test nie pokazał że była konieczna PO
     fixie Tile.tsx, ale tani koszt).

**`design/DESIGN.md`** (NOWY, 2026-11-02, przysłany przez usera jako zaktualizowany,
precyzyjniejszy spec — zastępuje nieformalne odwołania do `app-design.html` jako
JEDYNEGO źródła). Zawiera m.in. "twarde zasady" przeniesienia na RN: jawne
szerokości siatki zamiast `flex` w rzędzie z `gap` (`col = (W−24−3·8)/4`),
zaprojektowane stany puste per typ danych, `FitList` z ghost-wierszami. Referuje
`design/rn/` jako "gotowy, sprawdzony kit" (theme.ts/layout.tsx/NavBar.tsx/
DashboardScreen.tsx) — przesłany przez usera tego samego dnia, patrz Faza 3.10.

**Faza 3.10 (Dashboard na kit `design/rn/`) — ZROBIONA (2026-11-02, user przesłał
kit).** Kit skopiowany 1:1 do `src/ui/` (`theme.ts`/`layout.tsx`/`DashboardScreen.tsx`/
`NavBar.tsx`) — jedyne zmiany względem przesłanych plików: `NavBar`'s `ICONS`
(`finance`→`finances`, dopasowanie do nazw plików w `app/(tabs)/`) i nowy wymagany
prop `onSettingsPress` zamiast `navigation.navigate('settings')` (Ustawienia to
stack-route POZA grupą `(tabs)` w tej appce — `app/settings.tsx` — nie piąta
zakładka wewnątrz tego Tabs navigatora, więc nawigacja w obrębie navigatora nie
miałaby dokąd trafić). Reszta kitu (grid, style, komponenty) BEZ ZMIAN — zero
własnych wartości koloru/rozmiaru/odstępu poza `theme.ts` z kitu, per
PROMPT_CLAUDE_CODE.md.

`app/(tabs)/index.tsx` przebudowany na cienki adapter: zbiera prawdziwe dane
(te same store'y/hooki co stary Dashboard z Fazy 3.2 — `calendarStore`/
`expensesStore`/`foodStats`/`useWydatkiData`/`utils/balance.ts`), mapuje je na
kitu's `DashData` i renderuje `<DashboardScreen {...data} />` + `WydatkiModal`
obok (ten sam popup co wcześniej, otwierany przez `onOpen('foodDay'|'foodMonth'|
'tx'|'safe')`). `streaks`/`sleep` nadal `null` (appka nie ma store'a nawyków ani
Health Connect) — kit renderuje `null` jako zaprojektowany stan pusty z DESIGN.md
("0" przygaszone + "brak"), nie fałszywy mock.

`app/(tabs)/_layout.tsx`: stary `TabBar.tsx` (ręczne liczenie aktywnej trasy z
`usePathname()`) USUNIĘTY, zastąpiony kitu's `NavBar` jako `tabBar` prop `<Tabs>`
— `active`/podświetlenie teraz z `BottomTabBarProps`'s `state`, nie ręcznie. Kolejność
zakładek jawna przez `<Tabs.Screen name=.../>` (`index`→`daily`→`finances`→`tasks`)
— BEZ TEGO expo-router rejestruje trasy w kolejności wczytywania plików z dysku
(alfabetycznie-podobnej, ale nie identycznej z zamierzoną kolejnością Dashboard→
Daily→Finanse→Zadania) — złapane dopiero w zrzucie z pętli wizualnej (ikonka
"Finanse" i "Zadania" były zamienione miejscami).

Zweryfikowane pętlą z Fazy 3.9 (`expo start --web` + Playwright, 390×844, obok
`design/app-design.html`) — siatka kolumn teraz wyrównana MIĘDZY rzędami (był to
realny powód "kolumny się rozjeżdżają", nie kosmetyka: stary `Tile.tsx` miał
`flex:1` domyślnie + `style` nadpisujący wagami (`flex:3` itp.) per wołający —
dokładnie ten anti-pattern, przed którym ostrzega komentarz w kitu's `layout.tsx`,
różne sumy wag w różnych rzędach dają różne szerokości kolumn. Kit liczy szerokość
JAWNIE z kontekstu (`col = (W − 2·S.x − 3·S.gap) / 4`, `tile(span) = span·col +
(span−1)·gap`), więc kolumna w każdym rzędzie ma identyczną szerokość niezależnie
od tego ile kafli/jakiego `span` jest w rzędzie obok. Fonty/zaokrąglenia/odstępy
zgodne, zero błędów w konsoli przeglądarki.

**Faza 3.10 dokończona (2026-11-02) — wszystkie 4 główne ekrany na kicie.** Po
Dashboardzie (wyżej) ten sam traktament dostały, screen po screenie, zawsze z
pętlą wizualną `expo start --web` + Playwright 390×844 obok `design/app-design.html`,
zrzuty pokazane userowi po każdym:
- **Daily** — kit nie ma `DailyScreen`, więc przebudowa poszła wprost z
  `design/DESIGN.md`'s "twardych zasad" + `src/ui/layout.tsx`'s prymitywów
  (`Screen`/`Row`/`Tile`/`StatTile`/`Cap`). Sen/Kroki/Tętno/Waga/Woda — `StatTile
  value={null}` (wbudowany zaprojektowany stan pusty), Sen dostał dedykowany
  "0h 00m" + "Połącz zegarek" 1:1 z kitu's Dashboard sleep-tile. Nastrój bez zmian
  logiki (`useMoodStore`/`MoodModal`).
- **Finanse** — też bez odpowiednika w kicie, ta sama metoda. Przy okazji
  złapany i naprawiony drobny, sprzed-tej-rundy bug: "Podział" pokazywał
  "0,003 PLN" (suma `Math.max(x,0.001)` floorów używanych tylko do proporcji
  słupka, nie prawdziwa suma) — rozdzielone na osobne wartości dla słupka i dla
  wyświetlanego tekstu. Praca/Najbliższa opłata (brak store'a `bills`) →
  `StatTile value={null}`, zastępuje stare ręczne "wkrótce — kalendarz/rachunki"
  (łamało regułę "nigdy wkrótce" sformalizowaną w DESIGN.md już PO napisaniu
  tamtego kodu). FAB "+"/wszystkie popupy bez zmian (realne funkcje, poza
  zakresem kitu).
- **Zadania** — też bez odpowiednika w kicie. Nowość: nagłówek dostał zakres
  tygodnia ("2 – 8 LIS", lokalny `weekRangeLabel`) — brakowało go względem
  mockupu. `WeekMonthCalendar.tsx`/`TaskRow.tsx` bez zmian logiki (realny
  kalendarz/store zadań), Segmented+"+" inline (nie floating FAB, zgodnie ze
  spec) bez zmian.
- **Ustawienia** — ŚWIADOMIE bez zmian w tej rundzie. Wcześniejsza decyzja
  (2026-11-02, przed Fazą 3.9) już ustaliła, że to przeszukiwalna, sekcjonowana
  lista dziesiątek realnych ustawień, nie grid 4-kolumnowy jak spec's `#set`
  (5 prostych demo-kafli) — kolory już wyrównane do `theme.ts` globalnie, zero
  dodatkowej pracy potrzebne. Kit nie ma tu zastosowania (nie jest listą
  ustawień, tylko siatką kafli).

**Stary `src/components/design/{Tile,StatTile,Row,PricePill,Bars,StackBar,
FitList}.tsx` USUNIĘTE** (2026-11-02, po potwierdzeniu grepem zera pozostałych
importów) — wszystkie 4 ekrany są teraz na `src/ui/layout.tsx`. `Segmented.tsx`/
`Tag.tsx`/`ChipRow.tsx`/`AppBottomSheet.tsx`/`MoodPad.tsx`/`Toggle.tsx` ZOSTAJĄ,
wciąż żywe, poza zakresem tej migracji.

**Faza 3.11 (nawyki: Woda/Słodycze/Trening) — ZROBIONA (2026-11-02, user: "zrób
tę apkę w pełni funkcjonalną, trzymaj się zasad które mamy").** Pierwszy z
dwóch dużych stubów z Fazy 3.2/3.10 dostał realny store — DRUGI (Health
Connect) zostaje świadomie odłożony, bo wymaga natywnej integracji z
urządzeniem niemożliwej do zbudowania/zweryfikowania bez fizycznego Androida,
w przeciwieństwie do nawyków (czysty software, tap-to-toggle, jak Nastrój).

- **Model** (`src/types/habits.ts`): jeden `HabitDay` na dzień, 3 booleany
  (`water`/`sweets`/`training`), `true` = "udało się" symetrycznie dla
  wszystkich trzech (woda: wypiłem dość, słodycze: obyło się bez nich, trening:
  potrenowałem) — jeden kształt danych, jedna funkcja streaka dla wszystkich.
- **Store** (`src/store/habitsStore.ts`) — ten sam wzorzec co `moodStore.ts`
  (zustand+persist+AsyncStorage, offline-first, zero Firestore w akcjach).
- **`utils/habitStreak.ts`** — passa = kolejne dni wstecz z `true`, przerywana
  pierwszym `false`/brakiem. Dziś bez rekordu (user jeszcze nie zaznaczył) NIE
  zeruje wczorajszej passy — liczenie zaczyna się wtedy od wczoraj (grace
  period przez cały dzień), dziś jawne `false` PRZERYWA (0). 6 testów
  (`__tests__/habitStreak.test.ts`), w tym rozróżnienie kluczy (jeden nawyk
  nie wpływa na streak drugiego tego samego dnia).
- **`HabitsModal.tsx`** (`src/components/dashboard/`) — jeden popup na
  wszystkie 3 nawyki naraz (tematycznie powiązane, nie ma sensu osobny sheet
  na jeden toggle), otwierany z Dashboardu przez `onOpen('streak', key)` (kit's
  `DashboardScreen` już to wołał — `key` tylko ustawia kolejność w popupie,
  nie zawęża widoku). Tap na wiersz = toggle dzisiejszego stanu, żywy streak
  przelicza się natychmiast. Styl 1:1 z kitu (`C`/`T`/`R`/`S`/`F` z
  `src/ui/theme`), "ON" = odwrócone kolory jak `StatTile`'s `hot` wariant.
- **`app/(tabs)/index.tsx`** — `streaks: {water,sweets,training}` liczone z
  `habitStreak` zamiast `null,null,null`. Realne `0` (user jeszcze nic nie
  zaznaczył) renderuje się jako zwykłe, niemdlone "0 dni" — NIE jako
  zaprojektowany pusty stan ("brak") — bo źródło danych już istnieje, `0` jest
  prawdziwą wartością, nie brakiem danych. Potwierdzone zrzutem: kafle
  pokazują teraz "0 DNI WODA" zamiast starego "0 BRAK WODA".

**Znalezisko tej rundy — pętla wizualna (`expo web`+Playwright) NIE łapie
bottom-sheetów.** Próba interaktywnego kliknięcia kafla→otwarcia
`HabitsModal`-a w web-podglądzie pokazała, że `@gorhom/bottom-sheet`'s
`BottomSheetModal.present()` w ogóle nie prezentuje się pod `react-native-web`
w tym środowisku (reanimated worklet/gesture-handler zależności, które web
prawdopodobnie inaczej inicjalizuje) — zweryfikowane KONTROLNIE na dużo
starszym, wcześniej "zweryfikowanym" `WydatkiModal`-u (ten sam wynik: zero
reakcji po kliknięciu). Pętla wizualna z Fazy 3.9/3.10 łapała WYŁĄCZNIE
układ/siatkę BAZOWEGO ekranu (co było jej jedynym zadeklarowanym celem w
PROMPT_CLAUDE_CODE.md) — nigdy nie testowała zawartości popupów, mimo że
wcześniejsze opisy ("Zweryfikowane expo start --web...") mogły to sugerować
czytelnikowi. Treść POPUPÓW (Humor/Wydatki/nowy Nawyki/balance-edit/itd.)
pozostaje możliwa do zweryfikowania WYŁĄCZNIE na prawdziwym urządzeniu —
dopisane jawnie do listy "DO PRZETESTOWANIA" w NEXT_STEPS.md, żeby nie
zakładać inaczej w kolejnych fazach.

**Faza 3.12 (Health Connect: Sen/Kroki/Tętno/Waga/Woda) — ZROBIONA (2026-11-02,
user: "masz w sapp jak były połączenia z health czemu nie możesz tego zrobić na
podstawie jak tam").** Poprawka na moje wcześniejsze założenie — "niemożliwe do
zweryfikowania bez telefonu" ≠ "niemożliwe do napisania". Port z `/home/user/
sapp`'s działającej integracji (`react-native-health-connect` — sapp miał v3,
tu zainstalowane ^4.1.3, API funkcji identyczne, TYLKO kształt surowych
rekordów `Mass`/`Volume` się różni, `healthConnectService.ts` konwertuje sam).
`plugins/withHealthConnectQueries.js` — PRZYCIĘTY port (biblioteki własny
bundlowany plugin w v4 już dodaje rationale/`ViewPermissionUsageActivity`,
sapp's v3-era wersja to dublowała; zostaje TYLKO `<queries>` + wstrzyknięcie
`HealthConnectPermissionDelegate.setPermissionDelegate(this)` do
`MainActivity.onCreate` — biblioteka ma to pole `lateinit`, nic go samo nie
inicjalizuje). `healthStore.ts`/`useHealthSync.ts` — ten sam cache+persist+
throttled-cichy-sync wzorzec co nawyki. Ustawienia dostały sekcję
"Połączenia". Dashboard's `sleep` i Daily's 4 StatTile'e czytają prawdziwe
dane, z zerową zmianą wizualną dla usera bez zegarka (ten sam pusty stan).
Zweryfikowane `npx expo prebuild --platform android --no-install` (config-
plugin NIE wykonuje się przy `expo export`, tylko bundluje JS) — potwierdzone
bezpośrednio w wygenerowanym `AndroidManifest.xml`/`MainActivity.kt`, potem
USUNIĘTE (CNG, nie commitujemy natywnego projektu). Szczegóły i pełna lista
"DO PRZETESTOWANIA" w NEXT_STEPS.md "Faza 3.12" — to NAJMNIEJ zweryfikowana
funkcja w appce, prawdziwy pierwszy test dopiero na telefonie.

**Następne fazy** — "Płatności cykliczne" (store `bills`, odblokuje pełne
"Bezpieczne wydatki"/"Najbliższe 48h"/Finanse's Praca+Najbliższa opłata) —
jedyny duży stub, który zostaje. Rzeczywisty render/dotyk na urządzeniu
(scroll vs no-scroll, gesty, FitList ghost-wiersze, kolejność navbaru, TREŚĆ
KAŻDEGO POPUPU, i teraz Health Connect) nadal NIE był możliwy do
zweryfikowania w tym środowisku — PRIORYTET na następny test na telefonie,
lista w NEXT_STEPS.md "Faza 3.12".

## DASHBOARD [GE]

**Przebudowany na nowy system komponentów (Faza 3.2, 2026-11-01), POTEM na kit
`design/rn/` (Faza 3.10) — ten akapit i poniższe listy komponentów (`StatTile`/
`FitList`/`Row`/`PricePill` z `src/components/design/`) są HISTORIĄ, te pliki
USUNIĘTE w Fazie 3.10 (zastąpione `src/ui/layout.tsx`'s odpowiednikami, patrz
§"Faza 3.10" wyżej). Układ rzędów/kolejność kafelków NIE zmieniła się, tylko
implementacja pod spodem. Streak-stub opis niżej też jest historią — Woda/
Słodycze/Trening są REALNE od Fazy 3.11, patrz tam.

**NIEprzewijalny, celowo** (bez zmian od 2026-10-31) — 5 rzędów o układzie
DOKŁADNIE jak w `design/app-design.html`'s `#dash` (4 kolumny, `grid-template-rows:
auto 96px auto 1fr 1.3fr`, w RN: `View flexDirection:'column'`, rzędy 1-3 content-
sized, rzędy 4-5 `flex:1`/`flex:1.3`). Listy w rzędach 4-5 używają `FitList`
(`src/components/design/FitList.tsx`) — mierzą realną dostępną wysokość przez
`onLayout` i docinają dane do tego co się zmieści, zero sztywnego "pierwsze 4"
(CLAUDE.md regl #1, dosłowny przepis `onLayout→Math.floor(h/rowH)→slice`).

**Rząd 1 (2026-11-09, user: "wywalimy streaki")** — 3× `StatTile` streak
(Woda/Słodycze/Trening) USUNIĘTE; lewa połowa świadomie pusty `Tile`
(`backgroundColor:'transparent'`, user wybrał "zostaw pusty kafelek" zamiast
czegoś nowego), hot event tile poszerzony na `span={2}` (prawa połowa).
Odhaczanie nawyków przeniesione do `app/(tabs)/daily.tsx`'s rząd "Nawyki" —
patrz NEXT_STEPS.md "Dashboard: usunięte streaki..." po pełny opis (żeby nie
zostawić dead-endu, ten sam `HabitsModal`/`habitsStore` co wcześniej).
**Rząd 2 (96px)** — Ciekawostka + Sen.
**Rząd 3 (2026-11-09)** — Jedzenie PLN/dzień USUNIĘTE całkiem (user wybrał
wprost); #JedzeniePerMiesiąc (`Bars`, tap→`WydatkiModal`) dostał cały rząd
(`span={4}`).
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
  stan, bez popupu — nie ma tu nic do rozwinięcia w sheet, sama ciekawostka już
  jest całą treścią kafla).
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

Kliknięcie w kafelek z danymi finansowymi otwiera `WydatkiModal.tsx` (Faza 3.8,
2026-11-02: `AppBottomSheet`, patrz §FINANSE niżej). Streaki/Sen są
NIEINTERAKTYWNE (brak `onPress` → `Tile` renderuje się jako plain `View`, nie
`Pressable` — zero udawanej klikalności).

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
  `Gesture.Pan()`/`GestureDetector`/`runOnJS` PRZENIESIONE bez zmian (już
  battle-tested na urządzeniu, port sapp), ale **od Fazy 3.16 (2026-11-04)
  JUŻ NIE kwantyzuje do siatki 5×5** (user: "humor musi być smooth a nie
  punktowy... liczy się w procentach... 0,0 na środku i droga to promień w
  każdym kierunku jakby smooth") — `onUpdate` liczy teraz `mood`/`energy`
  jako CIĄGŁĄ ułamkową pozycję palca na padzie (`1 + frakcjaX*4`, zasięg
  1..5 bez zmian, więc stare całkowitoliczbowe wpisy są dalej poprawne —
  zero migracji danych), throttlowaną do kroku 0,02 żeby nie zalewać
  mostka JS `runOnJS`-em co klatkę gestu. `MoodEntry.mood`/`energy` (patrz
  `types/mood.ts`) to teraz `number`, NIE `MoodLevel` — `MoodLevel` (unia
  `1|2|3|4|5`) żyje dalej TYLKO jako klucz do `MOOD_COLORS`/`MOOD_LABELS`
  itp., każde miejsce pokazujące kolor/etykietę z continuous wartości
  przechodzi przez `roundLevel()`. Zero emoji w kropce/odczycie (reguła #5
  ze spec, "Zero emoji"), zero widocznych linii siatki (subtelny krzyż przez
  środek zamiast), nowy `mini` wariant (podgląd w Daily, czysto wizualny,
  bez `GestureDetector`) i `big` wariant (etykiety narożników, w
  `MoodModal`). "Glow" pod kropką (`react-native-svg`'s `RadialGradient`) i
  PIONOWE (obrócone `transform:rotate`) etykiety osi lewej/prawej DOSTAŁY
  realną implementację w Fazie 3.16 (2026-11-04, user po zrzucie: "napisy
  bokiem... i gradient"). Tekstura tła z powtarzających się kropek nadal
  ŚWIADOMIE pominięta (wymagałaby SVG-wzoru/obrazka, zbyt kosmetyczny
  niuans).
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
  `TextInput`y to zwykły `TextInput` z 'react-native' (nie gorhom's
  `BottomSheetTextInput`, usunięty razem z gorhom w Fazie 3.15 — patrz
  `AppBottomSheet` opis wyżej); `MoodPad`'owy `Gesture.Pan()` routuje się
  poprawnie dzięki DRUGIEMU `GestureHandlerRootView` WEWNĄTRZ
  `AppBottomSheet`'s `Modal` (też Faza 3.15, patrz tam — `Modal` renderuje
  się w osobnym natywnym oknie, poza hierarchią jedynego roota w
  `app/_layout.tsx`).
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
  niech też ma takie kafelki jak tygodniowy widok, może być nawet na cały ekran";
  2026-11-02, Faza 3.8: przebudowany z pełnoekranowego `Modal` na `AppBottomSheet`)
  — duży popup (sheet do 78% wysokości ekranu, scroll wewnątrz gdy trzeba) z siatką
  6×7, TYCH SAMYCH kolorowych chipów co tydzień (max 2/komórkę + "+N"), nawigacja
  miesiącami + "Dziś".
  Dawny inline widok miesiąca (ciasna siatka, sama kropka) USUNIĘTY — miesiąc nigdy
  nie renderuje się ściśnięty, zawsze w popupie z miejscem na treść. Kropka pod dniem
  w widoku tygodnia zastąpiona chipami (`eventCoversDay`, obsługuje wielodniowe).
  Czyta `events`+`gcalEvents` z `calendarStore`. Zaznaczenie dnia (`selectedDate`)
  jest na razie czysto wizualne/nawigacyjne, NIE filtruje listy zadań niżej (dwa
  osobne widoki tego samego ekranu, nie master-detail).
- `TaskRow.tsx` — checkbox (ukończ, znika z listy), tytuł (2026-11-08: TAP
  otwiera edycję — `onEdit`), tagi (neutralne szare chipy), kosz (2026-11-08:
  JUŻ NIE usuwa od razu — `onRequestDelete`, `tasks.tsx` pokazuje mały
  potwierdzający `AppBottomSheet` zanim faktycznie wywoła `deleteTask`, user:
  "potwierdzenie usunięcia taskow").
- `AddTaskCard.tsx` — formularz dodawania ORAZ edycji (2026-11-08, `editingTask`
  prop, ten sam wzorzec co `AddExpenseModal`'s `editingExpense`): tytuł, jeden
  tag (tekst), termin przez 4 szybkie wybory (Dziś/Jutro/Za tydzień/Bez
  terminu) + piąty "Dokładny termin" (2026-11-08, user: "termin dokładny w
  stylu samsunga scroll plus klikalny kalendarz") — otwiera natywny
  `DateTimePickerAndroid` (data → godzina, połączone w jeden ISO-literal
  string `YYYY-MM-DDTHH:MM:00`, lokalny czas bez strefy jak `eventStart()` w
  dashboardzie) — DOKŁADNIE ten sam wzorzec co `AddExpenseModal`'s
  `openDatePicker`, zero własnego UI kalendarza/scrolla (na Samsungu z One UI
  to WŁAŚNIE jest "styl Samsunga" — systemowy dialog).
- **Lista zadań** — kategoryzacja TERAZ/TERMINOWE/BEZTERMINOWE napędzana jednym
  polem `deadline` (logika sekcji wzięta z `sapp`, zadanie #42 tam, ale UI/UX
  zupełnie nowy, jak ustalone 2026-10-26). `deadline <= dziś` → Teraz, w przyszłości
  → Terminowe, brak → Bezterminowe.
- **Offline-first, ŚWIADOMIE bez auto-sync do Firestore** przy CRUD z tego
  ekranu — leci tylko przez `useCalendarStore` (AsyncStorage). Pełny
  dwukierunkowy Firestore sync to osobny krok (patrz NEXT_STEPS.md), już
  istnieje jako ręczny test w Ustawieniach → Diagnostyka → "Sync kalendarza",
  ale nie spięty z normalnym UI. Google Calendar `gcalEvents` TO już auto-
  synchronizowane — `useGoogleCalendarSync` (`src/hooks/`, wzorzec 1:1 z
  `useHealthSync`: dedup `inFlight` + throttle 5 min) wołany z Dashboardu I
  Zadań (2026-11-08, user: "jak wchodzę do apki to kalendarz sie nie ładuje
  na dashbordzie" — wcześniej TYLKO ten ekran odświeżał `gcalEvents`).
- Zewnętrzna referencja zachowania kalendarza: TickTick (pasek kalendarza u góry +
  lista pod spodem) — zachowana.

**Widget na pulpicie Androida — ZROBIONY 2026-11-13**: `plugins/withTasksWidget.js`
(natywny AppWidgetProvider+RemoteViews, 6 slotów, tło w kolorze kafli, kółko =
odhacz bez otwierania appki, tap = `sapp2://tasks`), `utils/widgetTasks.ts`
(`buildWidgetSnapshot`, test), `services/widgetSync.ts` (snapshot do filesDir +
`TasksWidget.requestUpdate`), `services/widgetToggleDrain.ts` (kolejka odhaczeń →
`updateTask(status:'done')`), podpięte w `app/_layout.tsx` (subskrypcja na
`calendarStore.tasks` + drenaż przy starcie/powrocie). Historia decyzji niżej:

**(archiwalne) Widget na pulpicie Androida — JESZCZE NIE ZROBIONY** (user, 2026-10-26: "jak
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
balance-edit) — PRZEBUDOWANE na `AppBottomSheet` (Faza 3.8, 2026-11-02, user:
"dawaj" po "miało być 1do1").** W Fazie 3.4 (ten akapit niżej, historia) zostały
świadomie bez zmian — zbyt duże ryzyko robić migrację 5 różnych, złożonych modali w
tej samej rundzie co przebudowa głównego ekranu. Teraz zrobione: `AddExpenseModal`
(największy, header=tytuł+usuń/zamknij, footer=kwota+Zapisz PRZYPIĘTE, pływający
FAB "wklej ze schowka" jako sibling footera z `bottom:'100%'`, patrz komentarz w
pliku), `ProductsModal`/`TransactionsModal` (header=tytuł+szukajka, nieruchome),
`WydatkiModal`+`FoodCategoryItemsModal` (drill-down, STACKUJĄ się jako dwa
niezależne sheety naraz — gorhom's `BottomSheetModalProvider` to wspiera bez
specjalnej obsługi z naszej strony), balance-edit (`scrollable=false`, krótka
statyczna treść). Wszystkie `TextInput`y → gorhom's `BottomSheetTextInput`,
listy (`TransactionsModal`) → `BottomSheetFlatList`. `ComingSoonRow`/
`LiveSectionRow` (stary wzorzec listy "Obszary") USUNIĘTE Z REPO CAŁKOWICIE — po
przebudowie Finansów nic ich już nie importowało (Daily zrzucił je w Fazie 3.3).

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
  dokładnie ten sam `WydatkiModal`-owy wzorzec (ówczesny pełnoekranowy `Modal`,
  `presentationStyle="fullScreen"` — Faza 3.8, 2026-11-02: `AppBottomSheet`, patrz
  wyżej) co dla kafla Jedzenie (patrz niżej) — **Dashboard
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
  `src/hooks/useKeyboardHeight.ts` (port z sapp), użyty zamiast `KeyboardAvoiding-
  View` (niewiarygodnego wewnątrz RN's `Modal` na Androidzie), dotąd ISTNIAŁ w
  `AddExpenseModal.tsx`. Faza 3.8 (2026-11-02) przeniosła `AddExpenseModal` (jak i
  `MoodModal` w Fazie 3.6) na `AppBottomSheet` — hook USUNIĘTY z obu, `keyboard-
  Behavior="interactive"` gorhom's `BottomSheetModal` rozwiązuje to teraz dla
  KAŻDEGO popupu z inputami, jedną regułą w jednym miejscu (`AppBottomSheet.tsx`),
  nie per-ekranowym hookiem. `useKeyboardHeight.ts` zostaje w repo — nieużywany
  teraz (zero popupów-`Modal` z inputami już w ogóle nie ma), ale generyczny,
  gotowy gdyby jakikolwiek PRAWDZIWY `Modal` (nie-sheet) z polem tekstowym kiedyś
  wrócił.
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
6. **Wibracje — ZROBIONE (2026-11-01, "dawaj dalej"), ROZSZERZONE NA CAŁĄ APKĘ
   (Faza 3.13, 2026-11-02, user: "wibracje nie działają" — audyt pokazał że
   były wpięte TYLKO w 7 plikach Finansów, nigdzie indziej).** `utils/haptics.ts`
   (port z sapp, uproszczony: zamiast sapp's dużego `appSettings.ts` — lokalny,
   AsyncStorage-cache'owany flag jak `ownName.ts`), JEDEN globalny przełącznik w
   Ustawieniach → Ogólne (zgodnie z zasadą niżej w §Ogólne). Od Fazy 3.13 wpięte
   CENTRALNIE we współdzielone komponenty, nie per-ekran — `Tile`/`Item`
   (`src/ui/layout.tsx`, czyli KAŻDY tap na Dashboard/Daily/Finanse/Zadania),
   `Toggle.tsx` (każdy switch w Ustawieniach), `ChipRow.tsx` (każdy filtr-chip)
   — plus ręcznie domknięte pojedyncze X/zamknij/strzałki w popupach, które nie
   idą przez te komponenty (`MonthViewModal`, `DayDetailModal`, `MoodModal`,
   `WydatkiModal`, `TransactionsModal`, `FoodCategoryItemsModal`, `HabitsModal`,
   `AddTaskCard`, `WeekMonthCalendar`, `NavBar`, `Segmented`). Nowy komponent
   dodający Pressable/TouchableOpacity powinien iść PRZEZ `Tile`/`Item`/`Toggle`/
   `ChipRow` gdy pasuje, zamiast dopisywać własny `haptic.tap()` ręcznie — to
   jedyny sposób żeby to się nie rozjechało znowu.
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
  `bankIngest.ts`'s `tx.selfTransfer` oznacza kolejkową pozycję tagiem
  `'przelew własny'` + `flagReason` sugerującym "rozważ ręczne wyłączenie z
  sum" — DOTĄD był to dead-end (sugestia bez sposobu jej zrealizować,
  `fixedVariable.ts`'s `FvBucket` miał tylko `fixed`/`variable`/`food`).
  ZAMKNIĘTE 2026-11-08 (user: "opcje przelewu własnego ktory nie wlicza się
  do liczenia stałych zmiennych i jedzenia") — `FvOverride = FvBucket |
  'transfer'` (OSOBNY typ od `FvBucket`, nie czwarty liczbowy kubeł —
  `fvSplitOf` traktuje `'transfer'` jako zero wkładu do wszystkich trzech),
  piąty chip "Przelew własny" w `AddExpenseModal`'s "Rozlicz jako". `bank-
  review.tsx` ŚWIADOMIE bez własnej kopii tego chipa (fv-klasyfikacja żyje
  WYŁĄCZNIE w `AddExpenseModal`, ten sam podział odpowiedzialności co reszta
  appki) — user realizuje sugestię z `flagReason` PO zaakceptowaniu, edytując
  wydatek normalnie.
- **Toasty — brak** (sapp2 nie ma jeszcze systemu toastów, żaden inny ekran go nie
  używa) — znikająca kolejka + log diagnostyczny w Ustawieniach (reużyty istniejący
  `append()`) to dotychczasowy sposób dawania feedbacku w tej appce.

**NEXT_STEPS.md** ma pełną listę "do przetestowania na urządzeniu" — to JEDYNA
funkcja w tej rundzie sesji wymagająca prawdziwego urządzenia + prawdziwego
powiadomienia z banku do realnej weryfikacji (CI/`tsc`/`jest`/`expo export` sprawdzają
tylko że kod się kompiluje i plugin generuje poprawny natywny kod — nie że nasłuch
faktycznie łapie powiadomienia na danym telefonie/OEM).

### Udostępnianie paragonu przez Android Share Sheet (2026-11-09)

CLAUDE.md's zasada #5 ("Brak OCR paragonów. Tylko parser tekstu (share-intent z
Lidl+: Select All → Share)") była założona od początku projektu, ale nigdy nie
zbudowana — tylko ręczne wklejanie (FAB "wklej ze schowka"/pole w
`AddExpenseModal`) istniało dotąd. Port z sapp (`plugins/withReceiptShareIntent.js`/
`services/shareTextDrain.ts`), ten sam plik-jako-most wzorzec co powiadomienia z
banku wyżej, ADAPTOWANY bo sapp2 nie ma osobnego ekranu `scan.tsx` — `AddExpenseModal`
żyje lokalnie w `(tabs)/finances.tsx`.

**Mechanizm**: natywna `ShareReceiverActivity` (`android.intent.action.SEND`,
`text/plain`, `Theme.NoDisplay` — nigdy nie renderuje nic) łapie Android Share Sheet,
zapisuje tekst do `shared_receipt_text.json` w `filesDir` i przekierowuje przez
`sapp2://finances` (deep link, `Intent.FLAG_ACTIVITY_NEW_TASK`). JS strona:
`services/shareTextDrain.ts` czyta/czyści ten plik, wołane przez NOWY
`hooks/useShareReceiptLaunch.ts` (zamontowany raz w `app/_layout.tsx`) na TRZECH
triggerach — mount (cold start, timeout 1500ms, ten sam wzorzec co
`drainBankNotifications`), `AppState` 'active' (powrót z tła), i dodatkowo `Linking`'s
'url' event. Ten trzeci trigger nie ma odpowiednika w bank-notification drenażu i jest
tu potrzebny: `finances.tsx` MOŻE już być zamontowany (user na innej zakładce) gdy
przychodzi share, więc appka zostaje 'active' przez cały czas (Android dostarcza nowy
Intent do już istniejącego taska) — sam `AppState` by to przegapił.

Drenaż ląduje w nowym, efemerycznym `store/shareReceiptStore.ts` (`pendingText`, bez
`persist`) — mostek między `app/_layout.tsx` (gdzie żyje drenaż) i `(tabs)/finances.tsx`
(gdzie żyje `AddExpenseModal`/`setAddOpen`, layout nie ma do nich dostępu).
`finances.tsx` subskrybuje, otwiera modal automatycznie i przekazuje tekst jako nowy
`AddExpenseModal`'s prop `initialPasteText` (+ `onInitialPasteTextConsumed`, czyści
store po skonsumowaniu — inaczej ten sam tekst sparsowałby się znowu przy następnym
otwarciu modala). W modalu parsuje się OD RAZU, bez banera do potwierdzenia jak
`clipboardSuggestion` (auto-wykrywanie schowka, Faza 2.2/Runda 13) — "Udostępnij" to
już wyraźna, celowa akcja usera, nie zgadywanie.

**DO POTWIERDZENIA NA URZĄDZENIU** (jedyny sposób, `react-native-web`/Playwright nie
ma Android Share Sheet): cały przepływ "Udostępnij" z innej appki (np. zaznaczony
tekst SMS-a z banku, albo "Select All → Share" z appki Lidl Plus) → sapp2 otwiera
Finanse z wypełnionym/sparsowanym formularzem — w szczególności trzeci trigger
(`Linking` 'url' przy appce już aktywnej na innej zakładce).

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

### Kategoria "Herbaty i napary" + równoległy system kategorii NIE-jedzeniowych (2026-11-10)

User: "daj możliwość dodania właśnie tych herbat i naparów i może higiena,
bo chemia to chyba bardziej taka... kapsułki i tak dalej", doprecyzowane
przez `AskUserQuestion`: "Higiena to NIE jedzenie — chciałem osobny system
kategorii dla pozycji NIE-jedzeniowych (zostają w Zmiennych, ale z własną
etykietą/rozbiciem jak Jedzenie ma)".

- **"Herbaty i napary"** — zwykły nowy wpis w `food.ts`'s `FOOD_SUBCATS`
  (po "Napoje"), zero nowej architektury.
- **`utils/nonFood.ts`** (nowy plik) — `NON_FOOD_SUBCATS` (Higiena, Chemia)
  + `nonFoodByCategory(expenses, monthKey?)`, oparte o nowe pole
  `ReceiptItem.nonFoodCategory?: string` (`types/finances.ts`). Świadomie
  OSOBNY plik/pole, nie wskrzeszenie starego, usuniętego w sapp2 systemu
  `ExpenseCategory` (patrz wyżej w tym pliku, §Parser paragonów — sapp2
  celowo porzucił sapp's słownikowy system nie-jedzeniowych kategorii na
  poziomie pozycji paragonu). `nonFoodByCategory` zwraca DOKŁADNIE ten sam
  kształt co `foodStats.ts`'s `foodByCategory` (`FoodCategoryBar`/
  `FoodCategoryItem`) — strukturalna kompatybilność pozwoliła **reużyć bez
  zmian** `FoodCategoryItemsModal` (drill-down) i `selectedCategory`'s stan
  w `WydatkiModal.tsx`, zamiast budować drugi, równoległy modal.
- **Wzajemne wykluczanie na poziomie pozycji**: `foodSubcat` i
  `nonFoodCategory` nigdy nie współistnieją na jednej `ReceiptItem` —
  `ReceiptItemRow.tsx`'s picker czyści jedno przy wyborze drugiego. Pozycje
  nie-jedzeniowe NADAL liczą się w 100% do Zmiennych (`fvSplitOf`/
  `isFoodItem` nieświadome `nonFoodCategory` w ogóle — user: "zostają w
  Zmiennych").
- **UI**: `ReceiptItemRow.tsx`'s tag picker (ScrollView poziomy) — po 20
  chipach jedzeniowych pionowy separator, potem Higiena/Chemia.
  `VariableBreakdownCard.tsx` (zakładka Zmienne, popup Wydatki) — nowa
  sekcja "Higiena i chemia" (kolorowe paski, tap → drill-down), między "Co
  najbardziej przeważyło" a "Wszystkie transakcje".

### Kategorie CAŁEGO wydatku — Rozrywka/Transport/Zdrowie/Ubrania/Dom (2026-11-10)

User, zaraz po powyższej rundzie: "zróbmy tak, że te kategorie jedzenie to
jest jedno... i zróbmy to drugie, właśnie to nie jedzenie, i tam też
zróbmy podział na kategorie... żeby były na przykład rozrywka i tak
dalej". `AskUserQuestion` ustaliło: w przeciwieństwie do Higieny/Chemii
(pozycja paragonu), Rozrywka/Transport/itp. nie mają co rozbijać na
produkty (bilet do kina, Uber, fryzjer) — kategoria żyje więc na poziomie
CAŁEGO wydatku.

- **`Expense.expenseCategory?: string`** (`types/finances.ts`) —
  RÓWNOLEGŁE do `ReceiptItem.foodSubcat`/`nonFoodCategory`, ale na innym
  poziomie (cały wydatek, nie pozycja). Nie wpływa na `fvSplitOf` — czysta
  etykieta.
- **`utils/expenseCategory.ts`** — `EXPENSE_CATEGORIES` (Rozrywka,
  Transport, Zdrowie, Ubrania, Dom) + `expenseCategoryByCategory`, TRZECI
  (po Jedzeniu, Higienie/Chemii) konsument kształtu `FoodCategoryBar` →
  reużywa ten sam `FoodCategoryItemsModal`/`selectedCategory` w
  `WydatkiModal.tsx`. Liczy WKŁAD do Zmiennych (`fvSplitOf(e).variable`),
  nie goła `e.amount` — wydatek oznaczony jako Stałe/Przelew z ustawioną
  kategorią nie nabrzmia sumy. `fixedVariable.ts`'s `labelFor`
  wyeksportowana (była prywatna) do reużycia zamiast duplikacji.
- **`AddExpenseModal.tsx`** — nowa zwinięta-domyślnie sekcja "Kategoria"
  (wzorzec identyczny jak "Rozlicz jako"/"Zapłacono"), NIEZALEŻNA od
  "Rozlicz jako" (ten decyduje kubeł Stałe/Zmienne/Jedzenie/Przelew, to
  pole tylko etykietuje W RAMACH Zmiennych).
- **`VariableBreakdownCard.tsx`** — sekcja "Inne kategorie", pod "Higiena
  i chemia".

### Ostrzeżenie o duplikacie przy ręcznym dodaniu wydatku (2026-11-11)

User, ze zrzutem Transakcji z dwoma wierszami "Lidl −48.84 zł" tego samego
dnia: "jak dodałem z opóźnieniem paragon to mi nie złapało że to ta sama
suma pieniążków i dzień, i przez to mi się zdublowało". Jeden wpis już był
w historii (np. złapany powiadomieniem z banku), drugi powstał gdy user
ręcznie wkleił ten sam paragon PÓŹNIEJ — zero sprawdzenia przy zapisie.

- **`utils/duplicateExpense.ts`'s `findPossibleDuplicate`** — ODWROTNY
  kierunek niż `bankNotification.ts`'s `findMatchingExpense` (ta dopasowuje
  PRZYCHODZĄCE powiadomienie do wydatku i świadomie POMIJA `bankMatched`,
  bo szuka czegoś do podpięcia). Tu user ręcznie zapisuje NOWY wydatek,
  więc sprawdzamy WSZYSTKIE istniejące (`bankMatched` czy nie) z tą samą
  kwotą/dniem — reużywa `amountMatches`/`sameLocalDay` z
  `bankNotification.ts`, zero duplikacji logiki dopasowania.
- **`AddExpenseModal.tsx`** — pierwszy tap "Zapisz" na NOWYM wydatku (nie
  edycji) tylko WYKRYWA i blokuje zapis, pokazując baner (ten sam wzorzec
  co ProductsModal.tsx's "Możliwe duplikaty"): "Popraw" / "Zapisz mimo to"
  (drugi tap tej samej `handleSave`, `dup.id === duplicateOf?.id` już
  potwierdzony → realny zapis).

**PRACA** [PE] — ZBUDOWANA (2026-11-09), patrz `## PRACA [PE]` niżej, po pełny
opis. **POJAZDY** [PE] — ZBUDOWANA (2026-11-09), patrz `## POJAZDY [PE]`
niżej. **SUBSKRYPCJE / "Stałe opłaty"** [PE] — ZBUDOWANA (2026-11-09), patrz
`## SUBSKRYPCJE / "Stałe opłaty" [PE]` niżej.

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

## PRACA [PE]

Port z sapp (2026-11-09, user: "lecimy z zakładką Praca" → "Pełny port z sapp od
razu"). Satelicki ekran `app/work.tsx`, wejście z Finanse's kafelka "Praca"
(`StatTile`, teraz REALNY — stawka zł/h aktywnego pracodawcy, tap→`/work`).

**Pliki**: `src/types/work.ts` (`Employer`/`ConfirmedMonth`), `src/store/
workStore.ts` (`employers[]`+`activeEmployerId`, AsyncStorage-persist),
`src/utils/workEvents.ts` (parsowanie godzin zmiany z tytułu eventu kalendarza,
`isWorkEvent` kolor-LUB-prefiks), `src/utils/paycheck.ts` (`paycheckTargetMonth`
— "WYPŁATA ZA <miesiąc>" w notatce, fallback: wypłata z dołu = miesiąc przed
datą; `isPaycheck` — przychód z tagiem/notatką pasującą do prefiksu), `src/
utils/workSummary.ts` (`computePayMonths`/`payMonthsSummary`/
`computePayMonthsForEmployers`/`shiftsForEmployerInMonth`), `src/utils/
workRate.ts` (`computeWorkRate` — statyczna stawka zł/h, kolejność pierwszeństwa
niżej).

**Architektura celowo PROSTSZA niż sapp**: `Employer[]` + `activeEmployerId` to
JEDYNE źródło prawdy. sapp ma `Employer` jako warstwę NAD osobnym, mirrorowanym
`WorkSettings` — tam ~17 miejsc (dashboard/bank/osiągnięcia) czyta
`workSettings.workPrefix` BEZPOŚREDNIO, bez pojęcia o liście pracodawców, więc
`workService.setActiveEmployer()` musi zwierciadlić pola aktywnego pracodawcy do
tego osobnego store'a. sapp2 nie ma ŻADNEGO takiego dotychczasowego konsumenta
(Praca nie istniała tu wcześniej) — zero potrzeby na mirrorującą otoczkę,
migrację z legacy, czy `syncActiveEmployerFromSettings`.

**Kolejność pierwszeństwa stawki** (`computeWorkRate`, identyczna jak sapp's
`useWorkEarnings.ts`'s `perSecond`, ale zł/h nie zł/s): 1) `rateOverride` (stałe
nadpisanie) → 2) średnia napędzana realnymi wypłatami (Σwypłata ÷ Σgodziny
kalendarza miesiąca za który jest, po jednej na docelowy miesiąc, pomijając
`excludedPayMonths`) → 3) `confirmedMonths` (Σpensja/Σgodziny po
potwierdzonych, nie-wykluczonych) → 4) `hoursOverride` lub godziny poprzedniego
miesiąca z kalendarza → 5) tryb ręczny: `monthlySalary ÷ hoursPerMonth` wprost.

**Świadomie NIE portowane** (nie przeoczenie, pełne uzasadnienie w
`src/types/work.ts`): `WorkShift` (ręczne zmiany/"clock in-out" bez
kalendarza) i sapp's żywy, sekundowy licznik zarobków (`setInterval` 1Hz,
aktywna zmiana TERAZ, powiadomienia początek/koniec zmiany — sapp's własna
historia: ten licznik kiedyś SAM powodował realny lag przez wymuszone
re-rendery co sekundę). `monthRateOverride` (nadpisanie tylko-na-ten-miesiąc,
rzadki edge case) i `fixedVariable.ts`'s `workFixedProgress` (pasek "zarobki
pokrywają stałe wydatki" na dashboardzie, zależny od żywych zarobków) też
pominięte. Dobudowanie jako osobna, świadoma runda, jeśli faktycznie potrzebne.

**UI**: jeden scroll (nie 2 osobne ekrany jak sapp's Ustawienia→Praca +
work/add.tsx + work/history.tsx — ten sam "jeden ujednolicony" wzorzec co
`AddExpenseModal` scaliło sapp's scan.tsx+manual.tsx) — chipy pracodawców (gdy
>1), nazwa+aktywny/ukryty, tryb (`Segmented` Kalendarz/Ręczny)+prefiks/kolor/
pensja/godziny, zwinięte "Nadpisania", statystyki (stawka/godziny tego
miesiąca/suma), historia wypłat z "Potwierdź"/"Wyklucz ze średniej" (`Toggle`)
per miesiąc.

**Zweryfikowane**: tsc czysty, jest 229/229 (44 nowe testy — `workEvents`/
`paycheck`/`workSummary` porty 1:1 sapp's testów, nowy `workRate.test.ts` dla
wszystkich 8 gałęzi kolejności pierwszeństwa). Wizualnie `expo web`+Playwright.
**DO POTWIERDZENIA NA URZĄDZENIU**: cały przepływ z prawdziwym kalendarzem i
prawdziwymi wypłatami z banku — testy mają tylko fixture'y, zero realnych
danych do zweryfikowania parsera tytułów zmian tutaj.

## POJAZDY [PE]

Port z sapp, ULEPSZONY (2026-11-09, user: "zależy mi na monitoringu jak w sapp
tylko lepszym"). Satelicki ekran `app/vehicles.tsx`, wejście z Finanse's
"Jedzenie · kategorie" tile (link "Pojazdy" obok już istniejącego "Produkty").

**Pliki**: `src/types/vehicles.ts` (`Vehicle`/`FuelLog`/`OdometerReading`/
`VehicleMaintenance`), `src/store/vehiclesStore.ts` (`vehicles[]`,
AsyncStorage-persist), `src/utils/vehicleMatch.ts` (dopasowanie wydatek↔pojazd
+ statystyki, port z sapp), `src/services/vehicleFuelLog.ts` (tworzy
powiązany, otagowany `Expense` przy każdym "Zatankuj").

**Dopasowanie wydatku do pojazdu** (`expenseMatchesVehicle`, bez
`Expense.vehicleId` jak sapp — sapp2 nie dotyka schematu `Expense`, WYŁĄCZNIE
przez `Expense.tags`/prefiks `#tag`/`[T]` w notatce, już w pełni obsługiwane
przez istniejące pole Tagi w `AddExpenseModal`): tag pojazdu na wydatku, LUB
(tylko dla wyznaczonego `isMainCar`) wydatek "wygląda jak paliwo"
(`looksLikeFuel` — tag/sklep/notatka).

**ULEPSZENIE względem sapp (nie tylko port)**: sapp trzyma `OdometerReading`
({date,km}) ZUPEŁNIE osobno od wydatków na paliwo — nie wie ile litrów wlano
przy którym przebiegu. Nowy `FuelLog` zapisuje przebieg+typ paliwa+litry+
kwotę RAZEM, jednym "Zatankuj" (`services/vehicleFuelLog.ts`'s
`logFuelFillUp`) — tworzy prawdziwy `Expense` otagowany tagiem pojazdu (+
"paliwo"), więc wpada w ISTNIEJĄCE agregaty Finansów (saldo, Stałe/Zmienne,
Ostatnie transakcje) za darmo. Odblokowuje FUNKCJE NIEMOŻLIWE W SAPP:
`avgFuelConsumption` (L/100km między kolejnymi tankowaniami TEGO SAMEGO typu
paliwa — istotne dla pojazdów dwupaliwowych, np. LPG+benzyna) i
`currentOdometer` (max km z `fuelLog`+samodzielnego `odometerLog` razem).

**"Kreator pojazdu"**: progresywne ujawnianie pól w JEDNYM formularzu wg
`kind` (ten sam wzorzec co `AddExpenseModal`), nie osobny wielostronicowy
wizard — sekcje "Co pije" (`FuelType[]`, wielokrotny wybór) i "Główny
samochód" renderują się TYLKO dla `vehicleHasFuel(kind)` (car/motorcycle/
scooter), znikają całkiem dla roweru/innego. Tag auto-sugerowany ze
slugified nazwy (`#rower`-styl), edytowalny.

**Port z sapp bez zmian** (`src/utils/vehicleMatch.ts`): `summarizeVehicle`
(total/paliwo/inne/ten-miesiąc), `vehicleYearSummary` (12 mies. vs poprzednie
12 mies., % zmiany), `costPerKm` (pierwszy/ostatni odczyt licznika — teraz
łączy `odometerLog`+`fuelLog`'s przebiegi), `maintenanceDueMonths`/
`maintenanceDueLabel`/`maintenancePresets` (kind-aware: rower → "Smarowanie
łańcucha", auto → "Klocki hamulcowe"/"Przegląd techniczny").

**Świadomie NIE portowane**: `Expense.vehicleId` (ręczne, wyłączne
przypisanie — tag wystarcza, zero nowego UI), `tireSeason` (przypomnienie o
sezonowej wymianie opon — mniejsza, osobna funkcja, do dobudowania później).

**Zweryfikowane**: tsc czysty, jest 266/266 (37 nowych testów
`vehicleMatch.test.ts` — porty 1:1 sapp's testów + nowe dla
`currentOdometer`/`avgFuelConsumption`). Wizualnie `expo web`+Playwright, w
tym pełny przepływ "Zatankuj" end-to-end (formularz→zapis→Statystyki się
realnie zaktualizowały→wpis w historii z usuwaniem). **DO POTWIERDZENIA NA
URZĄDZENIU**: realny wygląd/dotyk na telefonie.

**Kafel "Praca" w Finansach** (2026-11-11): `src/utils/workMonth.ts`'s
`workMonthProgress(emp, events, expenses, now)` → `{ rate, hoursDone,
hoursPlanned, nextPay: {month, amount} }`. Godziny = zmiany TEGO miesiąca z
kalendarza (minione w całości, trwająca częściowo) z ilu zaplanowanych.
`nextPay` = najbliższa NIEZAKSIĘGOWANA wypłata: za poprzedni miesiąc, gdy jego
wypłaty jeszcze nie ma w historii (i jakiekolwiek wypłaty są księgowane), inaczej
prognoza za bieżący (zaplanowane godziny × stawka). Stawka zawsze z
`computeWorkRate` — jedna definicja. Tryb ręczny: godziny null, wypłata = pensja.

**Szablony sklepów** (2026-11-11, user: "klikam utwórz szablon i pisze szablon
utworzony. Nawet nic nie wypełniłem"): "szablon" = sklep na automacie w
`merchantMemory` (kolejna płatność z tym storeKey księguje się sama z jego
tagami). Tworzenie/edycja/usuwanie ZAWSZE przez
`src/components/finances/MerchantTemplateSheet.tsx` (wyjaśnienie + tagi z
podpowiedziami z własnych wydatków) — używany w `app/bank-history.tsx` (karta
"Szablony sklepów" z listą + przycisk przy pozycji) i `app/bank-review.tsx`.
Nie wracać do cichego jednego tapu.

**Paragon ↔ płatność z banku — bez dubli** (2026-11-12): dwa kierunki, jedna
zasada "ta sama kwota + ten sam dzień (+ sklep) = ten sam zakup".
- Paragon PO powiadomieniu: `AddExpenseModal.handleSave` → `findReceiptTarget`
  (utils/duplicateExpense.ts); `isConfidentReceiptMatch` (wpis z banku, bez
  paragonu, ten sam sklep) → `mergeReceiptInto` po cichu (pozycje/sklep/tagi z
  paragonu, DATA z godziną z banku zostaje); niepewne → baner "Połącz"/"Zapisz
  osobno".
- Paragon PRZED powiadomieniem: `bankNotification.ts`'s `findExpenseForBankTx`
  — JEDNA funkcja dla `commitBankTx` i podglądu w bank-review ("Już jest w
  wydatkach… — Połącz"). `amountMatches` liczy też pełną sumę pozycji paragonu
  (z wykluczonymi), bo to realnie zapłacona kwota.

**Pojazdy — przebudowa "dane, nie konfiguracja"** (2026-11-12, CLAUDE.md zasada
10): `app/vehicles.tsx` = karta z liczbami (`vehicleMatch.ts`'s `vehicleStats`:
przebieg, km w mies., km/mies., spalanie l/100 głównego paliwa, zł/l z 3
ostatnich, zł/100 km, ten miesiąc + 12 mies.), "Tankowania do uzupełnienia"
(`unlinkedFuelExpenses` — wydatki na paliwo bez FuelLog, np. Orlen z banku),
akcje Zatankuj/Licznik/Serwis (sheety), historia tankowań z odcinkowym
spalaniem. Konfiguracja (nazwa/kolor/rodzaj/paliwo/tag/główny/usuń) → sheet
"Edytuj". Formularz tankowania = `src/components/vehicles/FuelSheet.tsx`, też w
`AddExpenseModal` (edycja wydatku paliwowego → "uzupełnij litry i przebieg").
Podpięcie do istniejącego wydatku: `logFuelForExistingExpense` (FuelLog
`linkedExisting:true` — usunięcie tankowania NIE kasuje wydatku z banku).

**Pogoda** (2026-11-13, Dashboard — ZAMIAST snu, sen jest w Daily): Open-Meteo
bez klucza. `utils/weather.ts` (czyste: parseWeather, weatherCodeInfo PL+ikona,
aqiInfo EAQI, rainSummary, weatherTip; testy na fixture `__tests__/fixtures/
openmeteo-*.json`), `services/weather.ts` (fetchWeather prognoza+powietrze,
searchCity geokodowanie), `store/weatherStore.ts` (lokalizacja gps|city + cache),
`hooks/useWeather.ts` (odświeżanie >30 min / powrót z tła; GPS przez expo-location,
uprawnienie ACCESS_COARSE_LOCATION w app.json), `components/weather/
WeatherSheet.tsx` (teraz, 24 h, 7 dni, powietrze z normami WHO, zmiana lokalizacji).

**Daily** (2026-11-13): Sen (kompaktowo, `utils/sleepStats.ts`, szczegóły w
`components/health/SleepSheet.tsx` + `Hypnogram.tsx`), Plan dnia (`utils/dayPlan.ts`:
wydarzenia z wybranych tagów `[UR]`/`[JD]` + zadania z `scheduledDate`/deadline na
dzień, skrót jutra; tagi w `store/dayPlanStore.ts`, wybór w `components/daily/
DayPlanTagsSheet.tsx`), Kroki (`components/health/BodySheet.tsx`: waga ręczna w
`healthStore.manualWeights`, tętno, woda), Humor (kropki 7 dni). Health Connect:
`healthStore.history` (30 dni), `useHealthSync` dociąga 6 dni wstecz; test
wszystkich typów: `app/health-debug.tsx` (Ustawienia → Połączenia).

**Synchronizacja między urządzeniami** (2026-11-13, user: telefon + komputer +
zegarek, "ma działać smooth"): local-first. `services/cloudSync.ts` — dla każdej
kolekcji (`sync_tasks`, `sync_events`, `sync_mood` w `users/{uid}/`): po
zalogowaniu i wczytaniu store'ów scalenie z chmurą (`utils/syncMerge.ts`'s
planInitialMerge — wygrywa nowsza zmiana: lokalnie `updatedAt`, w chmurze `_u`),
potem zustand subscribe → diff (odłożony 300 ms) → writeBatch, i onSnapshot →
zmiany z innych urządzeń prosto do store'a. Usunięcia = dokument `{_deleted:true}`
+ lokalna lista `sync-deletes-v1` (offline). Store'y stemplują `updatedAt` w
update*. Status: `useSyncStatus` (Ustawienia → Dane). Następne kolekcje (wydatki,
stałe opłaty…) = dopisać Binding w `bindings`. gcalEvents NIE są synchronizowane
(każde urządzenie czyta Google Calendar samo).

**Wersja na komputer (PWA)** (2026-11-13): ten sam kod na web →
`.github/workflows/web.yml` (expo export web + `scripts/pwa-postbuild.js`: manifest,
service worker `public/sw.js`, 404.html dla podstron) → GitHub Pages
https://sokkieltanin.github.io/sapp2/ (`experiments.baseUrl: "/sapp2"`). Logowanie na
web: `signInWithPopup` (googleAuth.ts); atrapa usera tylko `web && __DEV__`. Na web
appka w wyśrodkowanej kolumnie `WEB_MAX_W` (ui/layout.tsx's `useAppWidth`, root w
app/_layout.tsx, AppBottomSheet maxWidth). Natywne rzeczy (bank, Health Connect,
widget, powiadomienia) na web = ciche no-op; dane z nich przychodzą synchronizacją.
UWAGA dev: z baseUrl serwer deweloperski dalej działa pod `localhost:8099/<trasa>`.

## SUBSKRYPCJE / "Stałe opłaty" [PE]

Port z sapp (2026-11-09, user: "czy w sapp mozemy eksportować szablony te do
łapania powiadomien i stałych? Zeby przeniesc je do sapp2? I wtedy w kafelku w
stałych opłatach zaznaczyć kiedy co musimy opłacić"). Satelicki ekran
`app/subscriptions.tsx`, wejście z Finanse's "Najbliższa opłata" `StatTile`
(teraz REALNA, wcześniej na zawsze `value={null}` — appka nie miała store'a
"bills" w ogóle) i z Dashboard's "Najbliższe eventy" listy (nowe `kind:'bill'`
wpisy — ten wariant JUŻ istniał w `DashData.upcoming`/`DashboardScreen.tsx`,
zaprojektowany z wyprzedzeniem, nic go dotąd nie zasilało).

**Wykryte z historii** (2026-11-11, user: "pisze 28 dni do internet nie wiem
skąd" — kafel Finansów pokazywał przewidywany rachunek, a ekran był pusty):
`app/subscriptions.tsx` ma sekcję "WYKRYTE Z HISTORII" (`detectRecurringBills`)
z "Dodaj" (prefill formularza: nazwa/ostatnia kwota/przewidziany termin/tag
BILL_TYPES — po zapisie tag pokrywa rachunek, więc znika z wykrytych) i "×"
(odrzuć). Odrzucone tagi: `subscriptionsStore.dismissedBills` (persist, więc też
w backupie), przekazywane jako `dismissed` do `detectRecurringBills`/
`upcomingPayments`/`nextUpcomingPayment` — KAŻDY wołający (Finanse, Dashboard)
musi je podać, inaczej odrzucony rachunek wraca. Kafel Finansów ma podpis
"dni · z historii" dla `kind:'bill'`.

**Pliki**: `src/types/subscriptions.ts` (`Subscription`/`BillingCycle`),
`src/store/subscriptionsStore.ts` (`subscriptions[]`, AsyncStorage-persist, ten
sam wzorzec co workStore/vehiclesStore), `src/utils/recurringBills.ts`
(rozszerzony — poprzednio TYLKO słownik `BILL_TYPES`/`looksLikeBill`/
`billTagFor`, teraz + `advanceNextBillingDate`/`rollOverdueSubscription`/
`isDurationExpired`/`upcomingSubscriptions`/`nextDueSubscription`),
`src/utils/dateMath.ts` (NOWY — `addMonthsClipped`/`addYearsClipped` wydzielone
tu z `vehicleMatch.ts`, bo port Subskrypcji potrzebował tej samej
day-overflow-safe logiki drugi raz; `vehicleMatch.ts` teraz importuje stąd
zamiast mieć własną kopię).

**Co ZMIENIONE vs sapp** (pełne uzasadnienie w `src/types/subscriptions.ts`):
`category: ExpenseCategory` i `currency` USUNIĘTE z `Subscription` — sapp2 nie
ma systemu kategorii (tylko wolne tagi) i jest jednowalutowe na poziomie
subskrypcji. Ikona na liście wynika z `billTagFor` dopasowanego do nazwy/tagów/
notatki, nie z osobnego pola kategorii.

**Świadomie NIE portowane** (osobny, dużo większy temat na przyszłość — pełne
uzasadnienie w `src/types/subscriptions.ts`): cała inteligencja auto-
dopasowania płatności do powiadomień bankowych z sapp's `subscriptionAuto.ts`
(`matchSubscriptionForPayment`/`isConfidentSubMatch`/
`subscriptionPriceChanged`/kolejka `PendingSubConfirm` "czy to Twoja
subskrypcja?"/zmiana ceny/martwa subskrypcja z `DEAD_SUB_THRESHOLD`) — głęboko
sprzęgnięte z sapp's bank-notification pipeline, którego sapp2 jeszcze nie ma w
tej formie. `detectRecurringBills` (auto-wykrywanie kandydatów na rachunek z
historii wydatków) **DOŁĄCZONE 2026-11-09** (user: "ta ostatnia platnosc
najbliższą ma być automatyczna po stałych i subskrypcjach łapać... ma
przewidywać stałe kiedy są") — patrz `upcomingPayments` niżej po pełny opis;
dashboard-suggest banner + dismiss-list ("czy to Twój rachunek, dodać jako
Subskrypcję?") WCIĄŻ nie portowane — `detectRecurringBills` tu zasila TYLKO
przewidywanie terminu, nie proponuje nic userowi do zatwierdzenia. Realne
lokalne powiadomienia-przypomnienia (`reminderDaysBefore` faktycznie
planujące push) NIE wpięte —
pole jest zapisywane/eksportowalne, ale nic jeszcze go nie planuje jako
notyfikację. `missedCycles` zostaje jako czyste dane (liczone przy
`rollOverdueSubscription`), bez żadnego UI "martwa subskrypcja" w v1.

**Auto-roll** (jak sapp): przy wejściu na ekran appka CICHO (bez pytania usera
— ten sam wybór co sapp, dopytywanie "czy opłaciłeś?" było uciążliwe)
wyłącza subskrypcje z wygasłym `durationMonths` i przesuwa zaległe
`nextBillingDate` w przyszłość o tyle cykli, ile potrzeba.

**Dashboard "Stałe opłaty" w "Najbliższych eventach"**: tylko płatności z
terminem w ciągu 14 dni (`BILL_WINDOW_DAYS`, `app/(tabs)/index.tsx`) — w
przeciwieństwie do eventów/terminów (bez limitu czasowego, user: "zamieniamy na
najbliższe eventy po prostu i tyle bez ograniczenia"), subskrypcja/rachunek
płatny raz w roku zaśmiecałby listę miesiącami z wyprzedzeniem.

**`upcomingPayments`/`nextUpcomingPayment` (2026-11-09)** — łączą realne
Subskrypcje (`upcomingSubscriptions`) z PRZEWIDYWANYMI terminami rachunków
stałych wykrytych przez `detectRecurringBills`+`nextBillingDate` (rachunek
rozpoznany `billTagFor` w ≥2 odrębnych miesiącach, przewidywany dzień = z
ostatniego wystąpienia) w jedną, posortowaną listę — zasilają Finanse's
"Najbliższa opłata" i Dashboard's "Stałe opłaty". `upcomingSubscriptions`/
`nextDueSubscription` ZOSTAJĄ (używane WEWNĄTRZ tych nowych funkcji, też
nadal eksportowane dla ewentualnych innych konsumentów).

**Eksport szablonów z sapp** — user pytał też o eksport "szablonów do łapania
powiadomień i stałych" z sapp. Odpowiedź: sapp's `backupService.ts`'s
`exportSnapshotToFile()` JUŻ eksportuje `cloud.subscriptions` (i
`cloud.expenseTemplates`) w pełnym snapshocie — `app/import-sapp.tsx`/
`dataImportFromSapp.ts` (Runda wcześniejsza) parsuje TYLKO
`cloud.expenses`/`cloud.mood` z tego pliku. Rozszerzenie `dataImportFromSapp.ts`
o `cloud.subscriptions` (mapowanie na sapp2's uproszczony `Subscription`,
dedup po `sapp_`-prefiksowanym id, ten sam wzorzec) jest NATURALNYM
następnym krokiem, ale ŚWIADOMIE odłożone na kolejną rundę — nie było części
"głównie finanse/paragony/humor" z pierwotnego ASKu o import, i każda sapp's
subskrypcja miałaby `nextBillingDate` z przeszłości wymagające natychmiastowego
auto-rollu przy imporcie (więcej do przemyślenia niż zwykłe 1:1 mapowanie pól).
Szablony "do łapania powiadomień" sensu stricto (sapp's `expenseTemplates`,
bank-notification-matching reguły) pozostają NIE portowane z tego samego
powodu co `subscriptionAuto.ts` wyżej.

**Zweryfikowane**: — (patrz NEXT_STEPS.md po status tsc/jest/wizualny tej
rundy). **DO POTWIERDZENIA NA URZĄDZENIU**: realny dodaj/edytuj/usuń na
telefonie, auto-roll po realnym upływie czasu.

## WYMIANY DOMOWE [PE] (2026-11-13)

User: "ogarnij... wszystko z wymianami, filtrów w dzbanku, do powietrza itp itd i
szczoteczek końcówek". Rzeczy zużywające się co N dni/tyg./mies.

- **Model** `src/types/replacements.ts` (`ReplaceItem`: every+unit, lastDate,
  history, remindDaysBefore, keywords, dismissedBuys). Store
  `src/store/replacementsStore.ts` (`replacements-v1`; `replaced(id, date)`,
  `undo`, `dismissBuy`).
- **Logika** `src/utils/replacements.ts` (testy `__tests__/replacements.test.ts`):
  `REPLACE_PRESETS` (12 szablonów z interwałem, ikoną lucide i słowami z
  paragonu), `replaceDue` (termin, dni, zużycie), `markReplaced`/`undoLastReplace`
  (historia), `findBuys`/`pendingBuy` (pozycje paragonu ze słowami rzeczy, po
  ostatniej wymianie → "wymienione?"), `yearlyCost`, `nextHomeReplacement`.
- **Ekran** `app/replacements.tsx` (wejście: Finanse → przycisk "Wymiany" pod
  Pojazdami): 3 liczby (po terminie / w 7 dni / zł na rok), karty zakupów do
  potwierdzenia, lista od najpilniejszej z paskiem zużycia i ✓ "wymienione dziś",
  "Dodaj szybko" z brakujących szablonów. Formularz/edycja:
  `src/components/replacements/ReplaceSheet.tsx` (szablon, nazwa, co ile,
  ostatnio — szybkie daty/wpis/kalendarz, przypomnienie, słowa, historia + cofnij).
- **Przypomnienia** `utils/replaceReminders.ts` (plan, testy) →
  `services/replaceReminders.ts` (notifee, kanał `replace-reminders-v1`, id
  `repl_<id>`) ← `hooks/useReplaceReminderSync.ts` w `app/_layout.tsx`. 9:00 w
  dniu / N dni przed; po terminie jedno "minął wczoraj". Tap → `/replacements`
  (`useNotifeeAlertLaunch` route `replacements`).
- **Dom + pojazdy razem** (2026-11-13, user: "muszą się pokazywać zwykłe rzeczy,
  ale też te z samochodu — olej za tydzień"): `allReplaceRows(items, vehicles)` —
  serwis pojazdów z interwałem (najnowszy wpis per pozycja, `carMaintItems`) na tej
  samej liście; ✓ dopisuje `addMaintenance` do pojazdu, tap → `/vehicles?id=`.
  Formularz: "Dom / <pojazd>" — dla pojazdu szablony z `maintenancePresets`, zapis
  jako serwis pojazdu (jedno źródło danych). Przypomnienia serwisu: 7 dni przed
  (`carReminderItems`). Szablony domyślnie zwinięte (formularz i ekran).
- **Dashboard** "Najbliższa wymiana": pierwszy wiersz `allReplaceRows` (podpis =
  nazwa pojazdu albo "dom"); `nextMaintenanceDue` z vehicleMatch zostaje tylko w testach. Backup: klucz w kopii automatycznie,
  rehydrate w `services/cloudBackup.ts`.
- Pola dat formularzy: `src/utils/dateInput.ts` (wspólne z Subskrypcjami).

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

- **Wydajność — zasady (2026-11-13, user: "wchodzę w finanse... wszystko się
  odświeża i lekko laguje... żeby nie lagowało jak pierwsza wersja")**:
  - **Zakładki zamrożone poza ekranem** — `freezeOnBlur: true` w
    `app/(tabs)/_layout.tsx`. Zmiana store'a nie przelicza niewidocznych zakładek;
    renderują się raz przy wejściu.
  - **Ciężkie sheety montowane dopiero przy otwarciu** — `<LazyMount visible>`
    (`src/components/design/LazyMount.tsx`; trzyma montaż ~450 ms po zamknięciu,
    żeby animacja zamknięcia zagrała). Dotyczy wszystkiego, co liczy w renderze
    (katalog produktów, statystyki wydatków, sen, pogoda, dzień w kalendarzu).
    Nowy sheet z `useMemo` po expenses/events → owiń w `LazyMount`.
  - **Liczenie po animacji otwarcia** — `useDeferredMemo(compute, deps, initial)`
    (`src/hooks/useDeferredMemo.ts`): duplikaty produktów (`ProductsModal`),
    podpowiedzi nazw (`AddExpenseModal`). Klatki animacji nie czekają na O(n²).
  - `findDuplicateCandidates` (`utils/productCatalog.ts`) liczy normalizację i
    trigramy raz na produkt, nie raz na parę.
  - Tickery: max co 60 s (Dashboard odliczanie), żadnych sekundowych.
- **Widget pulpitu "Pogoda" (2026-11-13, user: "pogodę na ekran główny")** —
  `plugins/withWeatherWidget.js` (natywny Kotlin, wzorzec jak widget Zadań).
  Temp + ikona + opis, max/min, zdanie o deszczu, 5 godzin co 3 h (chowane, gdy
  widget ma 1 rząd wysokości). Dane: `utils/widgetWeather.ts`
  (`buildWeatherWidgetSnapshot`) → `services/widgetSync.ts`'s `syncWeatherWidget`
  przy każdej zmianie `weatherStore.data` (`app/_layout.tsx`) → `widget_weather.json`.
  Gdy appka zamknięta, provider sam pobiera Open-Meteo co ~30 min (Kotlinowy port
  `weatherCodeInfo`/`rainSummary` — zmiana formatu = zmiana w OBU miejscach).
  Wygląd wspólny z Zadaniami (`TasksWidgetPrefs`). Tap → `sapp2://weather` →
  `app/weather.tsx` → Dashboard `?weather=1` → WeatherSheet. Ikony = wektory z
  lucide wpisane do pluginu (test pilnuje, że każda ikona z `weatherCodeInfo` ma drawable).
- **Sheety szczegółów = kafelki (2026-11-13, user: "podziel to na kafelki...
  zrób legendę, bo nie wiem o co chodzi z paskami")** — `SheetCard` + `Legend`
  (`src/components/design/SheetCard.tsx`): każdy temat w osobnej karcie `ui.in`,
  legenda w nagłówku karty, max 1 linia objaśnienia pod wykresem. Użyte w
  `WeatherSheet` (teraz / mini-kafle / 24 h deszcz+chmury / 7 dni / powietrze /
  radar) i `SleepSheet` (czas / mini-kafle / przebieg / fazy / 7 nocy). Nowy
  wykres w sheecie → karta + legenda. Radar = link do RainViewer (zewnętrznie;
  mapa w WebView byłaby ciężka). Pogoda pobiera też `cloud_cover` →
  `cloudSummary()` w `utils/weather.ts`.

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
