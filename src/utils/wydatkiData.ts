import type { Expense } from '@/types/finances';
import { fixedVariableMonths, fixedBreakdown, fixedDeviations, topVariableContributors } from './fixedVariable';
import { foodByCategory, foodByWeekOfMonth, MONTH_FULL, type FoodWeekBar, type FoodCategoryBar } from './foodStats';
import type { FixedItem, FixedDeviation, VariableContributor } from './fixedVariable';

// Dane dla popupu "Wydatki" (WydatkiModal), WSPÓLNE dla Dashboardu (rząd 4,
// domyślnie zakładka Jedzenie) i Finansów (Faza 2.4, domyślnie zakładka Stałe) —
// 2026-11-01, user: "dawaj" na plan Fazy 2.4. JEDNO miejsce liczące "ten
// miesiąc"/"poprzedni miesiąc"/zmianę % dla wszystkich trzech kubłów, żeby oba
// ekrany nie rozjeżdżały się w definicji miesiąca. `food.total` liczony z sumy
// `foodByCategory` (NIE z `fixedVariableMonths.food`) — identycznie jak już
// wdrożone i przetestowane na urządzeniu dla widgetu Dashboardu, celowo bez zmiany
// tamtego zachowania teraz. Stałe/Zmienne NIE mają takiej rozbieżności (bills i
// zmienne pozycje liczone są całym wydatkiem, nie pozycjami paragonu), więc tam
// `fixedVariableMonths` jest jedynym, spójnym źródłem sumy.
function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function pctChange(cur: number, prev: number): number {
  if (prev > 0) return Math.round(((cur - prev) / prev) * 100);
  return cur > 0 ? 100 : 0;
}

export interface WydatkiBucketTotals {
  total: string;
  changePercent: number;
  previousTotal: string;
}

export interface WydatkiData {
  month: string;
  food: WydatkiBucketTotals & { weeks: FoodWeekBar[]; categories: FoodCategoryBar[] };
  fixed: WydatkiBucketTotals & { items: FixedItem[]; deviations: FixedDeviation[] };
  variable: WydatkiBucketTotals & { top: VariableContributor[] };
}

export function computeWydatkiData(expenses: Expense[], today: Date): WydatkiData {
  const thisKey = monthKeyOf(today);
  const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevKey = monthKeyOf(prevDate);
  const [prevMonth, thisMonth] = fixedVariableMonths(expenses, 2, today);

  const categories = foodByCategory(expenses, thisKey);
  const foodTotal = categories.reduce((a, c) => a + c.amount, 0);
  const prevFoodTotal = foodByCategory(expenses, prevKey).reduce((a, c) => a + c.amount, 0);

  return {
    month: MONTH_FULL[today.getMonth()],
    food: {
      total: `${foodTotal} zł`,
      changePercent: pctChange(foodTotal, prevFoodTotal),
      previousTotal: `${prevFoodTotal} zł`,
      weeks: foodByWeekOfMonth(expenses, today),
      categories,
    },
    fixed: {
      total: `${thisMonth.fixed} zł`,
      changePercent: pctChange(thisMonth.fixed, prevMonth.fixed),
      previousTotal: `${prevMonth.fixed} zł`,
      items: fixedBreakdown(expenses, thisKey),
      deviations: fixedDeviations(expenses, thisKey),
    },
    variable: {
      total: `${thisMonth.variable} zł`,
      changePercent: pctChange(thisMonth.variable, prevMonth.variable),
      previousTotal: `${prevMonth.variable} zł`,
      top: topVariableContributors(expenses, thisKey, 5),
    },
  };
}
