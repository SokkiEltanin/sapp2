import { parseBankNotification } from '@/utils/bankNotification';
import { getOwnName } from '@/utils/ownName';
import { loadMerchantMemory, merchantFor } from '@/utils/merchantMemory';
import { isKnownPaycheckSender } from '@/utils/paycheckSenders';
import { useBankQueue } from '@/store/bankQueueStore';

// Port z sapp (src/services/bankIngest.ts), adaptacja do modelu sapp2 bez sztywnej
// kategorii: sapp miał `guessCategory()` (słownik sklep→kategoria) jako ostateczny
// fallback i `useBankRules` jako OSOBNY, równoległy mechanizm dopasowywania wzorców —
// pominięty (sapp2 nie ma `ExpenseCategory`). "Szablon" (2026-11-01, user: "stworzyć
// szablon z wyłapanych") w sapp2 NIE jest drugim mechanizmem dopasowywania — to
// jednorazowy fast-track TEGO SAMEGO `merchantMemory` poniżej (bank-review.tsx/
// bank-history.tsx: "Stwórz szablon" = `saveMerchant`+`setMerchantAuto` od razu,
// zamiast czekać na AUTO_THRESHOLD czystych akceptacji). Nierozpoznany sprzedawca
// dostaje puste `tags: []` — user otaguje ręcznie w przeglądzie, od tego momentu
// `merchantMemory` się uczy, dokładnie jak każdy inny wydatek w tej appce.
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

  // Waluta obca (płatność kartą za granicą) — JUŻ NIE blokuje auto-księgowanie
  // (2026-11-09, user: "wywal wgle to nieufanie wszystko z automatu niech
  // dodaje tylko" — foreign przestał wymuszać `uncertain`, patrz niżej). Zamiast
  // tego `commitBankTx` (bankCommit.ts) księguje taką płatność z `amount: 0` +
  // `pendingFxAmount`/`pendingFxCurrency` (types/finances.ts) — realny wydatek
  // już JEST na liście, po prostu nie liczy się w żadnej sumie dopóki user nie
  // otworzy go i nie wpisze prawdziwej kwoty PLN. `foreign` samo w sobie
  // zostaje (nadal warte wzmianki w `flagReason` gdy coś INNEGO i tak wymusi
  // ręczny przegląd, np. zbyt duża kwota).
  const foreign = tx.currency !== 'PLN';

  // Przelew przychodzący → przychód. Pełny autopilot oznacza PEŁNY autopilot: zwykły
  // przelew jest księgowany od razu, tak samo jak płatność kartą — bez tego zwykły
  // przelew ("Wpłynęło 37,00 PLN … od OLESIA NEZHUHA") po prostu siedział w kolejce.
  if (tx.direction === 'in') {
    const isPaycheck = !!tx.isSalary || await isKnownPaycheckSender(tx.storeKey);
    // Duży przelew, który nie wygląda jak Twoja wypłata, jest wart jednego spojrzenia —
    // to jedyny przypadek gdzie ciche zaksięgowanie mogłoby zafałszować statystyki.
    const uncertain = !isPaycheck && tx.amount > 1500;
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
  // "prawdziwy" wydatek, tylko przesunięcie własnych pieniędzy. ZAWSZE do ręcznego
  // przeglądu (świadomie NIE zmienione przy okazji "wywal nieufanie" wyżej — to
  // osobna prośba usera, tylko o walutę obcą) — `fvOverride: 'transfer'`
  // (fixedVariable.ts) daje sposób wykluczyć go z sum PO zatwierdzeniu, w
  // AddExpenseModal.tsx.
  if (tx.selfTransfer) {
    return store.enqueue({
      ...tx,
      tags: ['przelew własny'],
      suggestedTags: ['przelew własny'],
      flagReason: 'przelew na Twoje inne konto — to nie jest wydatek, ustaw "Przelew własny" w Rozlicz jako po dodaniu',
    });
  }

  const mem = await loadMerchantMemory();
  const learned = merchantFor(tx.storeKey, mem);
  // Nietypowo wysoka kwota (częsty objaw błędnie odczytanej liczby, np. 10,18 jako
  // 1018) jest jedyną rzeczą wartą potwierdzenia — brakująca nazwa sklepu NIE blokuje
  // (po prostu księguje się jako "Płatność").
  const uncertain = tx.amount > 1500;
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
