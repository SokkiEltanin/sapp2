// Zaznaczanie zakresu dat stuknięciami w kalendarz (2026-11-16, user: "jak filtruję po
// dacie, muszę mieć sam kalendarz od kiedy do kiedy, żeby od razu filtrowało — wpisałem
// i nic nie zrobiło"). 1. stuknięcie = ten jeden dzień (filtr działa od razu),
// 2. stuknięcie = koniec zakresu (kolejność dowolna), kolejne = nowy zakres.
export function nextRange(from: string | undefined, to: string | undefined, day: string): { from: string; to: string } {
  if (from && to && from === to) return day < from ? { from: day, to: from } : { from, to: day };
  return { from: day, to: day };
}

export const ymdOf = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
