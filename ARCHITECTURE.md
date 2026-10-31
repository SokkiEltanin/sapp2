# ARCHITECTURE.md — sapp2

Mapa ekranów i połączeń między nimi. Rozpisana przez usera (2026-10-26), zapisana tu
żeby się nie zgubiła między sesjami. Aktualizuj przy każdej decyzji o nowym
ekranie/połączeniu (patrz `CLAUDE.md`).

**Stan budowy** (2026-10-30): Dashboard w pełni zbudowany (monochromatyczny redesign,
patrz NEXT_STEPS.md). **Zadania ma teraz realne UI** (kalendarz tydzień↔miesiąc +
CRUD listy, offline-first przez `calendarStore`, patrz sekcja ZADANIA niżej) —
widget na pulpit JESZCZE NIE zrobiony. Daily/Finanse wciąż mają **lekki szkielet
struktury** (layout, sekcje, nagłówki — bez głębokiej logiki) — kolejność faz:
Zadania UI (zrobione) → widget → Finanse+parsery → Praca/Daily. Pupil — wciąż tylko
placeholder, bo jego mechanika ("roślinka") jest dopiero pomysłem do zaprojektowania,
nie ma jeszcze struktury do zeszkieletowania.

Oznaczenia głębokości nawigacji:
- **GE** — Główny Ekran (jeden z 5 w navbarze)
- **PE** — Pod Ekran (`>`, jeden poziom głębiej)
- **PPE** — Pod Pod Ekran (`>>`, dwa poziomy głębiej)

## DASHBOARD [GE]

Kliknięcie w kafelek przenosi na powiązaną zakładkę GE z kontekstem, np. kafelek SEN →
`DAILY`, od razu pokazując sen z dziś + historię + średnią. Edycja danych (dopisanie
wody/snu ręcznie itp.) — **odłożone**, na razie budujemy same ekrany/nawigację.

**NIEprzewijalny, celowo** (user: "mieliśmy robić nieskrollowalny ekran żeby nie było
chaosu") — zawsze dokładnie 4 stałe rzędy (`getTilePosition`), nic więcej. Kafel
"22,4 PLN DZIENNIE #JEDZENIE" (rząd 4) jest tappable (`StatTile`'owy `onPress`) i
otwiera `WydatkiModal.tsx` — pełnoekranowy popup z WŁASNYM scrollem, zawierający
`FoodBreakdownCard.tsx` (szkielet przyszłego widoku "rozkład wydatków na jedzenie",
mock dane, czeka na parser paragonów, Faza 2 — patrz NEXT_STEPS.md). Szczegółowa
treść żyje w popupach, NIGDY na stałe na samym Dashboardzie — jeśli coś nowego nie
mieści się w 4 rzędach, idzie do osobnego modala, nie wydłuża głównego ekranu.

## DAILY [GE]

Obszerna zakładka, popupy zależnie od klikniętego kafelka. Obejmuje:
- **ZDROWIE** (woda)
- **JEDZENIE** — *user: "nie sprawdzała się w SAPP"* — zostawiamy potencjał/miejsce,
  **NIE dodajemy jej teraz**.
- **ĆWICZENIA** — superważne, do dopracowania, powiązane z roślinką (Pupil).
- **KROKI** — z zegarka.
- **WAGA**
- **HUMOR**

## ZADANIA [GE]

**UI zbudowane (2026-10-30, Faza 1b)** — `app/(tabs)/tasks.tsx` + 3 komponenty w
`src/components/tasks/`:
- `WeekMonthCalendar.tsx` — kalendarz domyślnie **tygodniowy** (zawsze bieżący
  Pon-Nd) → tap na nagłówek karty rozwija do **widoku miesięcznego** (pełna siatka,
  nawigacja strzałkami + skrót "Dziś"). Kropka pod dniem = ma wydarzenie
  (`eventCoversDay`, obsługuje wielodniowe). Czyta `events`+`gcalEvents` z
  `calendarStore`. Zaznaczenie dnia (`selectedDate`) jest na razie czysto
  wizualne/nawigacyjne, NIE filtruje listy zadań niżej (dwa osobne widoki tego
  samego ekranu, nie master-detail).
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
- **Parser tekstu** (`receiptParser.ts`, 1319 linii w sapp) — **PORTOWAĆ 1:1**,
  battle-tested na prawdziwych polskich paragonach (Biedronka/Lidl/Kaufland + generic
  fallback), obsługuje rabaty/kaucje/VAT/wagę/skróty nazw. Zero sensu przepisywać od
  zera. UI do wklejania — nowy, w stylu sapp2 (nie kopiujemy wyglądu `scan.tsx`).
- **Dodawanie ręczne, pozycja po pozycji** — user: "ewentualnie dodać" — osobny tryb
  (jak sapp's `manual.tsx`), ale w sapp2 to JEDEN współdzielony ekran edycji listy
  produktów (nie dwa osobne jak w sapp) — różni się tylko punkt startowy (pusta lista
  vs sparsowana).
- **Podpowiadanie produktu po nazwie** (user: "wpisuję nazwę... sugeruje... klikam,
  cena się uzupełnia") = `productMemory.ts` — **PORTOWAĆ 1:1**: fuzzy-match przez
  trigramowe podobieństwo Dice'a (próg auto-dopasowania `0.60`), 5 niezależnych
  "pamięci" (kategoria/tag/subtag/waga/anomalia ceny) uczących się TYLKO z korekt
  usera. `suggestSimilarName()` (pasmo `0.45–0.60`) = dokładnie "czy to jest to?"
  sugestia-nie-auto-zastosowanie z opisu usera. Plus `BRAND_CANON`
  (kanonizacja nazw marek) i `STORE_LABELS` (prywatne marki sklepów → kategoria
  jedzeniowa).
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

### Edycja produktów (user: "jak złapie źle... wejść w produkty i edytować, ale
dużo ładniej zrobione niż w SAPie")
- Logika = `productMemory.ts` (jak wyżej) + grupowanie (`productGroupKey`/
  `productGroupLabel` — grupuje "Serek wiejski lekki"/"Serek wiejski Pilos" pod
  wspólny nagłówek "Serek"). **PORTOWAĆ logikę**, ale UI **NAPISAĆ OD ZERA** — sapp's
  `app/products.tsx` to płaski ekran z wyśrodkowanym, ciasnym modalem (czyste
  siatki chipów, zero hierarchii wizualnej) — user to explicite nazwał za
  skromnym. sapp2: karty-wiersze (jak `TaskRow`), pełnoekranowy edytor albo bottom
  sheet zamiast ciasnego centered-modala, czytelne grupowanie.
- Wykrywanie duplikatów (pasmo podobieństwa `0.45–0.60`, jak `suggestSimilarName`)
  — osobny krok "połącz/odrzuć" z opcją cofnięcia, ten sam mechanizm co w sapp,
  wizualnie dociągnięty.
- To PRZESĄDZA starą notatkę "POJAZDY / PRODUKTY — odłożone na koniec" — PRODUKTY
  wchodzą TERAZ (explicit ask usera), POJAZDY zostają odłożone (nieporuszone w tej
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

### Model danych
- `src/types/finances.ts` (nowy) — port `Expense`/`ReceiptItem` z sapp
  (`src/types/index.ts`), BEZ pól które sapp2 jeszcze nie potrzebuje
  (`vehicleId`/`reimbursedAmount`/`reimbursedFromId` — Pojazdy i zwroty wciąż poza
  zakresem, dodamy pola gdy/jeśli te funkcje realnie powstaną, nie wcześniej).
- `src/store/expensesStore.ts` (nowy, Zustand) — ten sam wzorzec co
  `calendarStore.ts`: offline-first AsyncStorage, Firestore sync jako osobna,
  ręczna warstwa (serwis), NIE auto-sync przy każdym CRUD (ta sama, już ustalona
  zasada co w Zadaniach — patrz §ZADANIA).

### Kolejność budowy (proponowana, do potwierdzenia z userem)
1. **Fundament danych** — typy + `fixedVariable.ts`/`food.ts`/`recurringBills.ts`/
   `productMemory.ts`/`merchantMemory.ts` portowane jako czysta logika (zero UI),
   `expensesStore.ts`.
2. **Parser + ręczne dodawanie** — wspólny ekran edycji listy pozycji (paste-parse
   LUB pozycja-po-pozycji), zapis jako `Expense`.
3. **Edycja produktów** — nowy, ładniejszy ekran (katalog + fuzzy-sugestie przy
   wpisywaniu, wykrywanie duplikatów).
4. **Przebudowa ekranu Finanse** — kafel salda, kafel "4 ostatnie" + pełny popup,
   popup Stałe/Zmienne/Jedzenie (Jedzenie = pierwszy realny konsument
   `FoodBreakdownCard`), FAB "dodaj".
5. **Powiadomienia z banku** — natywny listener + parser + szablony + kolejka +
   zaufanie/auto-akceptacja. Najbardziej ryzykowny, natywny kawałek — celowo na
   końcu, gdy reszta modelu danych/UI jest już sprawdzona.
6. **Wibracje** (user: "zrób te wibracje") — port `utils/haptics.ts`, wpięte w
   nowe interakcje Finansów (toggle taga, zatwierdź, połącz duplikat) — zgodnie z
   już ustaloną zasadą w `ARCHITECTURE.md` §Ogólne ("NIE osobny przełącznik w UI,
   wyciszamy per-ekran w kodzie jeśli trzeba").

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

## PUPIL / ROŚLINKA [GE]

Nazwa do wymyślenia. Mechanika do zaprojektowania od zera (patrz `NEXT_STEPS.md` —
pomysł "roślinka zamiast bossów"), w tym **tryb focus**: aktywne pomodoro do zadania →
roślinka rośnie szybciej. Do przemyślenia/przedyskutowania jak połączyć z systemem
powiadomień (patrz niżej).

## Ogólne do appki (cross-cutting)

- **Wibracje** — globalny toggle w Ustawieniach (moja rekomendacja: NIE per-ekran, patrz
  rozmowa z 2026-10-26 — jeśli jakiś ekran okaże się zbyt "wibrujący", wyciszamy to w
  kodzie tego ekranu, nie dodajemy osobnego przełącznika w UI).
- **Powiadomienia** — do zaprojektowania: zwykłe vs. "ciekawsze" typy (full-screen
  przypomnienie blokujące do odhaczenia, jak budzik) + integracja z trybem focus
  Pupila/roślinki. Patrz rozmowa 2026-10-26 w historii sesji po szczegóły wykonalności
  (Android full-screen intent — wymaga więcej niż goły `expo-notifications`,
  prawdopodobnie `notifee` albo custom native code).
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
