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
  },
  accent: {
    blue: '#6C9EFF',   // Dashboard (nawigacja/taby)
    orange: '#FB923C', // Daily
    green: '#2AC68F',  // Finanse
    red: '#EF4444',    // Pupil
    purple: '#A78BFA',
  },
  // Kolory kategorii kafelków statystyk na Dashboardzie — jeden kolor na kategorię,
  // używany i do tekstu (liczba + etykieta), i do gradientu w tle tego samego kafla
  // (ten sam hex, warstwa gradientu na 20% opacity nad #141414 — patrz StatTile).
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
