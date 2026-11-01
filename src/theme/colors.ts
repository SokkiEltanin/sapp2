// Dark-only — user: "jasny tryb żegnamy na zawsze". Jedna, stała paleta, żadnego
// przełącznika/wariantu do utrzymywania ani testowania.
//
// Faza 3.1 (2026-11-01, user: "UZNAJ TEN DESIGN JAKO ABSOLUTNY CORE NASZEJ APK
// SAPP2" — design/app-design.html, pełny spec tokenów/zasad/komponentów) — ten
// mockup w dużej mierze FORMALIZUJE kierunek, w który appka już szła (monochromatyczny
// audyt Dashboardu 2026-10-30, "#D6D6D6 to domyślny biały", "tło = perfect BLACK" —
// te same sformułowania user używał już wcześniej). Dodane `ui`/`sleep` niżej to
// NOWE tokeny ze spec, których appka jeszcze nie miała nazwanych (`in`/`in2`/`line`/
// `dim`/`ur`/`urTxt` — tła wierszy/chipów, obrysy, kolor taga "UR"). Istniejące pola
// WYRÓWNANE do dokładnych hexów ze spec gdzie się różniły (`text.bright`→`#F2F2F2`,
// `text.muted`→`#6E6E6E`, `accent.green`→`#22C55E`) — reszta (`accent.*`/`stat.*`)
// zostaje na razie bez zmian (używane w ~14 miejscach, migracja screen-po-screenie w
// kolejnych fazach, patrz ARCHITECTURE.md §"Redesign rdzenia UI").
export const colors = {
  bg: {
    // User: "Jak coś tło to perfect BLACK" — czysty czarny, nie granat jak wcześniej.
    primary: '#000000',
    elevated: '#14171F',
    // Baza pod kartami/kaflami (Dashboard stat tiles i dalej, jednolicie) — z mockupu.
    card: '#141414',
  },
  border: {
    default: '#262A36',
    subtle: '#1D212B',
  },
  text: {
    // User: "#D6D6D6 to jest domyślny biały do appki" — nie czysty #FFFFFF.
    primary: '#D6D6D6',
    secondary: '#A7ADBD',
    // `#6E6E6E` — wyrównane do `mut` z design/app-design.html (Faza 3.1, było `#6B7180`,
    // lekko niebieskawe — spec chce neutralny szary, zero odcienia).
    muted: '#6E6E6E',
    // `bright` (2026-10-30, redesign Dashboardu na monochromatyczny — user podesłał
    // dokładny SVG referencyjny, wyciągnięte z niego fill'e) — jaśniejszy biały dla
    // WYRÓŻNIONYCH dużych liczb kafelków (np. "74" WODA, "7h 50m" SNU, aktywna
    // kolumna wykresu), odróżnialny od zwykłego `primary` tekstu. Zastępuje
    // kolorowanie liczb per-kategoria (`stat.*`) — patrz komentarz w StatTile.tsx.
    // `#F2F2F2` — wyrównane do `hi` z design/app-design.html (Faza 3.1, było `#ECECEC`).
    bright: '#F2F2F2',
  },
  accent: {
    blue: '#6C9EFF',   // Dashboard (nawigacja/taby)
    orange: '#FB923C', // Daily
    // `#22C55E` — wyrównane do `ok` z design/app-design.html (Faza 3.1, było `#2AC68F`).
    green: '#22C55E',  // Finanse
    red: '#EF4444',    // Pupil
    purple: '#A78BFA',
  },
  // Kolory kategorii — UŻYWANE TYLKO jako małe, funkcjonalne akcenty (np. tagi
  // zadań w TaskListTile, kolorowe odznaki ikon w Ustawieniach), NIE jako tło/tekst
  // dużych kafelków Dashboardu (2026-10-30, user podesłał SVG-referencję:
  // "wywaliłem gradienty i poprawiłem monochromatyczność... taki styl przyjmujemy
  // dla całej aplikacji" — cały SVG to w zasadzie sama skala szarości, JEDYNY
  // nie-neutralny kolor to niebieski chip taga "UR"). Historyczny komentarz niżej
  // (gradient w tle kafla) już NIEAKTUALNY dla Dashboardu — patrz StatTile.tsx/
  // PatternTileBackground.tsx/FoodBarsTile.tsx.
  stat: {
    woda: '#5AAFFA',
    slodycze: '#C43A3D',
    event: '#D9A646',
    sen: '#8476F2',
    finanse: '#50B09B',
    // Zastąpiło kafelek pogody (2026-10-26, user: "wywalamy pogodę i tam zrob streak
    // taki sam kafelek tylko pod ćwiczenia") — kolor nienazwany w mockupie, wybrany
    // (zielony, skojarzenie z aktywnością/zdrowiem), do ew. korekty na życzenie.
    cwiczenia: '#5BC24F',
  },
  // Stany "nieaktywne"/tło w wykresach (np. słupki per-miesiąc w kaflu Finanse) —
  // osobne od `stat`, bo to nie kolor kategorii tylko stan "nie aktywny teraz".
  chart: {
    muted: '#6A6A6A',
    barBg: '#0A0A0A',
  },
  // Nowe tokeny z design/app-design.html (Faza 3.1) bez odpowiednika wcześniej —
  // tła wierszy/chipów WEWNĄTRZ kafelka (`in`/`in2`), obrysy (`line`), "wygaszony"
  // element dekoracyjny (`dim`), kolor taga "UR" (`ur`/`urTxt` — JEDYNY nie-szary,
  // nie-semantyczny (nie ok/warn) akcent w całym systemie, bo niesie realne znaczenie
  // "uczelnia/termin akademicki").
  ui: {
    in: '#1C1C1C',
    in2: '#232323',
    line: '#222222',
    dim: '#3A3A3A',
    ur: '#1E3A8A',
    urTxt: '#C7D2FE',
  },
  // Fazy snu (Galaxy Watch/Health Connect — jeszcze NIE zintegrowane, patrz
  // NEXT_STEPS.md "Faza 3" — tokeny gotowe na później, zero fałszywej gotowości UI).
  sleep: {
    deep: '#D6D6D6',
    rem: '#8C8C8C',
    light: '#4A4A4A',
    awake: '#EF4444',
  },
} as const;

export type Colors = typeof colors;
