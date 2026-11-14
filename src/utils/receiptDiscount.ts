import type { ReceiptItem } from '@/types/finances';

// Zniżki na paragonie (2026-11-14, user: "zniżek nie widać ile wynoszą i jak się
// dodaje"). Zasada: price = cena PO rabacie, discount = ile odjęto, więc
// cena przed rabatem = price + discount. Czyste funkcje (__tests__/receiptDiscount.test.ts).
const r2 = (n: number) => Math.round(n * 100) / 100;

/** "3,99" → 3.99; "20%" → 20% z `base`. Puste/niepoprawne → null. */
export function parseDiscountInput(text: string, base: number): number | null {
  const t = text.trim().replace(',', '.').replace(/\s+/g, '');
  if (!t) return null;
  const pct = /^(\d+(?:\.\d+)?)%$/.exec(t);
  if (pct) return r2((base * Math.min(100, Number(pct[1]))) / 100);
  const n = Number(t.replace(/zł$/i, ''));
  return Number.isFinite(n) && n >= 0 ? r2(n) : null;
}

export const grossPrice = (it: ReceiptItem) => r2(it.price + (it.discount ?? 0));

/** Ustawia zniżkę pozycji (nie dokłada) — 0 usuwa zniżkę i jej etykietę. */
export function setItemDiscount(it: ReceiptItem, amount: number): ReceiptItem {
  const gross = grossPrice(it);
  const d = r2(Math.min(gross, Math.max(0, amount)));
  if (d === 0) {
    const { discount: _d, promotion: _p, ...rest } = it;
    return { ...rest, price: gross };
  }
  return { ...it, discount: d, price: r2(gross - d) };
}

const counts = (it: ReceiptItem) => !it.excluded && it.kind !== 'deposit';

/** Rabat na cały paragon rozłożony proporcjonalnie do cen pozycji (ostatnia bierze resztę z groszy). */
export function applyReceiptDiscount(items: ReceiptItem[], amount: number, label = 'rabat na paragon'): ReceiptItem[] {
  const idx = items.map((it, i) => (counts(it) && it.price > 0 ? i : -1)).filter((i) => i >= 0);
  const sum = idx.reduce((a, i) => a + items[i].price, 0);
  const total = r2(Math.min(Math.max(0, amount), sum));
  if (!idx.length || total <= 0) return items;
  let left = total;
  const out = items.slice();
  idx.forEach((i, j) => {
    const it = out[i];
    const share = j === idx.length - 1 ? left : r2((it.price / sum) * total);
    left = r2(left - share);
    out[i] = { ...it, discount: r2((it.discount ?? 0) + share), price: r2(it.price - share), promotion: it.promotion ?? label };
  });
  return out;
}

export function receiptSavings(items: ReceiptItem[]): { amount: number; count: number } {
  let amount = 0, count = 0;
  for (const it of items) if (counts(it) && (it.discount ?? 0) > 0) { amount += it.discount!; count++; }
  return { amount: r2(amount), count };
}
