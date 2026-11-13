// Budżety i limity (2026-11-13, user: "tak, okej" na propozycję: limit miesięczny
// na kategorię, ile zostało, ile dziennie do końca miesiąca, ostrzeżenie).
// Zakres: 'all' (wszystkie wydatki), 'food' / 'variable' / 'fixed' (kubły z
// utils/fixedVariable.ts's fvSplitOf) albo 'cat:<tag>' (kategoria całego wydatku,
// utils/expenseCategory.ts — liczy się jej wkład do Zmiennych).
export type BudgetScope = 'all' | 'food' | 'variable' | 'fixed' | `cat:${string}`;

export interface Budget {
  id: string;
  scope: BudgetScope;
  limit: number;      // zł / miesiąc
  createdAt: string;
  updatedAt: string;
}
