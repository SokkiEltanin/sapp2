// Finanse — Faza 2 (2026-10-31), port z `sapp` (src/types/index.ts), ALE z jedną
// świadomą zmianą modelu: usera raziła sztywna, pojedyncza kategoria na wydatek
// (groceries/transport/entertainment/health/clothing/housing/subscriptions/other) —
// "ciężko mi było dostosować którąś kategorię... jak kupuję bilety na wyjazd to
// transport, ale wydamy się tam rozerwać to rozrywka". Zamiast tego: MAŁY zestaw
// strukturalnych sygnałów (ile potrzeba żeby napędzić Stałe/Zmienne/Jedzenie, patrz
// `utils/fixedVariable.ts`) + DOWOLNE, wielokrotne `tags` (jak już działający
// `Task.tags` w Zadaniach) do swobodnego, krzyżowego grupowania — jeden wydatek może
// nosić i "Transport", i "Wakacje" naraz, bez wymuszania jednej szufladki.
export type FvBucket = 'fixed' | 'variable' | 'food';
export type ExpenseSource = 'manual' | 'receipt' | 'bank' | 'bank-auto';
export type PaymentMethod = 'cash' | 'card' | 'blik' | 'transfer';

// `foodSubcat` — klucz z `FOOD_SUBCATS` (utils/food.ts) albo `'inne'`; `undefined` =
// pozycja NIE jest jedzeniem. Zastępuje sapp's `category: ExpenseCategory` +
// `tags: string[]` na poziomie pozycji paragonu (osobne pole zamiast przeciążania
// wolnych tagów semantyką "czy to jedzenie" — czytelniej).
export interface ReceiptItem {
  name: string;
  price: number;
  quantity: number;
  unitPrice: number;
  discount?: number;
  foodSubcat?: string;
  weightKg?: number;
  excluded?: boolean; // np. kaucja (kind:'deposit') albo ręcznie wykluczona z sumy
  kind?: 'deposit';
}

export interface Expense {
  id: string;
  type: 'expense' | 'income';
  amount: number;
  date: string; // YYYY-MM-DD
  note: string;
  storeName?: string;
  tags: string[];
  receiptItems?: ReceiptItem[];
  source: ExpenseSource;
  // Obecność `subscriptionId` = ZAWSZE Stałe, niezależnie od słownika rachunków
  // (utils/recurringBills.ts) — podpinane gdy ekran Subskrypcje (później) powstanie.
  subscriptionId?: string;
  // Ręczne przeklasyfikowanie CAŁEGO wydatku — zawsze wygrywa nad automatyką
  // (patrz `fvSplitOf` w utils/fixedVariable.ts). `null` = brak nadpisania.
  fvOverride?: FvBucket | null;
  paymentMethod?: PaymentMethod;
  // Ten wydatek już dopasowany do złapanej płatności z banku (Faza 2.5) — żeby
  // powiadomienie o tej samej płatności nie dodało duplikatu.
  bankMatched?: boolean;
  createdAt: string;
  updatedAt: string;
}
