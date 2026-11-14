// Odmiana liczebników po polsku: 1 wydatek, 2–4 wydatki (poza 12–14), 5+ wydatków.
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n);
  if (a === 1) return one;
  const d = a % 10, t = a % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

export const nWydatkow = (n: number) => `${n} ${plural(n, 'wydatek', 'wydatki', 'wydatków')}`;
