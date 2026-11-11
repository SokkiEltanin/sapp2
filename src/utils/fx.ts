// Płatność w obcej walucie czekająca na kwotę w PLN (2026-11-11, user:
// "wszystko co w obcej walucie musi mieć formularz do wypełnienia ile to jest w
// PLN — często jednorazowo, bo rynek jest płynny"). Konwencja wspólna dla
// wydatków i Stałych opłat: obecność `originalCurrency` = czeka, `amount` = 0
// (nic nie wnosi do sum), `originalAmount` = surowa kwota w walucie. Kurs NIE
// jest liczony automatycznie — user wpisuje realną kwotę PLN z wyciągu.
export interface PendingFx { amount: number; currency: string }

export function pendingFxOf(x: { originalAmount?: number; originalCurrency?: string }): PendingFx | undefined {
  if (!x.originalCurrency || x.originalAmount == null) return undefined;
  return { amount: x.originalAmount, currency: x.originalCurrency };
}

export function formatFx(fx: PendingFx): string {
  return `${fx.amount.toFixed(2).replace('.', ',')} ${fx.currency}`;
}
