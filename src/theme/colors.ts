// Dark-only — user: "jasny tryb żegnamy na zawsze". Jedna, stała paleta, żadnego
// przełącznika/wariantu do utrzymywania ani testowania.
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
    muted: '#6B7180',
    // `bright` (2026-10-30, redesign Dashboardu na monochromatyczny — user podesłał
    // dokładny SVG referencyjny, wyciągnięte z niego fill'e) — jaśniejszy biały dla
    // WYRÓŻNIONYCH dużych liczb kafelków (np. "74" WODA, "7h 50m" SNU, aktywna
    // kolumna wykresu), odróżnialny od zwykłego `primary` tekstu. Zastępuje
    // kolorowanie liczb per-kategoria (`stat.*`) — patrz komentarz w StatTile.tsx.
    bright: '#ECECEC',
  },
  accent: {
    blue: '#6C9EFF',   // Dashboard (nawigacja/taby)
    orange: '#FB923C', // Daily
    green: '#2AC68F',  // Finanse
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
} as const;

export type Colors = typeof colors;
