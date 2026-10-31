import type { Expense, FvBucket } from '@/types/finances';
import { looksLikeBill } from './recurringBills';
import { foodAmountOf } from './food';

// Port z sapp (src/utils/fixedVariable.ts), logika 1:1, JEDNA adaptacja: sapp sprawdzał
// `e.category === 'housing' || e.category === 'subscriptions'` — sapp2 nie ma sztywnej
// kategorii (patrz types/finances.ts), więc Stałe = obecność `subscriptionId` ZAMIAST
// kategorii 'subscriptions', reszta (dopasowanie słownika rachunków) bez zmian.
// `isSelfTransfer` (wykrywanie przelewu do siebie/Revolut, sapp-specific heurystyka
// bank-parsingu) pominięte na razie — wraca w Fazie 2.5 razem z powiadomieniami z
// banku, nie ma sensu teraz (ręczne/paragonowe wydatki nie generują fałszywych
// trafień).
export function isFixedExpense(e: Expense): boolean {
  if (e.type === 'income') return false;
  if (e.subscriptionId) return true;
  return looksLikeBill(`${e.note ?? ''} ${e.storeName ?? ''} ${(e.tags ?? []).join(' ')}`);
}

export interface FvSplit { fixed: number; variable: number; food: number }

// Rozbija JEDEN wydatek na wkłady do kubłów Stałe/Zmienne/Jedzenie — pojedynczy
// paragon (np. spożywczy) może mieć wymieszane produkty, część faktycznie jedzeniem,
// część nie (`ReceiptItem.foodSubcat` per-pozycja, patrz food.ts), więc CAŁA kwota nie
// wpada ślepo w jeden kubeł. `fvOverride` i rozpoznany rachunek stały mają
// pierwszeństwo i idą w 100% do jednego kubła — rozbicie dotyczy tylko zwykłych
// zakupów.
export function fvSplitOf(e: Expense): FvSplit {
  if (e.fvOverride === 'fixed') return { fixed: e.amount, variable: 0, food: 0 };
  if (e.fvOverride === 'variable') return { fixed: 0, variable: e.amount, food: 0 };
  if (e.fvOverride === 'food') return { fixed: 0, variable: 0, food: e.amount };
  if (isFixedExpense(e)) return { fixed: e.amount, variable: 0, food: 0 };
  const food = Math.min(e.amount, Math.max(0, foodAmountOf(e)));
  return { fixed: 0, variable: Math.max(0, e.amount - food), food };
}

// Dominujący kubeł JEDNEGO wydatku — do widoków z JEDNĄ etykietą (np. odznaka na
// liście transakcji). Dla mieszanego paragonu (jedzenie+zmienne oba >0) UI pokazujące
// oba kubły wprost powinno czytać `fvSplitOf` bezpośrednio, nie to uproszczenie.
export function bucketOf(e: Expense): FvBucket {
  const s = fvSplitOf(e);
  if (s.fixed > 0 && s.fixed >= s.variable && s.fixed >= s.food) return 'fixed';
  if (s.food > 0 && s.food >= s.variable) return 'food';
  return 'variable';
}

export interface FVMonth {
  month: string;   // YYYY-MM
  fixed: number;
  variable: number; // dyskrecjonalne, BEZ jedzenia (trzymane osobno dla jasności)
  food: number;
}

// Stałe vs zmienne vs jedzenie za ostatnie `n` miesięcy (od najstarszego do najnowszego).
export function fixedVariableMonths(expenses: Expense[], n = 4, now = new Date()): FVMonth[] {
  const out: FVMonth[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let fixed = 0, variable = 0, food = 0;
    for (const e of expenses) {
      if (e.type === 'income') continue;
      if ((e.date ?? '').slice(0, 7) !== key) continue;
      const s = fvSplitOf(e);
      fixed += s.fixed; food += s.food; variable += s.variable;
    }
    out.push({ month: key, fixed: Math.round(fixed), variable: Math.round(variable), food: Math.round(food) });
  }
  return out;
}

function labelFor(e: Expense): string {
  return (e.note ?? '').trim() || (e.storeName ?? '').trim() || 'Wydatek';
}

export interface FixedItem { label: string; amount: number }

// Nazwane rachunki stałe danego miesiąca (YYYY-MM), grupowane po note/storeName i
// zsumowane — "Mieszkanie 1200 · Prąd 180 · PLAY 60".
export function fixedBreakdown(expenses: Expense[], month: string): FixedItem[] {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    if (e.type === 'income') continue;
    if ((e.date ?? '').slice(0, 7) !== month) continue;
    const fixedAmt = fvSplitOf(e).fixed;
    if (fixedAmt <= 0) continue;
    const label = labelFor(e);
    map[label] = (map[label] ?? 0) + fixedAmt;
  }
  return Object.entries(map)
    .map(([label, amount]) => ({ label, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount);
}

export interface FixedDeviation {
  label: string;
  amount: number;
  avgAmount: number;
  deltaPct: number; // (amount - avgAmount) / avgAmount, ze znakiem
}

// Porównuje rachunki stałe tego miesiąca (grupowane jak `fixedBreakdown`) z ich
// WŁASNĄ historyczną średnią z poprzednich `lookback` miesięcy — żeby niezwykle
// wysoki (albo niski) rachunek wyróżniał się, zamiast ginąć w płaskiej sumie "Stałe".
// Potrzebuje ≥1 wcześniejszego miesiąca z TĄ SAMĄ etykietą — zupełnie nowy rachunek
// nie ma względem czego odchylać się, więc jest pomijany zamiast fałszywie flagowany
// jako 100% skok. Próg (≥15% I ≥20 zł) odfiltrowuje normalny szum (np. prąd
// zależny od zużycia) od odchylenia wartego pokazania.
export function fixedDeviations(expenses: Expense[], month: string, lookback = 3): FixedDeviation[] {
  const cur = fixedBreakdown(expenses, month);
  if (cur.length === 0) return [];
  const [y, m] = month.split('-').map(Number);
  const history: Record<string, number[]> = {};
  for (let i = 1; i <= lookback; i++) {
    const d = new Date(y, m - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    for (const it of fixedBreakdown(expenses, key)) {
      (history[it.label] ??= []).push(it.amount);
    }
  }
  const out: FixedDeviation[] = [];
  for (const it of cur) {
    const hist = history[it.label];
    if (!hist || hist.length === 0) continue;
    const avgAmount = hist.reduce((a, b) => a + b, 0) / hist.length;
    if (avgAmount <= 0) continue;
    const deltaPct = (it.amount - avgAmount) / avgAmount;
    if (Math.abs(deltaPct) < 0.15 || Math.abs(it.amount - avgAmount) < 20) continue;
    out.push({ label: it.label, amount: it.amount, avgAmount: Math.round(avgAmount), deltaPct });
  }
  return out.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
}

export interface VariableContributor { label: string; amount: number }

// Największy pojedynczy "zmienny" zakup(y) tego miesiąca — gdy suma zmiennych jest
// wyższa niż zwykle, to zazwyczaj "co przeważyło". Grupowane jak `fixedBreakdown`, żeby
// powtórne zakupy w tym samym miejscu sumowały się zamiast listować każdą pozycję.
export function topVariableContributors(expenses: Expense[], month: string, n = 2): VariableContributor[] {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    if (e.type === 'income') continue;
    if ((e.date ?? '').slice(0, 7) !== month) continue;
    const variableAmt = fvSplitOf(e).variable;
    if (variableAmt <= 0) continue;
    const label = labelFor(e);
    map[label] = (map[label] ?? 0) + variableAmt;
  }
  return Object.entries(map)
    .map(([label, amount]) => ({ label, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

export interface FvTransaction { id: string; label: string; amount: number; date: string; overridden: boolean }

// Chronologiczna (najnowsze pierwsze) lista POJEDYNCZYCH transakcji liczonych w danym
// kuble (fixed/variable/food) w danym miesiącu — do drill-down w popupie
// Stałe/Zmienne/Jedzenie (każda transakcja osobno, żeby dało się ją pojedynczo
// przeklasyfikować przez `fvOverride`, `overridden` flaguje już ręcznie poprawione).
export function bucketTransactions(expenses: Expense[], month: string, bucket: FvBucket): FvTransaction[] {
  const out: FvTransaction[] = [];
  for (const e of expenses) {
    if (e.type === 'income') continue;
    if ((e.date ?? '').slice(0, 7) !== month) continue;
    // Kwota = WKŁAD tego wydatku do TEGO kubła, nie zawsze cała `e.amount` — mieszany
    // paragon (jedzenie+chemia) może pojawić się w OBU zakładkach naraz, każda z
    // tylko swoją częścią kwoty, patrz `fvSplitOf`.
    const amt = fvSplitOf(e)[bucket];
    if (amt <= 0) continue;
    out.push({ id: e.id, label: labelFor(e), amount: Math.round(amt), date: e.date, overridden: !!e.fvOverride });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
