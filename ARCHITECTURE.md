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
- **Lista zadań** — do zaprojektowania od nowa, patrz niżej (otwarte pytanie →
  rekomendacja w rozmowie z 2026-10-26, do wklejenia tutaj po ostatecznej decyzji).

## FINANSE [GE]

- Duża liczba (jak teraz) + **historia transakcji BEZ rozwinięcia, tylko 3-4 ostatnie**
  (nie cała lista od razu).
- **PRACA** [PE]
- **POJAZDY** / **PRODUKTY** [PE] — *odłożone na koniec*. Koncept: zaznaczasz że
  wymieniłeś filtr/olej, apka przypomina kiedy następna wymiana.
- **SUBSKRYPCJE** [PE]
- Pomniejsze zakładki (Pojazdy/Produkty/Subskrypcje) — pomysł: dostęp przez customowy
  przycisk w lewym dolnym rogu, PER EKRAN. **Koliduje z tym że ten sam róg jest teraz
  stałym miejscem Ustawień (globalnie, patrz `NEXT_STEPS.md`) — do rozstrzygnięcia.**

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
