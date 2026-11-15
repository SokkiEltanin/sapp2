// Kwoty w całej appce — ZAWSZE z groszami (2026-11-15, user: "bez zaokrągleń wgle
// pokazywać z groszami np 45,32 ... dla całej apki"). Jedno miejsce formatowania:
// przecinek dziesiętny, odstęp tysięcy od 10 000 ("1441,37", "12 345,67" — jak
// w polskich paragonach i bankach), minus jako "−".

/** Zaokrąglenie do groszy (zamiast do złotówek) — do sum i list. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** "45,32" / "1441,37" / "12 345,67" / "−3,50" */
export function money(n: number): string {
  const v = round2(Number.isFinite(n) ? n : 0);
  const [int, frac] = Math.abs(v).toFixed(2).split('.');
  const grouped = int.length > 4 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : int;
  return `${v < 0 ? '−' : ''}${grouped},${frac}`;
}

/** "45,32 zł" */
export function zl(n: number): string {
  return `${money(n)} zł`;
}
