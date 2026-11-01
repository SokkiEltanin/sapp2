// Minimalny wycinek z sapp (src/utils/date.ts) — TYLKO to czego potrzebuje warstwa
// danych kalendarza (`calendarStore`/`googleCalendarMap`). Resztę (parseISO,
// formatowanie względne itp.) dodamy gdy faktycznie czegoś z tego zacznie
// potrzebować kolejny kawałek kodu, nie z wyprzedzeniem.
export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayISO = (): string => ymd(new Date());

// LOCAL (nie UTC) data+czas — port z sapp, potrzebny dla `utils/bankNotification.ts`
// (powiadomienie z banku bez daty w treści musi dostać LOKALNY "teraz": push o 00:30
// nie może wylądować na wczorajszym dniu, co zrobiłoby `toISOString()`'s UTC).
export const localISO = (d: Date = new Date()): string =>
  `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
