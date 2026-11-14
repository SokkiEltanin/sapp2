import { useMemo } from 'react';
import type { Expense } from '@/types/finances';
import { computeWydatkiData, type WydatkiData } from '@/utils/wydatkiData';
import { useCategoriesVersion } from '@/store/categoriesStore';

// Cienki hook nad `computeWydatkiData` — logika jest czystą funkcją (testowalną
// bez React), to tylko cache'uje wynik na `[expenses, today]` (patrz
// `utils/wydatkiData.ts`). `today` celowo NIE ma domyślnej wartości — wołający
// (Dashboard/Finanse) musi podać WŁASNY, stabilny w ciągu dnia obiekt `Date`
// (ten sam wzorzec `useMemo(() => new Date(), [todayISO()])` co reszta appki),
// inaczej `new Date()` tworzony tu na każdym renderze unieważniałby cache.
export function useWydatkiData(expenses: Expense[], today: Date): WydatkiData {
  const catVersion = useCategoriesVersion(); // nazwy/kolory kategorii z Ustawień
  return useMemo(() => computeWydatkiData(expenses, today), [expenses, today, catVersion]);
}
