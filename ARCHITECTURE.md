# ARCHITECTURE.md — sapp2

Mapa ekranów i połączeń między nimi. Rozpisana przez usera (2026-10-26), zapisana tu
żeby się nie zgubiła między sesjami. **Jeszcze nie zbudowane** (poza Dashboardem, patrz
`NEXT_STEPS.md`) — to plan, nie stan faktyczny. Aktualizuj przy każdej decyzji o nowym
ekranie/połączeniu (patrz `CLAUDE.md`).

Oznaczenia głębokości nawigacji:
- **GE** — Główny Ekran (jeden z 5 w navbarze)
- **PE** — Pod Ekran (`>`, jeden poziom głębiej)
- **PPE** — Pod Pod Ekran (`>>`, dwa poziomy głębiej)

## DASHBOARD [GE]

Kliknięcie w kafelek przenosi na powiązaną zakładkę GE z kontekstem, np. kafelek SEN →
`DAILY`, od razu pokazując sen z dziś + historię + średnią. Edycja danych (dopisanie
wody/snu ręcznie itp.) — **odłożone**, na razie budujemy same ekrany/nawigację.

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

- Kalendarz domyślnie **tygodniowy, zwinięty** → klik rozwija do **widoku miesięcznego**
  (ładna animacja, do przemyślenia jak w `sapp` — dwustronna edycja z Google Calendar,
  czytanie zmian w pracy (praca żyje w zakładce `FINANSE`), plan lekcji.
- **Lista zadań** — kategoryzacja/logika sekcji **ponownie wzięta z `sapp`** (TERAZ/
  bezterminowe/terminowe — sprawdzony, dopracowany model, zadanie #42 w `sapp`), ALE
  **UI/UX zupełnie nowy** (user, 2026-10-26: "zrobimy podobnie ale UIUX będzie zupełnie
  inny"), nie kopiujemy wyglądu z `sapp`. Zewnętrzna referencja zachowania kalendarza:
  TickTick (pasek kalendarza u góry + lista pod spodem).
- **Widget na pulpicie Androida** (user, 2026-10-26: "jak będziemy robić zadania to
  musimy zrobić to tak jak tam [w `sapp`]"). `sapp` ma to zrobione jako **własny,
  natywny Kotlin wpięty przez config-plugin** (`plugins/withTasksWidget.js`) — ŚWIADOMIE
  bez zewnętrznej biblioteki (np. `react-native-android-widget`), bo `sapp` już raz
  złapał build-breaking problem z zależnością zewnętrznego pakietu widgetów
  (namespace/AGP8 na SDK 54). Mechanizm: `AppWidgetProvider` + `RemoteViews`, JS
  (`widgetSync.ts`) pisze JSON snapshot do `filesDir`, natywny most
  (`TasksWidgetModule.requestUpdate()`) odświeża widget, 6 stałych slotów (RemoteViews
  nie wspiera scrolla bez `RemoteViewsService`), tap → deep link schematem appki. Ten
  sam wzorzec do powtórzenia w `sapp2`, nie szukać biblioteki od zera.

## FINANSE [GE]

- Duża liczba (jak teraz) + **historia transakcji BEZ rozwinięcia, tylko 3-4 ostatnie**
  (nie cała lista od razu).
- **PRACA** [PE]
- **POJAZDY** / **PRODUKTY** [PE] — *odłożone na koniec*. Koncept: zaznaczasz że
  wymieniłeś filtr/olej, apka przypomina kiedy następna wymiana.
- **SUBSKRYPCJE** [PE]
- Pomniejsze zakładki (Pojazdy/Produkty/Subskrypcje) — pomysł: dostęp przez customowy
  przycisk w lewym dolnym rogu, PER EKRAN. **Koliduje z tym że ten sam róg jest teraz
  stałym miejscem Ustawień (globalnie) — rozwiązanie: patrz "Kolizja lewy dolny róg"
  w `NEXT_STEPS.md`.**
- **UI/UX kompletnie inny niż w `sapp`** (user, 2026-10-26, ta sama zasada co w Zadaniach).
- **Jeden ujednolicony "dodaj"** (user, 2026-10-26) zamiast rozdzielonych w `sapp`
  ścieżek "dodaj wydatek zwykły" / "dodaj przez paragon" — user: w `sapp` denerwowało
  go że zwykły (ręczny) wydatek nie dawał pola "sklep" (to było tylko przy paragonie),
  i że nazwę złapaną z powiadomienia banku (np. "Zapłacono blikiem dla X firmy") nie
  dało się ręcznie przeredagować na coś schludniejszego. Nowy model: JEDNO miejsce,
  które obsługuje: (a) parser tekstu z paragonu (share-intent), (b) ręczne tworzenie
  "custom paragonu" z tymi samymi polami co parsowany (w tym sklep), (c) dodawanie
  przychodu — i wszędzie pełna edytowalność wyświetlanej nazwy, także tej złapanej
  automatycznie z powiadomienia. Gdzie żyje wejście do tego — patrz "Kolizja lewy dolny
  róg" w `NEXT_STEPS.md` (rekomendacja: floating action button, nie kolejny kafelek
  w rogu).

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
