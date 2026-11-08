// NOWE (2026-11-09, user: "zamiast tego kafelka po prawej [Najbliższa opłata,
// stub] zróbmy odliczanie i tam będzie pokazywać ile dni do eventu, że wybieram
// event kalendarza i pokazuje dni ile potem godzin a potem minut") — zamiana
// martwego stuba (appka nie ma store'a "bills") na realną funkcję: user wybiera
// JEDEN konkretny event z kalendarza (nie "najbliższy" jak Dashboard's kafelek
// "Teraz" — to świadomy, ręczny wybór, patrz src/store/countdownStore.ts), kafel
// liczy do niego w dół.
export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  totalMs: number;
  past: boolean;
}

export function countdownParts(target: Date, now: Date = new Date()): CountdownParts {
  const totalMs = target.getTime() - now.getTime();
  const past = totalMs <= 0;
  const abs = Math.abs(totalMs);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  return { days, hours, minutes, totalMs, past };
}

// "Dni ile, potem godzin, a potem minut" — coraz drobniejsza jednostka w miarę
// zbliżania się (nie liczy sekund — appka świadomie unika żywych, sekundowych
// tickerów, patrz src/types/work.ts/useWorkEarnings-owy lag w historii sapp).
export function formatCountdown(p: CountdownParts): string {
  if (p.past) return 'już się zaczęło';
  if (p.days > 0) return `${p.days} ${plDays(p.days)} ${p.hours}h`;
  if (p.hours > 0) return `${p.hours}h ${p.minutes}m`;
  return `${p.minutes} min`;
}

function plDays(n: number): string {
  return n === 1 ? 'dzień' : 'dni';
}
