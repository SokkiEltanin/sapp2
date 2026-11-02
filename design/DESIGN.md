# Sokki App – design spec (Expo / React Native)

Referencja wizualna: `design/app-design.html` (otwórz w przeglądarce, wszystko jest klikalne).
Ten plik jest źródłem prawdy dla tokenów, zasad i komponentów.

## Zasady (nienegocjowalne)
1. **Zero scrolla na ekranach głównych.** Każdy ekran mieści się w wysokości (`flex`, nie `ScrollView`). Listy pokazują tyle wierszy, ile wejdzie (`onLayout` → `Math.floor(h / rowH)` → `slice`).
2. **Zakładki nie są swipowalne.** Zmiana tylko przez dolny pasek.
3. **Każda interakcja otwiera bottom sheet (popup).** Kafelki i wiersze → sheet. Sheet może scrollować tylko gdy musi; rzędy chipów scrollują w poziomie.
4. **Pod kciuka.** Na górze dane do czytania, na dole rzeczy do klikania. Główna akcja w sheecie zawsze po prawej, przyciski 54 px.
5. **Zero emoji.** Tylko ikony liniowe (lucide-react-native, stroke 2), tagi tekstowe, monochromatyczne wykresy.
6. **Minimal high-end.** Akcenty kolorystyczne tylko gdy niosą znaczenie (zielony = OK/opłacone, czerwony = termin/przekroczenie, niebieski = tag UR).

## Tokeny
```ts
export const C = {
  bg: '#000000',      // tło – perfect black
  tile: '#141414',    // kafelki
  in: '#1C1C1C',      // elementy wewnątrz kafelka (wiersze, chipy)
  in2: '#232323',     // tło pasków / pressed
  line: '#222222',
  txt: '#D6D6D6',     // tekst + "aktywny/biały" element (przyciski, aktywna zakładka)
  hi: '#F2F2F2',      // duże liczby
  mut: '#6E6E6E',
  dim: '#3A3A3A',
  ok: '#22C55E',
  warn: '#EF4444',
  ur: '#1E3A8A', urTxt: '#C7D2FE',
  // sen
  deep: '#D6D6D6', rem: '#8C8C8C', light: '#4A4A4A', awake: '#EF4444',
};
export const R = { tile: 18, inner: 10, sheet: 28, btn: 16, chip: 12 };
export const S = { screenX: 12, gap: 8, tilePad: 12 };
```
Font: **Inter** (expo-font) – 400/600/700/800/900. Liczby: `fontVariant: ['tabular-nums']`.

| Rola | Rozmiar | Waga | Inne |
|---|---|---|---|
| Duża liczba | 30 (xl 36) | 800 | letterSpacing −1.2, kolor `hi` |
| Jednostka | 9 | 600 | UPPERCASE, letterSpacing 1.2, `mut` |
| Etykieta kafelka | 10 | 800 | UPPERCASE, letterSpacing .6 |
| Caption kafelka | 10 | 700 | lewa: `txt`, prawa: `mut` |
| Wiersz | 12 | 600 | |
| Nagłówek sheeta | 22 | 800 | nad nim mały UPPERCASE `mut` |

## Komponenty
- `Tile` – bg `tile`, radius 18, pad 12, `Pressable` ze scale 0.975 na press. Wariant `hot` (odwrócony: bg `txt`, tekst czarny, pulsująca kropka) – tylko dla „co za ile”.
- `StatTile` – liczba / jednostka / etykieta, **identyczna struktura** w całym rzędzie (liczby na jednej linii).
- `Row` (item) – bg `in`, radius 10, wysokość 28–44, tag po lewej, tekst z ellipsis.
- `Tag` – 9 px / 800, warianty: `ur` (niebieski), `fr` (jasny), `jd`, `dom`, ikona dzwonka.
- `PricePill` – bg `txt`, tekst czarny 10/800, minWidth 56, wyrównanie do prawej; wpływ = obrys zielony.
- `BottomSheet` – @gorhom/bottom-sheet, margines 8 px od krawędzi, radius 28, backdrop blur + 60% czerni, uchwyt 36×4.
- `Segmented` – bg `in`, aktywny segment bg `txt` + czarny tekst, wysokość 40.
- `ChipRow` – poziomy `ScrollView`, fade na krawędziach, chipy 34–40 px.
- `StackBar` – poziomy pasek proporcji (podział wydatków, kategorie jedzenia, fazy snu) + legenda z kwadracikami.
- `MiniBars` – słupki, bieżący = `txt`, reszta `in2`.
- `WeekStrip` – zwinięty tydzień (Samsung): 7 kolumn, dzień + numer (dziś = obrys, wybrany = wypełniony), do 3 mini-eventów w kolorze kategorii, „+N”.
- `MoodPad` – pole 2D (X = przyjemność, Y = energia), drag (react-native-gesture-handler + reanimated), kropki historii 7 dni, 9 nazw stanów, emocje zależne od ćwiartki.
- Nav: osobny przycisk ustawień po lewej + grupa 4 ikon (Dashboard, Daily, Finanse, Zadania), aktywny = bg `txt`.

## Ekrany (siatka 4 kolumny, gap 8)
**Dashboard**
1. 4× StatTile: Woda, Słodycze, Trening (streaki) + `hot` „za X min · wydarzenie”.
2. Ciekawostka (2) + Sen (2: czas, godziny, mini StackBar faz).
3. Jedzenie PLN/dzień (1) + #JedzeniePerMiesiąc (3, bieżący miesiąc jasny).
4. Ostatnie transakcje (3) + Bezpieczne wydatki PLN/dzień (1).
5. **Najbliższe 48h** (4, największy): wydarzenia + terminy zadań + opłaty cykliczne, sort po czasie.

**Daily:** Sen (legenda faz) → Kroki | Tętno → Waga | Woda → Ćwiczenia (fill) → Nastrój (mini MoodPad).
**Finanse:** Saldo → Podział (StackBar) → Jedzenie kategorie (StackBar, szczegóły w sheecie) → Praca | Najbliższa opłata → Ostatnie transakcje (fill, 2-liniowe wiersze).
**Zadania:** WeekStrip → agenda wybranego dnia → lista zadań + na dole Segmented (Teraz / Terminowe / Bez terminu) i przycisk „+”.
**Ustawienia:** Profil → Połączenia → Finanse (Płatności cykliczne, Parser) → Cele → Aplikacja.

## Logika
- **Bezpieczne wydatki/dzień** = (saldo − suma nieopłaconych płatności cyklicznych) / dni do końca miesiąca.
- **Płatności cykliczne** – szablon: `{ name, type: 'sub'|'fixed'|'variable', amount?, day, parserKeyword, history[] }`. Variable = średnia z historii (pokazuj „~”). Parser znajduje transakcję ze słowem → `paid=true` → kafelek pokazuje kolejną.
- **Najbliższe 48h** = merge(eventy z kalendarza od teraz, zadania z terminem ≤ 48h, nieopłacone płatności ≤ 48h), sort po dacie.
- **Nastrój** = `{ valence 0–1, energy 0–1, emotions[], factors[] }`. Etykieta z siatki 3×3:
  - energia wysoka: Zestresowany / Pobudzony / Pełen energii
  - średnia: Zirytowany / Neutralnie / Zadowolony
  - niska: Wyczerpany / Zmęczony / Zmęczony, ale szczęśliwy

## Przeniesienie do React Native – twarde zasady
Gotowy kit: `design/rn/` (theme.ts, layout.tsx, NavBar.tsx, DashboardScreen.tsx). Używaj go, nie pisz własnych odpowiedników.

1. **Siatka = jawne szerokości.** `col = (W − 24 − 3·8) / 4`, `tile = span·col + (span−1)·8`. Nigdy `flex: 1/3` w rzędzie z `gap` – kolumny rozjeżdżają się między rzędami.
2. **Rzędy mają stałą wysokość albo wagę `flex`**, `alignItems: 'stretch'`. Kafelek bez danych NIE może się skurczyć.
3. **Listy przez `FitList`.** Mierzy miejsce, pokazuje tyle wierszy, ile wejdzie, rozciąga je, a puste sloty wypełnia ghost-wierszami.
4. **Stany puste są zaprojektowane:**
   - licznik bez danych → `0` w kolorze `dim` + jednostka „brak” (nigdy „—” ani „wkrótce”);
   - sen bez zegarka → `0h 00m` + „Połącz zegarek w Ustawieniach”;
   - słupki z zerem → słupek 3 px;
   - bezpieczne wydatki < 0 → czerwone `0` + „brak X zł”, nigdy liczba ujemna.
5. **Fonty:** `@expo-google-fonts/inter`, każda waga to osobna rodzina (`F.xb` itd.). Zero `fontWeight`, bo Android go ignoruje i bierze systemowy font. `includeFontPadding: false`.
6. **Nawigacja:** `Tabs` z expo-router + `tabBar={NavBar}`. Bez material-top-tabs i PagerView (przez nie krawędzie sąsiednich ekranów wchodzą w kadr i zakładki są swipowalne).
7. **Captiony kafelków zwykłą wielkością liter** (`Ostatnie transakcje`), UPPERCASE tylko jednostki i etykiety StatTile.
8. **Tagi z kalendarza:** `[PUR] Tytuł` → `splitTag()` → chip `PUR` + sam tytuł.
9. **Weryfikacja wizualna jest obowiązkowa:** expo web + screenshot 390×844 każdego ekranu obok `app-design.html` w tym samym viewporcie. Ekran jest skończony dopiero, gdy wyglądają tak samo.

## Biblioteki
`expo-font` (Inter), `@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-svg` (wykresy, sparkline), `lucide-react-native`, `expo-blur` (backdrop).
