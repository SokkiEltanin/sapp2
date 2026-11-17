// Czyste funkcje profilu (2026-11-17) — testy __tests__/profile.test.ts.
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function ageOn(birth: string | null | undefined, now: Date = new Date()): number | null {
  if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const [y, m, d] = birth.split('-').map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** Najbliższe urodziny (dziś albo później): data YYYY-MM-DD, za ile dni i ile kończysz. 29.02 → 28.02 w nieprzestępnym. */
export function nextBirthday(birth: string | null | undefined, now: Date = new Date()): { date: string; days: number; turns: number } | null {
  if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const [y, m, d] = birth.split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const at = (year: number) => {
    const last = new Date(year, m, 0).getDate();
    return new Date(year, m - 1, Math.min(d, last));
  };
  let next = at(today.getFullYear());
  if (next < today) next = at(today.getFullYear() + 1);
  return { date: ymd(next), days: Math.round((next.getTime() - today.getTime()) / 86400000), turns: next.getFullYear() - y };
}

/** BMI z wagi i wzrostu (null, gdy brak danych). */
export function bmi(kg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!kg || !heightCm || heightCm < 80) return null;
  const m = heightCm / 100;
  return Math.round((kg / (m * m)) * 10) / 10;
}

export function bmiLabel(v: number): string {
  if (v < 18.5) return 'niedowaga';
  if (v < 25) return 'w normie';
  if (v < 30) return 'nadwaga';
  return 'otyłość';
}
