import type { Budget, BudgetScope } from '@/types/budgets';
import type { Expense } from '@/types/finances';
import { fvSplitOf } from './fixedVariable';
import { EXPENSE_CATEGORY_META, variableSplitOf } from './expenseCategory';

// Logika budżetów (2026-11-13) — czyste funkcje, testy __tests__/budgets.test.ts.

export function scopeLabel(scope: BudgetScope): string {
  if (scope === 'all') return 'Wszystkie wydatki';
  if (scope === 'food') return 'Jedzenie';
  if (scope === 'variable') return 'Zmienne';
  if (scope === 'fixed') return 'Stałe';
  return EXPENSE_CATEGORY_META[scope.slice(4)]?.label ?? scope.slice(4);
}

export function scopeColor(scope: BudgetScope): string | null {
  return scope.startsWith('cat:') ? EXPENSE_CATEGORY_META[scope.slice(4)]?.color ?? null : null;
}

// Wkład JEDNEGO wydatku do zakresu (te same kubły co "Podział" w Finansach).
export function amountInScope(e: Expense, scope: BudgetScope): number {
  if (e.type === 'income') return 0;
  const s = fvSplitOf(e);
  if (scope === 'all') return s.fixed + s.food + s.variable;
  if (scope === 'food') return s.food;
  if (scope === 'variable') return s.variable;
  if (scope === 'fixed') return s.fixed;
  // Kategoria = pozycje paragonu z tą kategorią + reszta wydatku z nią (2026-11-14).
  return variableSplitOf(e).get(scope.slice(4)) ?? 0;
}

export function spentInMonth(expenses: Expense[], scope: BudgetScope, monthKey: string): number {
  let sum = 0;
  for (const e of expenses) if ((e.date ?? '').slice(0, 7) === monthKey) sum += amountInScope(e, scope);
  return Math.round(sum * 100) / 100;
}

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export type BudgetLevel = 'ok' | 'pace' | 'warn' | 'over';

export interface BudgetStatus {
  budget: Budget;
  spent: number;
  left: number;         // może być < 0
  pct: number;          // spent / limit (0..)
  perDay: number;       // ile dziennie można jeszcze wydać do końca miesiąca (z dziś), ≥ 0
  daysLeft: number;     // łącznie z dziś
  projected: number;    // prognoza na koniec miesiąca przy obecnym tempie
  pacePct: number;      // ile miesiąca minęło (0..1) — "kreska" na pasku
  level: BudgetLevel;   // over ≥100%, warn ≥80%, pace = prognoza > limit, ok
}

export function budgetStatus(b: Budget, expenses: Expense[], now: Date = new Date()): BudgetStatus {
  const spent = spentInMonth(expenses, b.scope, monthKey(now));
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = now.getDate();
  const daysLeft = dim - day + 1;
  const left = Math.round((b.limit - spent) * 100) / 100;
  const pct = b.limit > 0 ? spent / b.limit : 0;
  // Prognoza: tempo z minionych dni (dziś liczone jako pełny dzień dopiero od połowy).
  const elapsed = Math.max(1, day - 1 + Math.min(1, now.getHours() / 24 + 0.5));
  const projected = Math.round((spent / elapsed) * dim);
  const level: BudgetLevel = pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : projected > b.limit && day >= 5 ? 'pace' : 'ok';
  return {
    budget: b, spent, left, pct, daysLeft, projected, level,
    perDay: Math.max(0, Math.floor(left / daysLeft)),
    pacePct: (day - 1 + 0.5) / dim,
  };
}

export function budgetStatuses(budgets: Budget[], expenses: Expense[], now: Date = new Date()): BudgetStatus[] {
  const order: Record<BudgetLevel, number> = { over: 0, warn: 1, pace: 2, ok: 3 };
  return budgets.map((b) => budgetStatus(b, expenses, now)).sort((a, b) => order[a.level] - order[b.level] || b.pct - a.pct);
}

// Ostatnie N PEŁNYCH miesięcy (bez bieżącego) z obecnym limitem: ile wydane, czy się zmieściło.
export interface BudgetMonth { key: string; label: string; spent: number; within: boolean }
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
export function budgetHistory(b: Budget, expenses: Expense[], n = 6, now: Date = new Date()): BudgetMonth[] {
  const out: BudgetMonth[] = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    const spent = spentInMonth(expenses, b.scope, key);
    out.push({ key, label: MONTHS[d.getMonth()], spent, within: spent <= b.limit });
  }
  return out;
}

// Podpowiedź limitu: średnia z ostatnich 3 pełnych miesięcy (z wydatkami), zaokrąglona w górę do 50 zł.
export function suggestLimit(expenses: Expense[], scope: BudgetScope, now: Date = new Date()): number | null {
  const vals: number[] = [];
  for (let i = 1; i <= 3; i++) {
    const v = spentInMonth(expenses, scope, monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    if (v > 0) vals.push(v);
  }
  if (!vals.length) return null;
  return Math.ceil(vals.reduce((a, b) => a + b, 0) / vals.length / 50) * 50;
}

// Powiadomienia: próg (80% / 100%) przekroczony po raz pierwszy w tym miesiącu.
export interface BudgetAlert { budgetId: string; month: string; level: 'warn' | 'over'; title: string; body: string }
export function newBudgetAlerts(
  statuses: BudgetStatus[], notified: Record<string, { month: string; level: 'warn' | 'over' }>, now: Date = new Date(),
): BudgetAlert[] {
  const m = monthKey(now);
  const out: BudgetAlert[] = [];
  for (const s of statuses) {
    if (s.level !== 'warn' && s.level !== 'over') continue;
    const prev = notified[s.budget.id];
    if (prev && prev.month === m && (prev.level === 'over' || prev.level === s.level)) continue;
    const name = scopeLabel(s.budget.scope);
    out.push({
      budgetId: s.budget.id, month: m, level: s.level,
      title: s.level === 'over' ? `Budżet przekroczony: ${name}` : `Budżet ${Math.round(s.pct * 100)}%: ${name}`,
      body: s.level === 'over'
        ? `Wydane ${fmt(s.spent)} z ${fmt(s.budget.limit)} zł — ${fmt(-s.left)} zł ponad limit.`
        : `Zostało ${fmt(s.left)} zł na ${s.daysLeft} dni (${s.perDay} zł dziennie).`,
    });
  }
  return out;
}
const fmt = (n: number) => String(Math.round(n));
