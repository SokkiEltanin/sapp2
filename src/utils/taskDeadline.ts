// Etykieta terminu zadania na liście (2026-11-11) — lista "Wszystkie" była
// SORTOWANA po terminie, ale sam termin nigdzie nie był widoczny, więc nie
// dało się odróżnić "na dziś" od "za dwa tygodnie" ani zauważyć zaległego.
// Deadline bywa date-only (`YYYY-MM-DD`, szybkie chipy Dziś/Jutro/Za tydzień)
// albo z godziną (`YYYY-MM-DDTHH:MM:00`, "Dokładny termin").
const WEEKDAYS = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

export function deadlineHasTime(deadline: string): boolean {
  return deadline.includes('T');
}

export function parseDeadline(deadline: string): Date {
  return deadlineHasTime(deadline) ? new Date(deadline) : new Date(`${deadline.slice(0, 10)}T00:00:00`);
}

export function deadlineLabel(deadline: string, now: Date = new Date()): { text: string; overdue: boolean } {
  const d = parseDeadline(deadline);
  const hasTime = deadlineHasTime(deadline);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay - startOfToday) / 86400000);
  const time = hasTime ? ` · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
  // Date-only "dziś" NIE jest zaległe przez cały dzień; z godziną — od tej godziny.
  const overdue = hasTime ? d.getTime() < now.getTime() : dayDiff < 0;

  let day: string;
  if (dayDiff === 0) day = 'Dziś';
  else if (dayDiff === 1) day = 'Jutro';
  else if (dayDiff === -1) day = 'Wczoraj';
  else if (dayDiff > 1 && dayDiff < 7) day = WEEKDAYS[d.getDay()];
  else day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;

  return { text: overdue && dayDiff < 0 ? `Zaległe · ${day}${time}` : `${day}${time}`, overdue };
}
