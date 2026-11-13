// Pola dat w formularzach (wydzielone 2026-11-13 z app/subscriptions.tsx — drugi
// użytkownik: formularz Wymian).
// DD.MM.RRRR (ludzki wpis) <-> YYYY-MM-DD (ISO, jak w store/porcie z sapp).
export function toDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
}
export function parseDisplayDate(str: string): string | null {
  const parts = str.split('.');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!(y >= 2000 && y <= 2100) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return null;
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime()) || dt.getMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
// Wpisywanie daty samymi cyframi (klawiatura numeryczna nie ma kropki):
// "12032027" → "12.03.2027", kropki wstawiane same w trakcie pisania.
export function maskDateDigits(v: string): string {
  const dg = v.replace(/\D/g, '').slice(0, 8);
  if (dg.length <= 2) return dg;
  if (dg.length <= 4) return `${dg.slice(0, 2)}.${dg.slice(2)}`;
  return `${dg.slice(0, 2)}.${dg.slice(2, 4)}.${dg.slice(4)}`;
}

