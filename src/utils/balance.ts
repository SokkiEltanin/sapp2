import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Expense } from '@/types/finances';

// Saldo = STAN KONTA BANKOWEGO, nie "wszystkie pieniądze jakie w ogóle mam" (user,
// 2026-11-01: "chcę saldo żeby odzwierciedlało ile mam na koncie w banku"). Sapp
// śledził kartę i gotówkę jako dwa osobne pulе — sapp2 świadomie NIE portuje pulu
// gotówki (user nie prosił o jego podgląd, tylko o to żeby NIE ruszał salda banku) —
// gotówka jest po prostu wyłączona z sumy, nie liczona gdzie indziej.
// Stary klucz — od 2026-11-13 saldo żyje w store/balanceStore.ts (synchronizowane);
// tu tylko odczyt do jednorazowej migracji.
const OFFSET_KEY = 'account_balance_offset_v1';

export async function getBalanceOffset(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(OFFSET_KEY);
    const n = raw != null ? parseFloat(raw) : 0;
    return isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

// Czy ten wydatek/przychód realnie rusza saldo konta: TYLKO gdy zapłaciłem JA
// (domyślnie, `payer` nieustawiony = ja) i NIE gotówką (karta/BLIK/przelew idą przez
// bank, gotówka nie). Zapłacone przez Olesię nigdy nie rusza mojego salda, niezależnie
// od metody płatności.
export function affectsBalance(e: Expense): boolean {
  return (e.payer ?? 'me') === 'me' && e.paymentMethod !== 'cash';
}

export function accountBalance(expenses: Expense[], offset: number): number {
  let net = 0;
  for (const e of expenses) {
    if (!affectsBalance(e)) continue;
    net += e.type === 'income' ? e.amount : -e.amount;
  }
  return offset + net;
}
