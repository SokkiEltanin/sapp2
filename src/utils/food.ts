import type { Expense, ReceiptItem } from '@/types/finances';

// Port z sapp (src/utils/food.ts), taksonomia 1:1 — 19 tagów jedzeniowych z kolorami,
// kolejność = priorytet rozstrzygania (pierwszy pasujący wygrywa, np. "Przyprawa do
// KURCZAKA" → przyprawy, nie mięso; "Sos POMIDOROWY" → sosy, nie warzywa — te trzy
// idą CELOWO przed warzywa/owoce/nabiał). Dokładnie te same kategorie/kolory co już
// czekały jako mock w `MOCK_FOOD_CATEGORIES` (app/(tabs)/index.tsx → WydatkiModal) —
// po podpięciu tego pliku ten kafel przechodzi z mocka na realne dane bez zmiany
// struktury.
export const FOOD_SUBCATS: { tag: string; label: string; color: string }[] = [
  { tag: 'mięso', label: 'Mięso', color: '#F87171' },
  { tag: 'sosy', label: 'Sosy', color: '#FB923C' },
  { tag: 'przyprawy', label: 'Przyprawy', color: '#B45309' },
  { tag: 'konserwy i przetwory', label: 'Konserwy i przetwory', color: '#78716C' },
  { tag: 'nabiał', label: 'Nabiał', color: '#FBBF24' },
  { tag: 'jajka', label: 'Jajka', color: '#FDE047' },
  { tag: 'ryby', label: 'Ryby', color: '#38BDF8' },
  { tag: 'warzywa', label: 'Warzywa', color: '#34D399' },
  { tag: 'owoce', label: 'Owoce', color: '#FB7185' },
  { tag: 'pieczywo', label: 'Pieczywo', color: '#D6A15E' },
  { tag: 'makarony', label: 'Makarony', color: '#CA8A04' },
  { tag: 'ryż i kasze', label: 'Ryż i kasze', color: '#A16207' },
  { tag: 'mąka i produkty sypkie', label: 'Mąka i produkty sypkie', color: '#E7D8B1' },
  { tag: 'oleje i tłuszcze', label: 'Oleje i tłuszcze', color: '#FDBA74' },
  { tag: 'słodycze', label: 'Słodycze', color: '#C084FC' },
  { tag: 'napoje', label: 'Napoje', color: '#22D3EE' },
  { tag: 'przekąski', label: 'Przekąski', color: '#F59E0B' },
  { tag: 'dania gotowe', label: 'Dania gotowe', color: '#A3E635' },
  { tag: 'mrożonki', label: 'Mrożonki', color: '#7DD3FC' },
];
export const FOOD_SUBCAT_META: Record<string, { label: string; color: string }> = {
  ...Object.fromEntries(FOOD_SUBCATS.map((s) => [s.tag, { label: s.label, color: s.color }])),
  inne: { label: 'Inne jedzenie', color: '#9CA3AF' },
};

// Lista tagów do pickerów w UI (edytor paragonu/produktów) — jedno źródło prawdy,
// dodanie kategorii do FOOD_SUBCATS wyżej automatycznie pokazuje się wszędzie.
export const FOOD_ITEM_TAGS: string[] = FOOD_SUBCATS.map((s) => s.tag);

// Czy pozycja paragonu jest jedzeniem — W SAPP2 to WYŁĄCZNIE obecność
// `item.foodSubcat` (ustawiana przez parser przy wczytaniu/kategoryzacji, albo ręcznie
// w edytorze produktów), NIE osobna lista "to nie jedzenie"/globalny mechanizm
// per-nazwa jak w sapp (`isUserNonFood`/`NONFOOD_KEY`) — tamto istniało żeby wspierać
// sapp's oddzielną funkcję "Co zjadłem" (dziennik jedzenia), której sapp2 świadomie
// NIE ma (ARCHITECTURE.md §DAILY: "JEDZENIE... NIE dodajemy jej teraz"). Prościej:
// brak `foodSubcat` = nie liczy się jako jedzenie, koniec historii.
export function isFoodItem(it: ReceiptItem): boolean {
  if (it.kind === 'deposit') return false;
  return !!it.foodSubcat;
}

// Podkategoria pozycji — `foodSubcat` albo 'inne' gdy jedzenie bez przypisanego tagu.
export function foodSubcat(it: ReceiptItem): string {
  return it.foodSubcat ?? 'inne';
}

// Ile z wydatku jest JEDZENIEM: z pozycjami → suma pozycji jedzeniowych; bez pozycji
// (szybki ręczny wpis bez rozbicia na produkty) → cała kwota TYLKO jeśli user ręcznie
// oznaczył cały wydatek jako jedzenie (`fvOverride: 'food'`, sprawdzane WCZEŚNIEJ w
// `fvSplitOf` — ta funkcja nie musi tego powtarzać, więc bez pozycji zwraca 0).
export function foodAmountOf(e: Expense): number {
  const items = e.receiptItems ?? [];
  if (items.length === 0) return 0;
  let sum = 0;
  for (const it of items) if (isFoodItem(it)) sum += it.price ?? 0;
  return sum;
}
