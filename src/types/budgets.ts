// Budżety i limity (2026-11-13, user: "tak, okej" na propozycję: limit miesięczny
// na kategorię, ile zostało, ile dziennie do końca miesiąca, ostrzeżenie).
// Zakres: 'all' (wszystkie wydatki), 'food' / 'variable' / 'fixed' (kubły z
// utils/fixedVariable.ts's fvSplitOf) albo 'cat:<tag>' (kategoria całego wydatku,
// utils/expenseCategory.ts — liczy się jej wkład do Zmiennych).
// 2026-11-15: 'food:<podkategoria>' (słodycze, przekąski, napoje… — utils/foodStats.ts's foodSplitOf).
export type BudgetScope = 'all' | 'food' | 'variable' | 'fixed' | `cat:${string}` | `food:${string}`;

export interface Budget {
  id: string;
  scope: BudgetScope;
  limit: number;      // zł / miesiąc
  createdAt: string;
  updatedAt: string;
}
