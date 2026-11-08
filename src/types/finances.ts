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
// 'transfer' — "przelew własny" (2026-11-08, user: "opcje przelewu własnego ktory
// nie wlicza się do liczenia stałych zmiennych i jedzenia") — przesunięcie
// pieniędzy między WŁASNYMI kontami (np. na oszczędności), nie realny wydatek.
// Osobny wariant od `FvBucket`, nie czwarty kubeł w nim — `FvSplit`/`bucketOf`/itp.
// zakładają DOKŁADNIE 3 liczbowe kubły (fixed/variable/food sumują się do 100%
// zwykłego wydatku), `fvSplitOf` traktuje `'transfer'` jako "zero wkładu do
// wszystkich trzech", nie jako nowy kubeł do sumowania.
export type FvOverride = FvBucket | 'transfer';
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
  promotion?: string; // etykieta promocji wykryta przez parser ("1+1", "-20%"…)
  suspect?: boolean;  // parser podejrzewa że to nie produkt (nagłówek/suma) — UI auto-odznacza
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
  fvOverride?: FvOverride | null;
  paymentMethod?: PaymentMethod;
  // Kto faktycznie zapłacił — `undefined`/`'me'` (domyślnie) = ja. `'partner'` = Olesia.
  // Napędza `utils/balance.ts`'s `affectsBalance` — saldo ma odzwierciedlać WYŁĄCZNIE
  // stan konta bankowego usera, więc płatność Olesi nigdy go nie rusza, niezależnie
  // od metody (user, 2026-11-01: "chcę saldo żeby odzwierciedlało ile mam na koncie").
  payer?: 'me' | 'partner';
  // Ten wydatek już dopasowany do złapanej płatności z banku (Faza 2.5) — żeby
  // powiadomienie o tej samej płatności nie dodało duplikatu.
  bankMatched?: boolean;
  // Płatność w obcej walucie z banku, jeszcze nieprzeliczona (2026-11-09, user:
  // "jak obca waluta niech się nie liczy bezpośrednio tylko po kliknięciu trzeba
  // wprowadzić ile to w PLN żeby zapisać i wtedy się liczy") — surowe cyfry
  // walutowe NIE są automatycznie PLN, więc `amount` jest wtedy 0 (nic nie wnosi
  // do żadnej sumy/salda — `fvSplitOf`/`accountBalance` nie potrzebują osobnej
  // obsługi, 0 po prostu nic nie zmienia) dopóki `AddExpenseModal` nie zapisze
  // tego wydatku z realną kwotą PLN, co czyści oba te pola. `originalAmount` —
  // NIE nowa nazwa, już istniejące pole w `MatchExpense` (utils/bankNotification.ts,
  // `amountMatches` już sprawdza je jako fallback) — powtórnie dostarczone
  // powiadomienie o TEJ SAMEJ obcej płatności (surowa kwota, nie 0) dalej trafi
  // w dedup zamiast dodać duplikat. Obecność `originalCurrency` = "ten wydatek
  // czeka na przeliczenie".
  originalAmount?: number;
  originalCurrency?: string;
  createdAt: string;
  updatedAt: string;
}
