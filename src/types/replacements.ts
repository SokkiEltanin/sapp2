// Wymiany domowe (2026-11-13, user: "ogarnij... wszystko z wymianami, filtrów w
// dzbanku, do powietrza itp itd i szczoteczek końcówek"). Rzeczy, które zużywają
// się z czasem i trzeba je wymieniać co N dni/tygodni/miesięcy. Serwis pojazdów
// ma osobny model (types/vehicles.ts's maintenance) — oba trafiają do kafla
// "Najbliższa wymiana" na Dashboardzie (utils/replacements.ts's nextAnyReplacement).
export type ReplaceUnit = 'd' | 'w' | 'm';

export interface ReplaceItem {
  id: string;
  name: string;
  preset?: string;          // klucz z REPLACE_PRESETS (ikona, słowa z paragonu)
  every: number;            // co ile…
  unit: ReplaceUnit;        // …dni / tygodni / miesięcy
  lastDate: string;         // YYYY-MM-DD ostatniej wymiany
  history: string[];        // wcześniejsze daty wymian (bez lastDate), malejąco
  remindDaysBefore: number; // -1 = bez przypomnienia, 0 = w dniu, N = N dni przed
  keywords: string[];       // słowa w pozycjach paragonu = zakup tej rzeczy
  dismissedBuys?: string[]; // id wydatków odrzuconych jako "to nie to"
  note?: string;
  createdAt: string;
  updatedAt: string;
}
