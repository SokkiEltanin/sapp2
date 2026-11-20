// Reguły kategoryzacji użytkownika (2026-11-14, plan "appka ma sobie poradzić sama"):
// "jeśli sklep/opis albo pozycja paragonu zawiera X → kategoria Y". Tylko UZUPEŁNIAJĄ
// puste pola — ręcznie ustawiona kategoria zawsze wygrywa. Logika: utils/categoryRules.ts.
export type RuleField = 'store' | 'item';

export interface CategoryRule {
  id: string;
  field: RuleField;          // 'store' = nazwa sklepu + opis wydatku, 'item' = nazwa pozycji paragonu
  match: string;             // fragment tekstu (bez wielkości liter i polskich znaków)
  // 'food' tylko dla pozycji (foodSubcat), 'var' = kategoria Zmiennych, 'own' (2026-11-18,
  // user: "jak zaznaczę przelew własny dla TRADE REPUBLIC, ma łapać sam") = przelew własny
  // (fvOverride 'transfer', wydatek i wpływ; tylko field 'store', tag 'transfer').
  kind: 'food' | 'var' | 'own';
  tag: string;
  createdAt: string;
  updatedAt: string;
}
