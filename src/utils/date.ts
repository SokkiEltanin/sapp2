// Minimalny wycinek z sapp (src/utils/date.ts) — TYLKO to czego potrzebuje warstwa
// danych kalendarza (`calendarStore`/`googleCalendarMap`). Resztę (parseISO,
// formatowanie względne itp.) dodamy gdy faktycznie czegoś z tego zacznie
// potrzebować kolejny kawałek kodu, nie z wyprzedzeniem.
export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayISO = (): string => ymd(new Date());
