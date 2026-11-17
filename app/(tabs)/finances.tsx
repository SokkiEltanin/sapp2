import FitText from '@/ui/FitText';
import { incomeByCategory } from '@/utils/incomeCategory';
import { useEffect, useMemo, useRef, useState } from 'react';
import LazyMount from '@/components/design/LazyMount';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus, Package, Car, ChevronRight, RefreshCw, TrendingUp } from 'lucide-react-native';
import TrendSheet from '@/components/finances/TrendSheet';
import { spacing, radius, themedStyles } from '@/theme';
import { Screen, Row, Tile, Cap, FitList, Item, Price, StackBar } from '@/ui/layout';
import { C, T, S } from '@/ui/theme';
import AddExpenseModal from '@/components/finances/AddExpenseModal';
import { money, round2 } from '@/utils/money';
import { useQuickAdd, takeQuickAdd } from '@/services/quickAdd';
import ProductsModal from '@/components/finances/ProductsModal';
import TransactionsModal from '@/components/finances/TransactionsModal';
import WydatkiModal from '@/components/dashboard/WydatkiModal';
import BudgetSheet, { budgetLine } from '@/components/budgets/BudgetSheet';
import { useBudgetsStore } from '@/store/budgetsStore';
import { budgetStatuses, scopeLabel, type BudgetLevel } from '@/utils/budgets';
import { variableByCategory } from '@/utils/expenseCategory';
import { fixedByCategory } from '@/utils/fixedCategory';
import { useCategoriesVersion } from '@/store/categoriesStore';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useExpensesStore } from '@/store/expensesStore';
import { useShareReceiptStore } from '@/store/shareReceiptStore';
import { useWorkStore } from '@/store/workStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useSubscriptionsStore } from '@/store/subscriptionsStore';
import { workMonthProgress } from '@/utils/workMonth';
import { upcomingPayments } from '@/utils/recurringBills';
import { accountBalance, affectsBalance } from '@/utils/balance';
import { isOwnTransfer } from '@/utils/fixedVariable';
import { txDetail, txColor } from '@/utils/txGroup';
import { useBalanceStore } from '@/store/balanceStore';
import { useWydatkiData } from '@/hooks/useWydatkiData';
import { haptic } from '@/utils/haptics';
import { todayISO } from '@/utils/date';
import { pendingFxOf, formatFx } from '@/utils/fx';
import type { Expense } from '@/types/finances';

// Faza 3.10 (design/rn kit) — Finanse przebudowane na kitu's `src/ui/layout.tsx`
// prymitywy (Screen/Row/Tile/StatTile/Cap/FitList/Item/Price/StackBar), ten sam
// powód co Dashboard/Daily (ARCHITECTURE.md §"Faza 3.10"). Kolejność/spany 1:1 z
// design/app-design.html's `#fin` (`grid-template-rows: auto auto auto auto
// 1fr`): Saldo(4) → Podział(4, StackBar) → Jedzenie kategorie(4, StackBar) →
// Praca(2)|Najbliższa opłata(2) → Ostatnie transakcje(4, fill, FitList).
//
// Najbliższa opłata — REALNA od 2026-11-09 (user: "czy w sapp mozemy eksportować
// szablony te do łapania powiadomien i stałych... w kafelku w stałych opłatach
// zaznaczyć kiedy co musimy opłacić"), patrz `store/subscriptionsStore.ts` +
// `utils/recurringBills.ts`'s `nextDueSubscription` + `app/subscriptions.tsx`.
// `StatTile value={null}` (DESIGN.md's zaprojektowany stan pusty, "0" dim +
// "brak") teraz trafia tylko gdy user nie ma żadnej aktywnej stałej opłaty —
// wcześniej trafiał ZAWSZE, bo appka nie miała store'a "bills" w ogóle.
// Praca — REALNA od 2026-11-09 (user: "lecimy z zakładką Praca", "Pełny port z
// sapp od razu"), patrz app/work.tsx. Kafelek pokazuje stawkę zł/h aktywnego
// pracodawcy (`workStore.ts`), tap → pełny ekran.
//
// "Produkty"/"Pojazdy" (realne funkcje, NIE w spec) — od 2026-11-11 dwa małe
// kafle-przyciski po prawej od Salda (wcześniej malutkie linki pod `Cap`'em
// kafla "Jedzenie · kategorie", user: "bez sensu umiejscowione").
//
// FAB "+" (dodaj wydatek/przychód) — REALNA funkcja appki, nie część
// design/app-design.html (tam nie ma floating-button na Finansach, tylko na
// Zadaniach jako `.add` inline obok segmentu) — zostaje bez zmian, renderowana
// jako ostatnie dziecko `Screen` z `position:'absolute'` (w RN pozycjonuje się
// względem najbliższego rodzica-View niezależnie od jego własnego `position`).
//
// Popupy (AddExpenseModal/ProductsModal/TransactionsModal/WydatkiModal,
// balance-edit) BEZ ZMIAN — `AppBottomSheet` już od Fazy 3.8, kit nie ma
// odpowiednika popupów.
// "1 234,56 zł" → 1234.56 (sumy z wydatkiData są tekstem z groszami, utils/money.ts).
function parseZl(s: string): number {
  const v = parseFloat(s.replace(/[^\d,−-]/g, '').replace(',', '.').replace('−', '-'));
  return Number.isFinite(v) ? v : 0;
}
// Pasek kategorii: 6 największych + reszta szarą "inne" (było kilkanaście kolorów naraz).
function topParts(bars: { label: string; amount: number; color: string }[]) {
  const sorted = [...bars].sort((a, b) => b.amount - a.amount);
  const top = sorted.slice(0, 6).map((c) => ({ label: c.label, value: c.amount, color: c.color }));
  const rest = sorted.slice(6).reduce((a, c) => a + c.amount, 0);
  return rest > 0 ? [...top, { label: 'Inne', value: rest, color: '#3A3A3A' }] : top;
}
// "dziś 12:23" / "wczoraj 14:58" / "16.11" — data na liście ostatnich transakcji.
function txWhen(iso: string): string {
  const d = iso.slice(0, 10);
  const t = iso.length > 10 ? iso.slice(11, 16) : '';
  const now = new Date();
  const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const day = d === ymd(now) ? 'dziś' : d === ymd(y) ? 'wczoraj' : `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  return t ? `${day} ${t}` : day;
}
function fmtAmount(n: number): string {
  return money(Math.abs(n));
}
// "wypłata za listopad" — biernik = mianownik dla nazw miesięcy.
const PAY_MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
// "środa, 09.12" — data płatności na kaflu Stałych opłat.
function fmtDueDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${wd}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
}
function fmtHours(h: number): string {
  const r = Math.round(h * 2) / 2; // pół godziny dokładności wystarczy na kaflu
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}
function fmtBalance(n: number): string {
  return money(n);
}

export default function FinancesScreen() {
  const s = makeS();
  const expenses = useExpensesStore((st) => st.expenses);
  const [addOpen, setAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  // Wynik wyszukiwania (app/search.tsx) → otwórz ten wydatek do podglądu/edycji.
  const { expense: expenseParam } = useLocalSearchParams<{ expense?: string }>();
  useEffect(() => {
    if (!expenseParam) return;
    const e = useExpensesStore.getState().expenses.find((x) => x.id === expenseParam);
    if (e) setEditingExpense(e);
    router.setParams({ expense: undefined } as any);
  }, [expenseParam]);
  const [productsOpen, setProductsOpen] = useState(false);
  const [transactionsOpen, setTransactionsOpen] = useState(false);
  const [wydatkiOpen, setWydatkiOpen] = useState(false);
  const offset = useBalanceStore((st) => st.offset) ?? 0;
  const setOffset = useBalanceStore((st) => st.setOffset);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const balanceInputRef = useRef<TextInput>(null);

  // Udostępnienie paragonu przez Android Share Sheet (2026-11-09) — `_layout.tsx`'s
  // `useShareReceiptLaunch` drenuje natywnie zapisany tekst i odkłada go tu, bo to ten
  // ekran (nie layout) ma dostęp do `setAddOpen`/`AddExpenseModal`. Otwiera modal
  // automatycznie, zamiast czekać aż user sam tapnie FAB — to deep-linkowana reakcja na
  // JEGO własne "Udostępnij", nie zgadywanie jak `clipboardSuggestion` w modalu.
  // Skrót W na komputerze (services/quickAdd.ts).
  const quickAdd = useQuickAdd((st) => st.pending);
  useEffect(() => {
    if (takeQuickAdd('expense')) { setEditingExpense(null); setAddOpen(true); }
  }, [quickAdd]);
  const pendingShareText = useShareReceiptStore((st) => st.pendingText);
  useEffect(() => {
    if (pendingShareText) { setEditingExpense(null); setAddOpen(true); }
  }, [pendingShareText]);

  // "Praca" (2026-11-09, user: "lecimy z zakładką Praca") — kafelek pokazuje realną
  // stawkę zł/h aktywnego pracodawcy (`app/work.tsx` po pełny ekran). `null` zamiast 0
  // gdy brak aktywnego pracodawcy — `StatTile value={null}` już ma zaprojektowany stan
  // pusty, nie trzeba nowego.
  const workEmployers = useWorkStore((st) => st.employers);
  const activeEmployerId = useWorkStore((st) => st.activeEmployerId);
  const calendarEvents = useCalendarStore((st) => st.events);
  const gcalEvents = useCalendarStore((st) => st.gcalEvents);
  const activeEmployer = workEmployers.find((e) => e.id === activeEmployerId) ?? null;
  // 2026-11-11 (user: "więcej info w kafelku pracy... ile wypłaty przyszłej
  // oraz ile godzin przepracowanych z ilu oraz ile średnio na h") — kafel
  // pokazuje teraz najbliższą wypłatę + godziny X/Y + stawkę, wszystko z
  // `utils/workMonth.ts` (stawka nadal z `computeWorkRate`, jedna definicja).
  const work = useMemo(
    () => (activeEmployer ? workMonthProgress(activeEmployer, [...calendarEvents, ...gcalEvents], expenses) : null),
    [activeEmployer, calendarEvents, gcalEvents, expenses],
  );

  const today = todayISO();
  const now = useMemo(() => new Date(), [today]);
  const wydatkiData = useWydatkiData(expenses, now);

  // "Najbliższa opłata" — REALNA od 2026-11-09 (user: "czy w sapp mozemy
  // eksportować szablony te do łapania powiadomien i stałych... w kafelku w
  // stałych opłatach zaznaczyć kiedy co musimy opłacić"), patrz app/subscriptions.tsx
  // + utils/recurringBills.ts. `StatTile value={null}` (poprzedni, zaprojektowany
  // pusty stan — patrz komentarz wyżej przy Faza 3.10) teraz trafia tylko gdy
  // user nie ma jeszcze żadnej aktywnej stałej opłaty ANI rozpoznanego rachunku.
  //
  // ROZSZERZONE 2026-11-09 (user: "ta ostatnia platnosc najbliższą ma być
  // automatyczna po stałych i subskrypcjach łapać... ma przewidywać stałe kiedy
  // są") — pierwsza wersja czytała WYŁĄCZNIE ręcznie dodane Subskrypcje; teraz
  // `nextUpcomingPayment` dolicza też PRZEWIDYWANE terminy rachunków stałych
  // (czynsz/prąd/internet...) rozpoznanych z historii wydatków, bez potrzeby
  // zakładania im osobnej Subskrypcji.
  const subscriptions = useSubscriptionsStore((st) => st.subscriptions);
  const dismissedBills = useSubscriptionsStore((st) => st.dismissedBills);
  const upcoming = useMemo(() => upcomingPayments(expenses, subscriptions, now, dismissedBills), [expenses, subscriptions, now, dismissedBills]);
  const nextDue = upcoming[0] ?? null;
  // Ile KOLEJNYCH płatności w ciągu 30 dni po najbliższej — "+2 w 30 dni".
  const moreSoon = useMemo(() => upcoming.slice(1).filter((p) => p.daysUntil <= 30).length, [upcoming]);


  const balance = useMemo(() => accountBalance(expenses, offset), [expenses, offset]);
  const monthKey = today.slice(0, 7);
  const monthIncome = useMemo(
    () => expenses.filter((e) => e.type === 'income' && affectsBalance(e) && !isOwnTransfer(e) && e.date.slice(0, 7) === monthKey).reduce((a, e) => a + e.amount, 0),
    [expenses, monthKey],
  );
  const monthExpense = useMemo(
    () => expenses.filter((e) => e.type === 'expense' && affectsBalance(e) && !isOwnTransfer(e) && e.date.slice(0, 7) === monthKey).reduce((a, e) => a + e.amount, 0),
    [expenses, monthKey],
  );

  const openEditBalance = () => { setBalanceInput(balance.toFixed(2)); setEditingBalance(true); };
  const saveBalance = async () => {
    const real = parseFloat(balanceInput.replace(',', '.'));
    if (isFinite(real)) {
      haptic.success();
      const netWithoutOffset = balance - offset;
      const newOffset = real - netWithoutOffset;
      setOffset(newOffset);
    }
    setEditingBalance(false);
  };

  const recent = useMemo(
    () => [...expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [expenses],
  );
  // Płatności w obcej walucie bez kwoty PLN (2026-11-11) — widoczny licznik w
  // nagłówku "Ostatnich transakcji", stuknięcie otwiera najstarszą do
  // uzupełnienia (po zapisie licznik spada, kolejne stuknięcie → następna).
  const pendingFx = useMemo(
    () => expenses.filter((e) => pendingFxOf(e)).sort((a, b) => a.date.localeCompare(b.date)),
    [expenses],
  );

  const splitTotal = useMemo(
    () => round2(parseZl(wydatkiData.fixed.total) + parseZl(wydatkiData.food.total) + parseZl(wydatkiData.variable.total)),
    [wydatkiData],
  );
  const split = useMemo(() => {
    const fixed = parseZl(wydatkiData.fixed.total);
    const food = parseZl(wydatkiData.food.total);
    const variable = parseZl(wydatkiData.variable.total);
    // `Math.max(…, 0.001)` TYLKO dla proporcji słupka (StackBar dzieli szerokość
    // przez `value` — zero zniknęłoby zamiast dać 3px minimum z DESIGN.md), NIE
    // dla `splitTotal` wyżej (ten pokazuje PRAWDZIWĄ sumę, nie podłogę 0,001 ×3).
    return [
      { value: Math.max(fixed, 0.001), color: C.txt, label: 'Stałe' },
      { value: Math.max(food, 0.001), color: '#8A8A8A', label: 'Jedzenie' },
      { value: Math.max(variable, 0.001), color: '#3F3F3F', label: 'Zmienne' },
    ];
  }, [wydatkiData]);

  // Budżety (2026-11-13): najpilniejsze 3 na kafelku, reszta i ustawienia w sheecie.
  const budgets = useBudgetsStore((st) => st.budgets);
  const budgetStats = useMemo(() => budgetStatuses(budgets, expenses, now), [budgets, expenses, now]);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetSelId, setBudgetSelId] = useState<string | null>(null);
  const budSel = budgetStats.find((b) => b.budget.id === budgetSelId) ?? budgetStats[0] ?? null;
  // Zakładka popupu Wydatki: "Podział" → Stałe, kafel Zmienne · kategorie → Zmienne.
  const [wydatkiTab, setWydatkiTab] = useState<'fixed' | 'variable' | 'food'>('fixed');

  const catVersion = useCategoriesVersion();
  const varCats = useMemo(() => variableByCategory(expenses, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`), [expenses, now, catVersion]);
  const fixedCats = useMemo(() => fixedByCategory(expenses, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`), [expenses, now, catVersion]);
  const incomeCats = useMemo(() => incomeByCategory(expenses, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`), [expenses, now]);
  const [catTab, setCatTab] = useState<'food' | 'fixed' | 'variable' | 'income'>('food');
  const [trendOpen, setTrendOpen] = useState(false);
  const foodCats = wydatkiData.food.categories;
  const catBars = catTab === 'food' ? foodCats : catTab === 'fixed' ? fixedCats : catTab === 'income' ? incomeCats : varCats;

  return (
    <Screen
      title="Finanse"
      right={(
        <Text style={T.small} numberOfLines={1}>
          {wydatkiData.month.toUpperCase()} · {now.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()} {now.getFullYear()}
        </Text>
      )}
    >
      {/* Saldo na 3 kolumny + po prawej Produkty/Pojazdy (2026-11-11, user: "w
          JEDZENIE KATEGORIE w kafelku są randomowo PRODUKTY I POJAZDY bez sensu...
          już wolę po prawej skrócić kafelek SUMY KONTA i po prawej zrobić dwa
          przyciski"). Wcześniej dwa malutkie linki pod nagłówkiem kafla Jedzenia —
          ani nie pasowały tematycznie (Pojazdy ≠ jedzenie), ani nie dało się w
          nie wygodnie trafić. Kolumna bez własnej szerokości: dwa `Tile span={1}`
          ją wyznaczają, `alignItems:'stretch'` Row'a daje jej wysokość Salda. */}
      <Row>
        <Tile span={3} onPress={openEditBalance}>
          <Cap l="Saldo" r="stuknij, by ustawić" />
          <FitText style={T.numXl} numberOfLines={1} minimumFontScale={0.6}>{fmtBalance(balance)} <Text style={s.balanceCur}>PLN</Text></FitText>
          <View style={s.balanceSumRow}>
            <Text style={s.balanceIn}>+{fmtAmount(monthIncome)}</Text>
            <Text style={s.balanceOut}>−{fmtAmount(monthExpense)}</Text>
          </View>
        </Tile>
        <View style={s.sideCol}>
          <Tile span={1} center style={s.sideBtn} onPress={() => setProductsOpen(true)} accessibilityLabel="Produkty">
            <Package size={19} color={C.txt} />
          </Tile>
          <Tile span={1} center style={s.sideBtn} onPress={() => router.push('/vehicles')} accessibilityLabel="Pojazdy">
            <Car size={19} color={C.txt} />
          </Tile>
          {/* Wymiany domowe (2026-11-13): filtry, końcówki szczoteczki… — zakupy z
              paragonów podpowiadają wymianę, stąd przy Finansach (jak Pojazdy). */}
          <Tile span={1} center style={s.sideBtn} onPress={() => router.push('/replacements' as any)} accessibilityLabel="Wymiany">
            <RefreshCw size={19} color={C.txt} />
          </Tile>
        </View>
      </Row>

      <Row>
        <Tile span={4} onPress={() => { setWydatkiTab('fixed'); setWydatkiOpen(true); }}>
          <Cap l="Podział" r={`${money(splitTotal)} PLN`} />
          <View style={s.barSpace}>
            <StackBar parts={split} height={10} />
          </View>
        </Tile>
      </Row>

      {/* Budżety (2026-11-17, user: "jak kategorie niżej — przełączam między limitami,
          wypełnienie pigułki kolorem, czy przekroczyłem; szczegóły dopiero po wejściu; teraz
          każdy kolejny limit wypycha Ostatnie transakcje w dół, a czerwony za bardzo krzyczy").
          Stała wysokość: pigułki (tło = % limitu) + jedna linijka wybranego. */}
      <Row>
        <Tile span={4} onPress={() => { haptic.tap(); setBudgetOpen(true); }}>
          {budgetStats.length === 0 ? (
            <>
              <Cap l="Budżet" r="ustaw limit" />
              <Text style={[T.small, s.emptyInline]}>Limit na jedzenie, słodycze, zmienne albo kategorię — ile zostało na dzień</Text>
            </>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.budChips} style={{ flexGrow: 0, flexShrink: 0 }}>
                {budgetStats.map((b) => {
                  const on = b.budget.id === budSel?.budget.id;
                  return (
                    <TouchableOpacity key={b.budget.id} onPress={() => { haptic.tap(); setBudgetSelId(b.budget.id); }} style={[s.budChip, on && s.budChipOn]} activeOpacity={0.8}>
                      <View style={[s.budFill, { width: `${Math.min(100, b.pct * 100)}%`, backgroundColor: budTint(b.level) }]} />
                      <Text style={[s.budChipTxt, on && s.budChipTxtOn]} numberOfLines={1}>{scopeLabel(b.budget.scope)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {budSel && (
                <View style={s.budLine}>
                  <Text style={s.budAmt}>{money(budSel.spent)}<Text style={s.budgetOf}> / {money(budSel.budget.limit)} zł</Text></Text>
                  <Text style={[s.budgetLine, { flex: 1, textAlign: 'right' }, budSel.left < 0 && { color: C.warnTxt }]} numberOfLines={1}>
                    {budgetLine(budSel)} · {budSel.daysLeft} dni
                  </Text>
                </View>
              )}
            </>
          )}
        </Tile>
      </Row>

      {/* Kategorie (2026-11-14, user: "3 główne JEDZENIE, STAŁE, ZMIENNE i one na
          mniejsze") — jeden kafel z przełącznikiem zamiast osobnych kafli. */}
      <Row>
        <Tile span={4}>
          <View style={s.catHead}>
            {(['food', 'fixed', 'variable', 'income'] as const).map((k) => (
              <TouchableOpacity key={k} onPress={() => { haptic.tap(); setCatTab(k); }} hitSlop={6} style={[s.catTab, catTab === k && s.catTabOn]}>
                <Text style={[s.catTabLabel, catTab === k && s.catTabLabelOn]}>{k === 'food' ? 'Jedzenie' : k === 'fixed' ? 'Stałe' : k === 'income' ? 'Wpływy' : 'Zmienne'}</Text>
              </TouchableOpacity>
            ))}
            <Text style={s.catTotal}>{money(catBars.reduce((a2, c) => a2 + c.amount, 0))} PLN</Text>
            <TouchableOpacity onPress={() => { haptic.tap(); setTrendOpen(true); }} hitSlop={8} style={s.trendBtn} accessibilityLabel="Trend 12 miesięcy">
              <TrendingUp size={15} color={C.mut} />
            </TouchableOpacity>
          </View>
          {catBars.length === 0 ? (
            <Text style={[T.small, s.emptyInline]}>Brak w tym miesiącu</Text>
          ) : (
            <TouchableOpacity onPress={() => { if (catTab === 'income') setTrendOpen(true); else { setWydatkiTab(catTab); setWydatkiOpen(true); } }} activeOpacity={0.7} style={s.barSpace}>
              <StackBar parts={topParts(catBars)} height={10} legendMax={3} />
            </TouchableOpacity>
          )}
        </Tile>
      </Row>

      <Row>
        <Tile span={2} onPress={() => { haptic.tap(); router.push('/work'); }}>
          <Cap l="Praca" r={work?.rate != null ? `${money(work.rate)} zł/h` : undefined} />
          {!work ? (
            <Text style={[T.small, s.workEmpty]}>Dodaj pracodawcę</Text>
          ) : (
            <>
              <FitText style={[T.num, s.workPay, !work.nextPay && { color: C.dim }]} numberOfLines={1} minimumFontScale={0.45}>
                {work.nextPay ? `≈${money(work.nextPay.amount)}` : '—'}
                <Text style={s.workPayCur}> zł</Text>
              </FitText>
              <Text style={s.workSub} numberOfLines={1}>
                {work.nextPay ? `wypłata za ${PAY_MONTHS[Number(work.nextPay.month.slice(5, 7)) - 1]}` : 'brak stawki'}
              </Text>
              {work.hoursPlanned != null && work.hoursDone != null && (
                <View style={s.workHours}>
                  <View style={s.workTrack}>
                    <View style={[s.workFill, { width: `${work.hoursPlanned > 0 ? Math.min(100, (work.hoursDone / work.hoursPlanned) * 100) : 0}%` }]} />
                  </View>
                  <Text style={s.workHoursText} numberOfLines={1}>
                    {fmtHours(work.hoursDone)} / {fmtHours(work.hoursPlanned)} h
                  </Text>
                </View>
              )}
            </>
          )}
        </Tile>
        {/* 2026-11-11 (user: "żeby pisało ile dni, jaka data... taki jak z pracą
            kafelek, żeby więcej informacji było") — ten sam układ co Praca obok:
            nazwa w nagłówku (+ "z historii" dla przewidywanych z wydatków),
            duże dni, data z dniem tygodnia, kwota + ile kolejnych w 30 dni. */}
        <Tile span={2} onPress={() => { haptic.tap(); router.push('/subscriptions'); }}>
          <Cap l={nextDue ? nextDue.name : 'Najbliższa opłata'} r={nextDue?.kind === 'bill' ? 'z historii' : undefined} />
          {!nextDue ? (
            <Text style={[T.small, s.workEmpty]}>Brak stałych opłat</Text>
          ) : (
            <>
              <Text style={[T.num, s.workPay]} numberOfLines={1}>
                {nextDue.daysUntil <= 0 ? 'dziś' : nextDue.daysUntil === 1 ? 'jutro' : nextDue.daysUntil}
                {nextDue.daysUntil > 1 && <Text style={s.workPayCur}> dni</Text>}
              </Text>
              <Text style={s.workSub} numberOfLines={1}>{fmtDueDate(nextDue.dueDate)}</Text>
              <View style={s.dueFoot}>
                <Text style={[s.workHoursText, nextDue.fx && { color: C.warn }]} numberOfLines={1}>
                  {nextDue.fx ? formatFx(nextDue.fx) : `${fmtAmount(nextDue.amount)} zł`}
                </Text>
                {moreSoon > 0 && <Text style={s.workSub} numberOfLines={1}>+{moreSoon} w 30 dni</Text>}
              </View>
            </>
          )}
        </Tile>
      </Row>

      <Row flex={1}>
        <Tile span={4}>
          <TouchableOpacity
            style={s.capRow}
            onPress={() => setTransactionsOpen(true)}
            activeOpacity={0.6}
            disabled={expenses.length === 0}
          >
            <Text style={T.cap}>Ostatnie transakcje</Text>
            {pendingFx.length > 0 && (
              <TouchableOpacity
                style={s.fxBadge}
                onPress={() => { haptic.tap(); setEditingExpense(pendingFx[0]); }}
                hitSlop={6}
                activeOpacity={0.7}
                accessibilityLabel="Uzupełnij kwotę w PLN"
              >
                <Text style={s.fxBadgeText}>
                  {pendingFx.length === 1 ? `${formatFx(pendingFxOf(pendingFx[0])!)} → wpisz PLN` : `${pendingFx.length} w obcej walucie → wpisz PLN`}
                </Text>
              </TouchableOpacity>
            )}
            {expenses.length > 0 && (
              <View style={s.seeAllRow}>
                <Text style={T.capR}>wszystkie</Text>
                <ChevronRight size={12} color={C.mut} />
              </View>
            )}
          </TouchableOpacity>
          <FitList
            data={recent}
            emptyText="Brak transakcji — dodaj pierwszą przyciskiem +"
            renderItem={(e) => (
              // Wiersz jak w liście Transakcji (2026-11-17, user: "coś mi nie gra z Finansami"):
              // bez białej pigułki i surowej daty ISO — pasek kubła, nazwa, co w środku, kwota.
              <Item onPress={() => setEditingExpense(e)}>
                <View style={[s.txBar, { backgroundColor: txColor(e) }]} />
                <View style={s.txTextCol}>
                  <Text style={T.row} numberOfLines={1}>{e.storeName || e.note || (isOwnTransfer(e) ? 'Przelew własny' : e.type === 'income' ? 'Przychód' : 'Wydatek')}</Text>
                  <Text style={T.rowSub} numberOfLines={1}>{[txWhen(e.date), txDetail(e)].filter(Boolean).join(' · ')}</Text>
                </View>
                {pendingFxOf(e) ? <Price amount={0} fx={pendingFxOf(e)} /> : (
                  <Text style={[s.txAmt, e.type === 'income' && { color: C.ok }, isOwnTransfer(e) && { color: C.mut }]}>
                    {e.type === 'income' ? '+' : '−'}{money(e.amount)}
                  </Text>
                )}
              </Item>
            )}
          />
        </Tile>
      </Row>

      <TouchableOpacity
        style={s.fab}
        onPress={() => { haptic.tap(); setAddOpen(true); }}
        activeOpacity={0.8}
        accessibilityLabel="Nowy wydatek lub przychód"
      >
        <Plus size={22} color={C.bg} />
      </TouchableOpacity>

      <LazyMount visible={addOpen || !!editingExpense}>
        <AddExpenseModal
          visible={addOpen || !!editingExpense}
          onClose={() => { setAddOpen(false); setEditingExpense(null); }}
          editingExpense={editingExpense}
          initialPasteText={pendingShareText}
          onInitialPasteTextConsumed={() => useShareReceiptStore.getState().clear()}
        />
      </LazyMount>
      <LazyMount visible={trendOpen}>
        <TrendSheet visible={trendOpen} onClose={() => setTrendOpen(false)} initial={catTab} />
      </LazyMount>
      <LazyMount visible={budgetOpen}>
        <BudgetSheet visible={budgetOpen} onClose={() => setBudgetOpen(false)} />
      </LazyMount>
      <LazyMount visible={productsOpen}>
        <ProductsModal visible={productsOpen} onClose={() => setProductsOpen(false)} />
      </LazyMount>
      <LazyMount visible={transactionsOpen}>
        <TransactionsModal
          visible={transactionsOpen}
          onClose={() => setTransactionsOpen(false)}
          expenses={expenses}
          onSelect={(e) => setEditingExpense(e)}
        />
      </LazyMount>
      <LazyMount visible={wydatkiOpen}>
        <WydatkiModal
          visible={wydatkiOpen}
          onClose={() => setWydatkiOpen(false)}
          initialTab={wydatkiTab}
          expenses={expenses}
          today={now}
          onEditExpense={(e) => setEditingExpense(e)}
        />
      </LazyMount>

      <AppBottomSheet visible={editingBalance} onClose={() => setEditingBalance(false)} scrollable={false} initialFocusRef={balanceInputRef}>
        <View style={s.editCard}>
          <Text style={s.editTitle}>Ustaw aktualne saldo</Text>
          <Text style={s.editHint}>Tyle realnie masz teraz na koncie — appka doliczy od tego wszystkie kolejne wydatki/przychody kartą.</Text>
          <View style={s.editInputRow}>
            <TextInput
              ref={balanceInputRef}
              value={balanceInput}
              onChangeText={setBalanceInput}
              keyboardType="decimal-pad"
              style={s.editInput}
              onSubmitEditing={saveBalance}
            />
            <Text style={s.editCurrency}>zł</Text>
          </View>
          <View style={s.editActions}>
            <TouchableOpacity onPress={() => setEditingBalance(false)} style={s.editCancelBtn}>
              <Text style={s.editCancelLabel}>Anuluj</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveBalance} style={s.editSaveBtn}>
              <Text style={s.editSaveLabel}>Zapisz</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AppBottomSheet>
    </Screen>
  );
}

// Wypełnienie pigułki budżetu = % limitu, stonowane (user: "czerwony za bardzo się rzuca").
const budTint = (level: BudgetLevel) => (level === 'over' ? 'rgba(239,68,68,0.30)' : level === 'warn' || level === 'pace' ? 'rgba(251,146,60,0.26)' : 'rgba(214,214,214,0.14)');

const makeS = themedStyles((c) => StyleSheet.create({
  capRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  fxBadge: { flexShrink: 1, marginHorizontal: 8, borderWidth: 1, borderColor: C.warn, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  fxBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: C.warn },

  balanceCur: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.mut },
  balanceSumRow: { flexDirection: 'row', gap: spacing[4], marginTop: spacing[2] },
  balanceIn: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.ok },
  balanceOut: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.mut },

  barSpace: { marginTop: spacing[3] },
  sideCol: { gap: S.gap },
  budChips: { gap: 6, paddingRight: 4 },
  budChip: { overflow: 'hidden', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: C.in, borderWidth: 1, borderColor: 'transparent' },
  budChipOn: { borderColor: C.txt },
  budFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  budChipTxt: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: C.mut },
  budChipTxtOn: { color: C.hi },
  budLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10 },
  budAmt: { fontSize: 15, fontFamily: 'Inter_900Black', color: C.hi, fontVariant: ['tabular-nums'] },
  budgetOf: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.mut },
  budgetLine: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: C.mut },
  sideBtn: { flex: 1, padding: 4, gap: 2 },
  emptyInline: { textAlign: 'center', marginTop: spacing[3] },

  workEmpty: { marginTop: spacing[3] },
  workPay: { marginTop: spacing[2] },
  workPayCur: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.mut, letterSpacing: 0 },
  workSub: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: C.mut, marginTop: 2 },
  workHours: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[2] },
  workTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.in2, overflow: 'hidden' },
  workFill: { height: 4, borderRadius: 2, backgroundColor: C.hi },
  dueFoot: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginTop: spacing[2] },
  workHoursText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: C.txt, fontVariant: ['tabular-nums'] },

  txTextCol: { flex: 1, minWidth: 0 },
  txBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginVertical: 2 },
  txAmt: { fontSize: 13, fontFamily: 'Inter_900Black', color: C.hi, fontVariant: ['tabular-nums'] },

  fab: {
    position: 'absolute', right: spacing[4], bottom: spacing[4],
    width: 52, height: 52, borderRadius: radius.full, backgroundColor: C.hi,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 6,
  },

  editCard: { gap: spacing[2] },
  editTitle: { fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.primary },
  editHint: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted, lineHeight: 16 },
  editInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], marginTop: spacing[1],
  },
  editInput: { flex: 1, fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.bright, paddingVertical: spacing[2] },
  editCurrency: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.muted },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[1] },
  editCancelBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  editCancelLabel: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  editSaveBtn: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.md, backgroundColor: c.text.bright },
  editSaveLabel: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  catTab: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  catTabOn: { backgroundColor: C.txt },
  catTabLabel: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: C.mut },
  catTabLabelOn: { color: C.bg },
  catTotal: { marginLeft: 'auto', fontSize: 10, fontFamily: 'Inter_700Bold', color: C.mut },
  trendBtn: { marginLeft: 8, padding: 2 },
}));
