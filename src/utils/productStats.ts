import type { Expense, ReceiptItem } from '@/types/finances';
import { canonicalProductName, productGroupKey, parseWeightFromName, weightFor, type WeightMemory } from './productMemory';

// Statystyki ilości produktów (2026-11-14, user: "zapisywać wagę produktu... ile
// sera jemy, ile czego kupujemy — tylko boję się, że to będzie lagować").
// Wydajność: NIC nie jest liczone przy zapisie paragonu. Waga pozycji wynika z:
//   1. wagi w nazwie ("Ser Gouda 150g", "Chipsy 6x40g" — parseWeightFromName),
//   2. wagi sztuki wpisanej raz w Produktach (pamięć wag, productMemory.ts),
//   3. ilości ułamkowej = towar ważony ("0,534" kg bananów).
// Liczone tylko dla oglądanego produktu albo raz po otwarciu Produktów (po animacji).

export function itemKg(it: Pick<ReceiptItem, 'name' | 'quantity'>, mem: WeightMemory = {}): number | undefined {
  const q = it.quantity > 0 ? it.quantity : 1;
  const perUnit = parseWeightFromName(it.name) ?? weightFor(it.name, mem);
  if (perUnit != null) return Math.round(perUnit * q * 1000) / 1000;
  if (!Number.isInteger(q) && q < 30) return Math.round(q * 1000) / 1000; // ważony
  return undefined;
}

// Płyn (litry/ml w nazwie) — ilość pokazywana w l/ml zamiast kg/g (1 l ≈ 1 kg do sum).
export const isLiquidName = (name: string) => /\d\s*(ml|l)\b/i.test(name.replace(/,/g, '.'));

export interface ProductMonth { key: string; label: string; kg: number; count: number; spent: number }
export interface ProductStats {
  purchases: number;
  knownKg: number;          // suma kg z pozycji o znanej wadze
  coverage: number;         // ile pozycji ma znaną wagę (0..1)
  kgPerMonth: number | null;
  gPerWeek: number | null;
  spentPerMonth: number;
  pricePerKg: number | null;
  months: ProductMonth[];   // ostatnie 6 mies. (z bieżącym)
  liquid: boolean;
}

const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const mkey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Nazwa → klucz grupy z pamięcią (nazwy powtarzają się na paragonach setki razy,
// a dopasowanie aliasów bywa rozmyte — liczymy raz na nazwę).
function keyOfFactory(aliases: Record<string, string>) {
  const cache = new Map<string, string>();
  return (name: string) => {
    let k = cache.get(name);
    if (k == null) { k = productGroupKey(canonicalProductName(name, aliases)); cache.set(name, k); }
    return k;
  };
}

function groupItems(expenses: Expense[], groupKey: string, aliases: Record<string, string>): { it: ReceiptItem; date: string }[] {
  const out: { it: ReceiptItem; date: string }[] = [];
  const keyOf = keyOfFactory(aliases);
  for (const e of expenses) {
    for (const it of e.receiptItems ?? []) {
      if (it.kind === 'deposit' || !it.name?.trim()) continue;
      if (keyOf(it.name.trim()) === groupKey) out.push({ it, date: e.date });
    }
  }
  return out;
}

export function productStats(
  expenses: Expense[], groupKey: string, aliases: Record<string, string> = {}, mem: WeightMemory = {}, now: Date = new Date(),
): ProductStats {
  const items = groupItems(expenses, groupKey, aliases);
  const months: ProductMonth[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: mkey(d), label: MONTHS[d.getMonth()], kg: 0, count: 0, spent: 0 });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  let knownKg = 0, known = 0, kgSpent = 0, spent6 = 0, kg6 = 0, liquidN = 0;
  for (const { it, date } of items) {
    const kg = itemKg(it, mem);
    if (isLiquidName(it.name)) liquidN++;
    const m = byKey.get(date.slice(0, 7));
    if (kg != null) { knownKg += kg; known++; kgSpent += it.price; }
    if (m) { m.count++; m.spent += it.price; if (kg != null) { m.kg += kg; kg6 += kg; } spent6 += it.price; }
  }
  // Średnia z miesięcy od pierwszego zakupu w oknie (nie zaniżaj świeżo dodanego produktu).
  const firstIdx = months.findIndex((m) => m.count > 0);
  const span = firstIdx < 0 ? 0 : months.length - firstIdx - 1 + Math.min(1, now.getDate() / 30);
  const kgPerMonth = span > 0 && kg6 > 0 ? kg6 / span : null;
  for (const m of months) { m.kg = Math.round(m.kg * 1000) / 1000; m.spent = Math.round(m.spent * 100) / 100; }
  return {
    purchases: items.length,
    knownKg: Math.round(knownKg * 1000) / 1000,
    coverage: items.length ? known / items.length : 0,
    kgPerMonth: kgPerMonth != null ? Math.round(kgPerMonth * 1000) / 1000 : null,
    gPerWeek: kgPerMonth != null ? Math.round((kgPerMonth * 1000 * 12) / 52) : null,
    spentPerMonth: span > 0 ? Math.round(spent6 / span) : 0,
    pricePerKg: knownKg > 0 ? Math.round((kgSpent / knownKg) * 100) / 100 : null,
    months,
    liquid: liquidN > items.length / 2,
  };
}

// "Ile czego kupujesz" — produkty z największą ilością (kg/mies.) w ostatnich 3
// pełnych miesiącach + bieżącym. Jedno przejście po wydatkach.
export interface TopProduct { groupKey: string; kgPerMonth: number; liquid: boolean }
export function topProductsByKg(
  expenses: Expense[], aliases: Record<string, string> = {}, mem: WeightMemory = {}, now: Date = new Date(), n = 5,
): TopProduct[] {
  const from = mkey(new Date(now.getFullYear(), now.getMonth() - 3, 1));
  const span = 3 + Math.min(1, now.getDate() / 30);
  const sums = new Map<string, number>();
  const liquid = new Map<string, number>();
  const keyOf = keyOfFactory(aliases);
  for (const e of expenses) {
    if ((e.date ?? '').slice(0, 7) < from) continue;
    for (const it of e.receiptItems ?? []) {
      if (it.kind === 'deposit' || !it.name?.trim()) continue;
      const kg = itemKg(it, mem);
      if (kg == null) continue;
      const key = keyOf(it.name.trim());
      sums.set(key, (sums.get(key) ?? 0) + kg);
      liquid.set(key, (liquid.get(key) ?? 0) + (isLiquidName(it.name) ? 1 : -1));
    }
  }
  return [...sums.entries()]
    .map(([groupKey, kg]) => ({ groupKey, kgPerMonth: Math.round((kg / span) * 100) / 100, liquid: (liquid.get(groupKey) ?? 0) > 0 }))
    .sort((a, b) => b.kgPerMonth - a.kgPerMonth)
    .slice(0, n);
}

// "0,8 kg" / "150 g"; płyny: "1,5 l" / "500 ml"
export function fmtKg(kg: number, liquid = false): string {
  if (kg < 1) return `${Math.round(kg * 1000)} ${liquid ? 'ml' : 'g'}`;
  return `${(Math.round(kg * 10) / 10).toString().replace('.', ',')} ${liquid ? 'l' : 'kg'}`;
}
