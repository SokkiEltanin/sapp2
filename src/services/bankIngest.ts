import { parseBankNotification } from '@/utils/bankNotification';
import { getOwnName } from '@/utils/ownName';
import { loadMerchantMemory, merchantFor } from '@/utils/merchantMemory';
import { isKnownPaycheckSender } from '@/utils/paycheckSenders';
import { useBankQueue } from '@/store/bankQueueStore';

// Port z sapp (src/services/bankIngest.ts), adaptacja do modelu sapp2 bez sztywnej
// kategorii: sapp miał `guessCategory()` (słownik sklep→kategoria) jako ostateczny
// fallback i `useBankRules`/szablony usera jako pośredni krok — oba pominięte w tej
// rundzie (sapp2 nie ma `ExpenseCategory`; szablony to osobna, odłożona funkcja, patrz
// NEXT_STEPS.md). Nierozpoznany sprzedawca dostaje puste `tags: []` — user otaguje
// ręcznie w przeglądzie, od tego momentu `merchantMemory` się uczy, dokładnie jak każdy
// inny wydatek w tej appce.
//
// Zamienia JEDNO powiadomienie push z banku w zakolejkowaną, wstępnie otagowaną
// płatność. Bezpieczne do wołania bez zamontowanych komponentów (zustand + AsyncStorage
// działają z zamkniętą appką). Zaufani (auto) sprzedawcy i tak trafiają do kolejki, ale
// oflagowani `auto` — procesor w appce (bankAutoProcess.ts) zatwierdza je bez ręcznego
// przeglądu przy następnym otwarciu.
//
// `notifKey` — dostarczona przez wołającego tożsamość dedupu DLA TEGO KONKRETNEGO
// eventu (patrz `bankNotificationDrain.ts`, budowane z `pkg:postTime`). Gdy podane,
// powiadomienie którego klucz już przetworzyliśmy — KIEDYKOLWIEK, nie tylko ostatnio —
// jest odrzucane PRZED parsowaniem (patrz długi komentarz w bankQueueStore.ts).
export async function ingestBankNotification(title: string, text: string, notifKey?: string): Promise<boolean> {
  const store = useBankQueue.getState();
  if (!store.enabled) return false;
  if (notifKey && store.wasNotificationSeen(notifKey)) return false;
  const tx = parseBankNotification(title, text, getOwnName());
  if (!tx) return false;
  if (notifKey) store.markNotificationSeen(notifKey);

  // Waluta obca (płatność kartą za granicą) — sapp2's `Expense` nie ma pola na
  // oryginalną/przeliczoną kwotę (sapp miał `originalAmount`/`plnOverride`, patrz
  // bank-review.tsx tam), więc NIGDY nie auto-księgujemy: surowe cyfry obcej waluty
  // zaksięgowane jako PLN zafałszowałyby sumy. Zawsze do ręcznego przeglądu, gdzie
  // user widzi walutę i może poprawić kwotę na PLN przed zatwierdzeniem.
  const foreign = tx.currency !== 'PLN';

  // Przelew przychodzący → przychód. Pełny autopilot oznacza PEŁNY autopilot: zwykły
  // przelew jest księgowany od razu, tak samo jak płatność kartą — bez tego zwykły
  // przelew ("Wpłynęło 37,00 PLN … od OLESIA NEZHUHA") po prostu siedział w kolejce.
  if (tx.direction === 'in') {
    const isPaycheck = !!tx.isSalary || await isKnownPaycheckSender(tx.storeKey);
    // Duży przelew, który nie wygląda jak Twoja wypłata, jest wart jednego spojrzenia —
    // to jedyny przypadek gdzie ciche zaksięgowanie mogłoby zafałszować statystyki.
    const uncertain = foreign || (!isPaycheck && tx.amount > 1500);
    return store.enqueue({
      ...tx,
      tags: [],
      suggestedTags: [],
      isPaycheck,
      auto: store.autoAll && !uncertain,
      ...(uncertain ? { flagReason: foreign ? `przelew w obcej walucie (${tx.currency}) — sprawdź kwotę w PLN` : 'duży przelew przychodzący — potwierdź, czy to przychód' } : {}),
    });
  }

  // Przelew na WŁASNE inne konto (Revolut/oszczędności): nie jest to ani przychód, ani
  // "prawdziwy" wydatek, tylko przesunięcie własnych pieniędzy. sapp2 nie ma jeszcze
  // osobnego kubła "przelew własny" we fixedVariable.ts (tylko fixed/variable/food) —
  // ZAWSZE do ręcznego przeglądu, żeby user mógł ewentualnie ustawić `fvOverride`
  // samodzielnie po dodaniu (patrz AddExpenseModal.tsx).
  if (tx.selfTransfer) {
    return store.enqueue({
      ...tx,
      tags: ['przelew własny'],
      suggestedTags: ['przelew własny'],
      flagReason: 'przelew na Twoje inne konto — to nie jest wydatek, rozważ ręczne wyłączenie z sum (Stałe/Zmienne/Jedzenie)',
    });
  }

  const mem = await loadMerchantMemory();
  const learned = merchantFor(tx.storeKey, mem);
  // Nietypowo wysoka kwota (częsty objaw błędnie odczytanej liczby, np. 10,18 jako
  // 1018) jest jedyną rzeczą wartą potwierdzenia — brakująca nazwa sklepu NIE blokuje
  // (po prostu księguje się jako "Płatność").
  const uncertain = foreign || tx.amount > 1500;
  const flagReason = foreign ? `płatność w obcej walucie (${tx.currency}) — sprawdź kwotę w PLN` : (uncertain ? 'nietypowo wysoka kwota — potwierdź' : undefined);
  return store.enqueue({
    ...tx,
    store: learned?.name ?? tx.store,
    tags: learned?.tags ?? [],
    suggestedTags: learned?.tags ?? [],
    auto: (store.autoAll || !!learned?.auto) && !uncertain,
    matchedSource: learned ? 'learned' : 'guess',
    ...(uncertain ? { flagReason } : {}),
  });
}
