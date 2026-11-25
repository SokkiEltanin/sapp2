import { receiptSavings, applyReceiptDiscount, parseDiscountInput } from '@/utils/receiptDiscount';
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { X, Receipt, Banknote, ArrowLeftRight, ClipboardPaste, Plus, Trash2, CalendarDays, Fuel } from 'lucide-react-native';
import { openPicker } from '@/services/picker';
import { colors } from '@/theme/colors';
import { todayISO, ymd } from '@/utils/date';
import { parseReceiptText } from '@/utils/receiptParser';
import { useExpensesStore } from '@/store/expensesStore';
import { useDeferredMemo } from '@/hooks/useDeferredMemo';
import {
  loadNameAliases,
  canonicalProductName,
  loadFoodSubcatMemory,
  applyFoodSubcatMemory,
  loadPriceMemory,
  savePriceMemory,
  saveFoodSubcatMemory,
  type PriceMemory,
} from '@/utils/productMemory';
import { saveMerchant } from '@/utils/merchantMemory';
import { guessMealSubcat } from '@/utils/food';
import { bucketOf as bucketOfExpense } from '@/utils/fixedVariable';
import { storeMatchOf, applyRulesToAll } from '@/utils/categoryRules';
import { useCategoryRulesStore } from '@/store/categoryRulesStore';
import { offerUndo } from '@/services/undo';
import { useCategoriesVersion } from '@/store/categoriesStore';
import { findReceiptTarget, isConfidentReceiptMatch, mergeReceiptInto } from '@/utils/duplicateExpense';
import { buildProductCatalog } from '@/utils/productCatalog';
import { haptic } from '@/utils/haptics';
import type { Expense, ReceiptItem, PaymentMethod, FvOverride } from '@/types/finances';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import ReceiptItemRow from './ReceiptItemRow';
import FuelSheet from '@/components/vehicles/FuelSheet';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { looksLikeFuel, expenseMatchesVehicle, mainCarId } from '@/utils/vehicleMatch';
import { vehicleHasFuel, type Vehicle } from '@/types/vehicles';
import { zl } from '@/utils/money';

import { makeS } from './addExpenseStyles';
import { genId, round2, looksLikeReceiptText, fmtDatePill, fmtDateBadge, type Panel } from './addExpenseParts';
import ExpenseDetails from './ExpenseDetails';

// "Jeden ujednolicony dodaj" (ARCHITECTURE.md §FINANSE, decyzja 2026-10-26) — PASTE
// paragonu i RĘCZNE dodawanie pozycji nie są dwoma osobnymi ekranami (jak w sapp:
// scan.tsx vs manual.tsx), tylko JEDNĄ listą pozycji: paste ją wypełnia automatycznie,
// "+ Dodaj pozycję" dopisuje ręcznie — oba na tym samym, wspólnym `ReceiptItemRow`.
// Brak pozycji wcale → pole "Kwota" odkrywa się jako zwykły szybki wydatek (czynsz,
// paliwo) bez rozbijania na produkty — user nie jest zmuszony do paragonu, żeby
// zapisać jedną liczbę.
//
// Przebudowany na `AppBottomSheet` (2026-11-02): tytuł+usuń/zamknij jako `header`, kwota+"Zapisz"
// jako `footer`. Układ od 2026-11-23 (user: "za dużo napisów, chaos — lepiej jeden przycisk, który
// się rozsuwa"): sklep + pigułka daty → kwota (gdy brak pozycji) → paragon (Wklej / + Pozycja,
// pozycje w jednej linii, stuknięcie = edycja) → rząd pigułek szczegółów (Rozlicz, Kategoria/
// Jedzenie, Ja · Karta, notatka, tagi) z JEDNYM otwartym panelem pod spodem.
export default function AddExpenseModal({
  visible, onClose, editingExpense, initialPasteText, onInitialPasteTextConsumed,
}: {
  visible: boolean;
  onClose: () => void;
  // Edycja istniejącej transakcji (2026-11-01, user: "jak klikam w finanse w
  // wydatek to nie ma edycji" — ten sam modal co dodawanie, tylko wstępnie
  // wypełniony i zapisujący przez `updateExpense`, zero duplikacji formularza.
  editingExpense?: Expense | null;
  // Udostępnienie paragonu przez Android Share Sheet (2026-11-09) — w
  // przeciwieństwie do `clipboardSuggestion` (zgadywanie, zawsze z banerem do
  // potwierdzenia) to jest JUŻ wyraźna, celowa akcja usera ("Udostępnij" → appka),
  // więc parsuje się od razu, bez pytania. Rodzic (`finances.tsx`) przekazuje tekst
  // wydrenowany przez `useShareReceiptLaunch.ts` i czyści go w swoim store po
  // skonsumowaniu, żeby nie sparsować tego samego tekstu drugi raz przy
  // następnym otwarciu modala.
  initialPasteText?: string | null;
  onInitialPasteTextConsumed?: () => void;
}) {
  const s = makeS();
  const expenses = useExpensesStore((st) => st.expenses);
  const addExpense = useExpensesStore((st) => st.addExpense);
  const updateExpense = useExpensesStore((st) => st.updateExpense);
  useCategoriesVersion(); // nazwy/kolory kategorii z Ustawień
  const deleteExpense = useExpensesStore((st) => st.deleteExpense);

  // Pamięć produktowa (Faza 2.1, dotąd nieużywana — zamykany gap z Faza 2.2, user:
  // "wpisuję nazwę... sugeruje... klikam, cena się uzupełnia"). Wczytywana raz na
  // otwarcie modala: aliasy nazw (2026-10-31 scalenia z `ProductsModal`), pamięć
  // podkategorii jedzenia, pamięć cen (anomalie w `ReceiptItemRow`), znane nazwy
  // (katalog, do `suggestSimilarName` w `ReceiptItemRow`).
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [priceMemory, setPriceMemory] = useState<PriceMemory>({});
  const [foodSubcatMemory, setFoodSubcatMemory] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!visible) return;
    loadNameAliases().then(setAliases);
    loadPriceMemory().then(setPriceMemory);
    loadFoodSubcatMemory().then(setFoodSubcatMemory);
  }, [visible]);
  // Katalog nazw (podpowiedzi przy wpisywaniu pozycji) — po animacji otwarcia.
  const knownNames = useDeferredMemo(() => buildProductCatalog(expenses, aliases).map((p) => p.label), [expenses, aliases], [] as string[]);

  const [type, setType] = useState<'expense' | 'income'>('expense');
  // Przelew własny (2026-11-16, user: "ma się nie liczyć do wydatków, kategorii, ale liczyć
  // się do sumy całkowitej"): między MOIMI kontami. Zapis = type wg kierunku (wychodzący =
  // 'expense', przychodzący = 'income') + fvOverride 'transfer' → saldo się zmienia
  // (utils/balance.ts), statystyki/kategorie/budżety go pomijają (isOwnTransfer).
  const [own, setOwn] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [usedPaste, setUsedPaste] = useState(false);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [parsedTotal, setParsedTotal] = useState(0);
  const [storeName, setStoreName] = useState('');
  const [note, setNote] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [date, setDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [payer, setPayer] = useState<'me' | 'partner'>('me');
  // Jeden otwarty panel naraz (2026-11-23): wklejka albo jedna z pigułek szczegółów.
  const [panel, setPanel] = useState<Panel | null>(null);
  const togglePanel = (p: Panel) => { haptic.tap(); setPanel((cur) => (cur === p ? null : p)); };
  // Rozwinięta pozycja paragonu (reszta w jednej linii).
  const [openItem, setOpenItem] = useState<number | null>(null);
  // 2026-11-09, user: "ten parser paragonu miejsce wklejania tekstu moze być
  // mniejsze albo wgle pominięte" — pole ręcznego wklejania jest TYLKO ścieżką
  // zapasową (FAB "wklej ze schowka" w stopce to droga główna, jedno
  // tapnięcie), a mimo to zajmowało stałe miejsce na samej górze formularza
  // za każdym razem. Zwinięte domyślnie, ten sam wzorzec co "Zapłacono" niżej.
  const [fvChoice, setFvChoice] = useState<FvOverride | 'auto'>('auto');
  // Kategoria CAŁEGO wydatku (2026-11-10, user: "żeby były na przykład
  // rozrywka i tak dalej") — niezależna od `fvChoice` (Rozlicz jako), ten
  // sam zwinięty-domyślnie wzorzec co "Rozlicz jako"/"Zapłacono", rzadko
  // zmieniane pole nie zasługuje na stałe miejsce.
  const [expenseCategory, setExpenseCategory] = useState<string | undefined>(undefined);
  // Rodzaj jedzenia całego wydatku (2026-11-18) — gdy wydatek liczy się jako Jedzenie
  // i nie ma pozycji paragonu: zamiast kategorii Zmiennych wybór z FOOD_SUBCATS.
  const [foodSubcat, setFoodSubcat] = useState<string | undefined>(undefined);
  const [ruleSaved, setRuleSaved] = useState<string | null>(null);
  const [ownRuleInfo, setOwnRuleInfo] = useState<string | null>(null);
  const [incomeCategory, setIncomeCategory] = useState<string | undefined>(undefined);
  const ruleMatch = storeMatchOf({ storeName, note });
  // Ostrzeżenie o możliwym duplikacie (2026-11-11, user: "jak dodałem z
  // opóźnieniem paragon to mi nie złapało że to ta sama suma i dzień") —
  // pierwszy tap "Zapisz" na NOWYM wydatku tylko WYKRYWA i blokuje zapis,
  // pokazując ostrzeżenie; drugi tap (przycisk w banerze) faktycznie
  // zapisuje — `handleSave` sam sprawdza `duplicateOf`, patrz niżej.
  const [duplicateOf, setDuplicateOf] = useState<Expense | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  // 2026-11-09, user wybrał "auto-wykrywanie przy otwarciu" zamiast polegania
  // WYŁĄCZNIE na FAB-ie "wklej ze schowka" — przy KAŻDYM świeżym otwarciu (nie
  // edycji — tam schowek nie ma znaczenia) appka sama zerka w schowek; jeśli
  // wygląda jak paragon, pokazuje baner z opcją "Rozpoznaj" zamiast czekać aż
  // user sam to zauważy i tapnie FAB-a.
  const [clipboardSuggestion, setClipboardSuggestion] = useState<string | null>(null);
  useEffect(() => {
    if (!visible || editingExpense) { setClipboardSuggestion(null); return; }
    // Brak dostępu do schowka (odmowa/OS) = po prostu brak podpowiedzi, nie błąd.
    Clipboard.getStringAsync().then((text) => {
      if (text && looksLikeReceiptText(text)) setClipboardSuggestion(text);
    }).catch(() => {});
  }, [visible, editingExpense]);

  const reset = () => {
    setType('expense'); setOwn(false); setPasteText('');  setUsedPaste(false); setItems([]); setParsedTotal(0);
    setStoreName(''); setNote(''); setAmountInput(''); setDate(todayISO()); setPaymentMethod('card');
    setPayer('me'); setPanel(null); setOpenItem(null);
    setFvChoice('auto'); setExpenseCategory(undefined); setIncomeCategory(undefined);
    setFoodSubcat(undefined);
    setTags([]); setTagInput(''); setClipboardSuggestion(null); setDuplicateOf(null);
  };

  // Wypełnienie formularza przy otwarciu w trybie edycji — `editingExpense` jest
  // propem rodzica, więc to NIE konflikt z `reset()` (woła tylko `handleClose`,
  // który i tak zamyka modal — rodzic czyści swój `editingExpense` osobno).
  useEffect(() => {
    if (!visible || !editingExpense) return;
    setType(editingExpense.type);
    setOwn(editingExpense.fvOverride === 'transfer');
    setItems(editingExpense.receiptItems ?? []);
    setStoreName(editingExpense.storeName ?? '');
    setNote(editingExpense.note ?? '');
    // Puste (nie "0,00") gdy czeka na przeliczenie (2026-11-09) — placeholder
    // "0,00" wtedy czytelnie zaprasza do wpisania, zamiast wyglądać jak już
    // wypełnione zerowe pole.
    setAmountInput(editingExpense.originalCurrency ? '' : editingExpense.amount.toFixed(2));
    setDate(editingExpense.date);
    setPaymentMethod(editingExpense.paymentMethod ?? 'card');
    setPayer(editingExpense.payer ?? 'me');
    setFvChoice(editingExpense.fvOverride && editingExpense.fvOverride !== 'transfer' ? editingExpense.fvOverride : 'auto');
    setExpenseCategory(editingExpense.expenseCategory);
    setFoodSubcat(editingExpense.foodSubcat);
    setIncomeCategory(editingExpense.incomeCategory);
    setTags(editingExpense.tags ?? []);
    setUsedPaste(editingExpense.source === 'receipt');
    setPanel(null); setOpenItem(null);
  }, [visible, editingExpense]);

  const handleClose = () => { reset(); onClose(); };

  const handleDelete = () => {
    if (editingExpense) {
      const gone = editingExpense;
      deleteExpense(gone.id);
      // "Cofnij" (2026-11-14) — przywraca ten sam wydatek (to samo id, nowszy
      // updatedAt → synchronizacja odtworzy go też na komputerze).
      offerUndo(`Usunięto: ${gone.storeName || gone.note || zl(gone.amount)}`, () => {
        const st = useExpensesStore.getState();
        if (st.expenses.some((e) => e.id === gone.id)) return;
        useExpensesStore.setState({ expenses: [...st.expenses, { ...gone, updatedAt: new Date().toISOString() }] });
      });
    }
    handleClose();
  };

  // Rdzeń rozpoznawania, wspólny dla ręcznego "Rozpoznaj" i szybkiej wklejki ze
  // schowka (baner "Wykryto możliwy paragon") i wklejki do pola — żeby nie duplikować logiki.
  // Pamięć nauczona z poprzednich paragonów podpięta TUTAJ (nie było jej wcale w
  // Fazie 2.2): `canonicalProductName` naprawia nazwę przez znane aliasy/marki
  // (np. "jezykicherry" → "Jeżyki") OD RAZU, bez pytania — to są TWARDE zasady,
  // nie niepewne sugestie. `applyFoodSubcatMemory` to tylko FALLBACK dla pozycji,
  // których słownik słów-kluczowych (`receiptParser.ts`) nie rozpoznał wcale —
  // nigdy nie nadpisuje trafienia, które parser już znalazł.
  const runParse = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const r = parseReceiptText(trimmed);
    const names = r.items.map((it) => canonicalProductName(it.name, aliases));
    const fallbackSubcats = applyFoodSubcatMemory(names, foodSubcatMemory);
    setItems(r.items.map((it, i) => ({
      ...it,
      name: names[i],
      foodSubcat: it.foodSubcat ?? fallbackSubcats[i],
      excluded: it.suspect ?? false,
    })));
    if (r.storeName) setStoreName(r.storeName);
    if (r.date) setDate(r.date);
    setParsedTotal(r.total);
    setPaymentMethod(r.paymentMethod);
    setUsedPaste(true);
    setOpenItem(null);
  };
  const handleParse = () => { runParse(pasteText); setPanel(null); };

  // Wklejenie do pola = od razu rozpoznanie i zwinięcie pola (2026-11-22, user: "po wklejeniu
  // zakładka niech się zwija, teraz muszę scrollować w dół, żeby zaakceptować"). Wklejka =
  // tekst urósł naraz o ≥ 30 znaków i ma co najmniej 2 linie; pisanie ręczne dalej przez
  // "Rozpoznaj paragon". Pływający przycisk "wklej ze schowka" usunięty (user: "nigdy nie
  // używałem").
  const onPasteTextChange = (t: string) => {
    const pasted = t.length - pasteText.length >= 30 && t.includes('\n');
    setPasteText(t);
    if (pasted) { runParse(t); setPanel(null); haptic.success(); }
  };
  const parsedCount = usedPaste ? items.length : 0;

  const acceptClipboardSuggestion = () => {
    if (!clipboardSuggestion) return;
    haptic.success();
    setPasteText(clipboardSuggestion);
    runParse(clipboardSuggestion);
    setClipboardSuggestion(null);
  };
  const dismissClipboardSuggestion = () => { haptic.tap(); setClipboardSuggestion(null); };

  // Udostępnienie przez Share Sheet — już wyraźna akcja usera, parsuje się od razu
  // (bez banera jak `clipboardSuggestion`). `onInitialPasteTextConsumed` wywołany
  // zaraz po parsowaniu, żeby rodzic wyczyścił swój store — inaczej ten sam tekst
  // sparsowałby się znowu przy następnym otwarciu modala (np. edycja innej
  // transakcji zanim user zdąży zapisać ten wydatek).
  useEffect(() => {
    if (!visible || editingExpense || !initialPasteText?.trim()) return;
    setPasteText(initialPasteText);
    runParse(initialPasteText);
    onInitialPasteTextConsumed?.();
  }, [visible, editingExpense, initialPasteText]);

  // Podpowiedzi tagów (2026-11-11) — tagi napędzają dopasowanie do pojazdu
  // ("rower"), rachunku ("prąd"), pracy (prefiks) — literówka po cichu
  // psuje to dopasowanie. Najczęściej używane, filtrowane wpisywanym tekstem.
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) for (const t of e.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [expenses]);
  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    return tagCounts
      .filter((t) => !tags.includes(t) && (!q || t.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [tagCounts, tags, tagInput]);
  const addSuggestedTag = (t: string) => { haptic.tap(); setTags((prev) => [...prev, t]); setTagInput(''); };

  const addBlankItem = () => { haptic.tap(); setOpenItem(items.length); setItems((prev) => [...prev, { name: '', price: 0, quantity: 1, unitPrice: 0 }]); };
  const updateItem = (idx: number, patch: Partial<ReceiptItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx: number) => { setOpenItem(null); setItems((prev) => prev.filter((_, i) => i !== idx)); };
  const savings = useMemo(() => receiptSavings(items), [items]);
  const [receiptDisc, setReceiptDisc] = useState<string | null>(null);
  const submitReceiptDisc = () => {
    const base = items.reduce((a, it) => a + (!it.excluded && it.kind !== 'deposit' ? it.price : 0), 0);
    const n = parseDiscountInput(receiptDisc ?? '', base);
    if (n && n > 0) setItems((prev) => applyReceiptDiscount(prev, n));
    setReceiptDisc(null);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) { haptic.tap(); setTags((prev) => [...prev, t]); }
    setTagInput('');
  };
  const removeTag = (t: string) => { haptic.tap(); setTags((prev) => prev.filter((x) => x !== t)); };

  // Kalendarz (2026-11-01, user: "nie dodałeś kalendarza jak klikam w transakcjach") —
  // data MIAŁA dotąd tylko "Dziś"/"Wczoraj" + statyczną odznakę, bez sposobu wybrania
  // DOWOLNEGO dnia — realny problem przy edycji starszej transakcji (zaimportowanej z
  // banku albo dodanej z opóźnieniem). Natywny Androidowy picker (imperatywne API,
  // nie komponent inline — tak działa `DateTimePickerAndroid` w przeciwieństwie do iOS),
  // zero własnego UI kalendarza do budowania/utrzymywania.
  const openDatePicker = () => {
    haptic.tap();
    openPicker({
      // Data z banku ma godzinę ("2026-11-20T22:15:00", 2026-11-22) — kalendarz bierze sam dzień,
      // a zmiana dnia zostawia godzinę płatności.
      value: new Date(`${date.slice(0, 10)}T12:00:00`),
      mode: 'date',
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) setDate(ymd(selected) + date.slice(10));
      },
    });
  };

  const includedSum = round2(items.filter((it) => !it.excluded).reduce((sum, it) => sum + it.price, 0));
  const amount = items.length > 0 ? includedSum : (parseFloat(amountInput.replace(',', '.')) || 0);
  // Czy wydatek (bez pozycji paragonu) liczy się jako Jedzenie → pokaż rodzaj jedzenia.
  const mealGuess = guessMealSubcat(`${storeName} ${note} ${tags.join(' ')}`);
  const foodWhole = type === 'expense' && !own && items.length === 0 && (fvChoice === 'food' || (fvChoice === 'auto' &&
    bucketOfExpense({ id: '', type: 'expense', amount: amount || 1, date: '', note, storeName, tags, expenseCategory, createdAt: '', updatedAt: '' } as any) === 'food'));
  const mismatch = usedPaste && parsedTotal > 0 && Math.abs(includedSum - parsedTotal) > 0.01;
  const canSave = amount > 0;

  // `mode`: 'merge' = paragon wchodzi do istniejącej płatności (baner "Połącz"),
  // 'separate' = świadomie osobny wydatek ("Zapisz osobno").
  // Wydatek "na paliwo" bez wpisu tankowania (np. Orlen z powiadomienia banku)
  // → skrót do formularza tankowania (2026-11-12, user: "przy wyborze wydatku
  // automatycznego z tankowania muszę mieć formularz tankowania"). FuelSheet
  // stackuje się na wierzchu i PODPINA ten wydatek, nie tworzy drugiego.
  const vehicles = useVehiclesStore((st) => st.vehicles);
  const [fuelSheetFor, setFuelSheetFor] = useState<Vehicle | null>(null);
  // Aktualna wersja z store'a — "nie paliwo" chowa baner od razu.
  const liveEditing = useExpensesStore((st) => (editingExpense ? st.expenses.find((x) => x.id === editingExpense.id) : undefined));
  const fuelVehicle = useMemo(() => {
    if (!editingExpense || editingExpense.type !== 'expense' || !looksLikeFuel(liveEditing ?? editingExpense)) return null;
    const mainId = mainCarId(vehicles);
    return vehicles.find((v) => vehicleHasFuel(v.kind)
      && expenseMatchesVehicle(editingExpense, v, mainId)
      && !v.fuelLog.some((f) => f.expenseId === editingExpense.id)) ?? null;
  }, [editingExpense, liveEditing, vehicles]);

  const handleSave = (mode?: 'merge' | 'separate') => {
    if (!canSave) return;
    // Wykrycie możliwego duplikatu TYLKO dla nowego wydatku (nie edycji —
    // edytowany wydatek NIE jest swoim własnym duplikatem). `dup.id !==
    // duplicateOf?.id` — drugi tap (po zmianie kwoty/daty albo z banera
    // "Zapisz mimo to" poniżej, który nie zmienia pól) przechodzi dalej:
    // jeśli to ta sama propozycja co już pokazana, user ją świadomie
    // potwierdził, nie pytamy drugi raz.
    // 2026-11-12 (user: "jak dodaję paragon z lidla... jak klikam tak to mi
    // dubluje a powinno rozumieć że to to samo co złapało z powiadomień"):
    // pewne dopasowanie (płatność z banku, bez paragonu, ten sam sklep) →
    // łączymy od razu, bez pytania; niepewne → baner z "Połącz"/"Zapisz osobno".
    // `getState()` — świeży stan (CLAUDE.md zasada 3), nie snapshot z renderu.
    let mergeInto: Expense | null = null;
    if (type === 'expense' && !editingExpense && mode !== 'separate') {
      const dup = mode === 'merge' ? duplicateOf : findReceiptTarget({ amount, date, storeName }, useExpensesStore.getState().expenses);
      if (dup) {
        if (mode === 'merge' || isConfidentReceiptMatch(dup, storeName.trim() || note.trim())) {
          mergeInto = dup;
        } else {
          haptic.tap();
          setDuplicateOf(dup);
          return;
        }
      }
    }
    haptic.success();
    const now = new Date().toISOString();
    const shared = {
      type,
      amount,
      date,
      note: note.trim(),
      storeName: type === 'expense' && storeName.trim() ? storeName.trim() : undefined, // przy przelewie pole ukryte, ale nazwa z banku zostaje
      tags,
      receiptItems: type === 'expense' && !own && items.length > 0 ? items : undefined,
      fvOverride: own ? 'transfer' as const : type === 'expense' && fvChoice !== 'auto' ? fvChoice : null,
      expenseCategory: type === 'expense' && !own ? expenseCategory : undefined,
      foodSubcat: foodWhole ? (foodSubcat ?? mealGuess) : undefined,
      incomeCategory: type === 'income' && !own ? incomeCategory : undefined,
      paymentMethod: own ? (type === 'expense' ? 'transfer' as const : undefined) : type === 'expense' ? paymentMethod : undefined,
      payer: type === 'expense' && !own && payer !== 'me' ? payer : undefined,
      // Zapis = rozwiązanie oczekującego przeliczenia waluty (2026-11-09) —
      // `amount` powyżej to już prawdziwa wpisana kwota PLN, więc oba te pola
      // czyszczą się, niezależnie czy ten wydatek w ogóle był `originalCurrency`.
      originalAmount: undefined,
      originalCurrency: undefined,
    };
    if (editingExpense) {
      updateExpense(editingExpense.id, { ...shared, updatedAt: now });
    } else if (mergeInto) {
      updateExpense(mergeInto.id, { ...mergeReceiptInto(mergeInto, shared), updatedAt: now });
    } else {
      const expense: Expense = { id: genId(), ...shared, source: usedPaste ? 'receipt' : 'manual', createdAt: now, updatedAt: now };
      addExpense(expense);
    }
    // Zapis = moment nauki (było całkowicie brakujące w Fazie 2.2 — pamięć
    // istniała, ale nic jej nigdy nie zasilało). Tylko pozycje z realną nazwą/
    // ceną, kaucje pominięte (nie są "produktem" o typowej cenie).
    const realItems = items.filter((it) => it.name.trim() && it.kind !== 'deposit');
    if (realItems.length > 0) {
      saveFoodSubcatMemory(realItems.map((it) => ({ name: it.name, foodSubcat: it.foodSubcat })));
      savePriceMemory(realItems.filter((it) => it.unitPrice > 0).map((it) => ({ name: it.name, unitPrice: it.unitPrice })));
    }
    // Pamięć sprzedawcy (2026-11-09, user: "paragony jak zmieniam uczą się?
    // żeby później jak łapię to dobrze już jak poprawiłem wcześniej" — ten sam
    // "zapis = moment nauki" brakował dla `merchantMemory.ts`. Dotąd uczyła się
    // WYŁĄCZNIE z akceptacji w Płatnościach z banku (`bankCommit.ts`'s
    // `recordMerchantAccept`) — ręczna korekta tagów PÓŹNIEJ (tu, przy edycji
    // zapisanego już wydatku) nigdy do niej nie docierała, więc kolejne
    // powiadomienie z banku od TEGO SAMEGO sprzedawcy dalej proponowało stare/
    // puste tagi. `saveMerchant` (nie `recordMerchantAccept`) — tylko odświeża
    // tagi/nazwę, NIE dotyka licznika zaufania/autopilota (ten dotyczy innego
    // sygnału: "zaakceptowałem podpowiedź bez zmian", nie "poprawiłem ręcznie
    // po fakcie"). `storeKey` = pierwsze słowo nazwy, małe litery — DOKŁADNIE
    // ta sama derywacja co `bankNotification.ts`'s `parseBankNotification`,
    // żeby trafić w ten sam klucz pamięci.
    const storeKeyForMemory = shared.storeName?.trim().split(/\s+/)[0]?.toLowerCase();
    if (storeKeyForMemory) {
      saveMerchant(storeKeyForMemory, { tags, name: shared.storeName });
    }
    handleClose();
  };

  const header = (
    <View style={s.header}>
      <Text style={s.title}>
        {own ? `${editingExpense ? 'Edytuj p' : 'P'}rzelew własny` : `${editingExpense ? 'Edytuj' : 'Nowy'} ${type === 'expense' ? 'wydatek' : 'przychód'}`}
      </Text>
      <View style={s.headerActions}>
        {editingExpense && (
          <TouchableOpacity onPress={handleDelete} hitSlop={8} style={s.closeBtn} accessibilityLabel="Usuń wydatek">
            <Trash2 size={16} color={colors.accent.red} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleClose} hitSlop={8} style={s.closeBtn}>
          <X size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const footer = (
    <View style={s.footerRoot}>
      {/* Pływający, zawsze pod prawym kciukiem (user, 2026-11-01) — `bottom:'100%'`
          wynosi go NAD przypiętą stopkę `AppBottomSheet`'s `footer` (ta sama warstwa,
          już trzymana ponad klawiaturą przez gorhom, nie trzeba drugiej). */}
      {duplicateOf && (
        <View style={s.dupWarning}>
          <Text style={s.dupWarningText}>
            Ta płatność już jest{duplicateOf.bankMatched ? ' (z powiadomienia banku)' : ''}: {duplicateOf.storeName || duplicateOf.note || 'Wydatek'} · {duplicateOf.amount.toFixed(2)} zł · {duplicateOf.date.slice(0, 10)}{duplicateOf.date.length > 10 ? ` ${duplicateOf.date.slice(11, 16)}` : ''}. Połączyć z nią ten {items.length > 0 ? 'paragon' : 'wpis'}?
          </Text>
          <View style={s.dupWarningActions}>
            <TouchableOpacity style={s.dupWarningBtnSecondary} onPress={() => handleSave('separate')} activeOpacity={0.7}>
              <Text style={s.dupWarningBtnSecondaryLabel}>Zapisz osobno</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.dupWarningBtnPrimary} onPress={() => handleSave('merge')} activeOpacity={0.7}>
              <Text style={s.dupWarningBtnPrimaryLabel}>Połącz</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <View style={s.footer}>
        <View>
          <Text style={s.footerLabel}>{own ? (type === 'expense' ? 'Przelew własny · wychodzący' : 'Przelew własny · przychodzący') : type === 'expense' ? 'Wydatek' : 'Przychód'}</Text>
          <Text style={s.footerAmount}>{zl(amount)}</Text>
        </View>
        <TouchableOpacity style={[s.saveBtn, !canSave && s.btnDisabled]} onPress={() => handleSave()} disabled={!canSave} activeOpacity={0.7}>
          <Text style={s.saveLabel}>{editingExpense ? 'Zaktualizuj' : 'Zapisz'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
    <AppBottomSheet visible={visible} onClose={handleClose} header={header} footer={footer}>
      {fuelVehicle && editingExpense && (
        <TouchableOpacity style={s.fuelLink} onPress={() => { haptic.tap(); setFuelSheetFor(fuelVehicle); }} activeOpacity={0.8}>
          <Fuel size={14} color={colors.accent.orange} />
          <Text style={s.fuelLinkText} numberOfLines={1}>Tankowanie {fuelVehicle.name} — uzupełnij litry i przebieg</Text>
          <TouchableOpacity onPress={() => { haptic.tap(); updateExpense(editingExpense.id, { notFuel: true }); }} hitSlop={8} style={s.notFuelBtn} accessibilityLabel="To nie paliwo">
            <Text style={s.notFuelLabel}>nie paliwo</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
      <View style={s.typeRow}>
        <TouchableOpacity
          style={[s.typeChip, !own && type === 'expense' && s.typeChipActive]}
          onPress={() => { setType('expense'); setOwn(false); }}
          activeOpacity={0.7}
        >
          <Receipt size={14} color={!own && type === 'expense' ? colors.bg.primary : colors.text.muted} />
          <Text style={[s.typeChipLabel, !own && type === 'expense' && s.typeChipLabelActive]}>Wydatek</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.typeChip, !own && type === 'income' && s.typeChipActive]}
          onPress={() => { setType('income'); setOwn(false); }}
          activeOpacity={0.7}
        >
          <Banknote size={14} color={!own && type === 'income' ? colors.bg.primary : colors.text.muted} />
          <Text style={[s.typeChipLabel, !own && type === 'income' && s.typeChipLabelActive]}>Przychód</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.typeChip, own && s.typeChipActive]}
          onPress={() => { haptic.tap(); setOwn(true); }}
          activeOpacity={0.7}
          accessibilityLabel="Przelew własny"
        >
          <ArrowLeftRight size={14} color={own ? colors.bg.primary : colors.text.muted} />
          <Text style={[s.typeChipLabel, own && s.typeChipLabelActive]} numberOfLines={1}>Własny</Text>
        </TouchableOpacity>
      </View>
      {own && (
        <View style={s.section}>
          <View style={s.chips}>
            {([['expense', 'Wychodzący', 'z tego konta'], ['income', 'Przychodzący', 'na to konto']] as const).map(([k, l, sub]) => (
              <TouchableOpacity key={k} style={[s.chip, type === k && s.chipActive]} onPress={() => { haptic.tap(); setType(k); }} activeOpacity={0.7}>
                <Text style={[s.chipLabel, type === k && s.chipLabelActive]}>{l} · {sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.ownHint}>Przelew między Twoimi kontami: zmienia saldo, ale nie liczy się do wydatków, przychodów, kategorii ani budżetów.</Text>
          {/* Reguła jednym tapem (2026-11-18, user: "jak zaznaczę przelew własny dla TRADE REPUBLIC,
              ma łapać sam"): kolejne (i dotychczasowe) wpisy z tą nazwą/tytułem = przelew własny. */}
          {ruleMatch.length >= 2 && (
            <TouchableOpacity
              style={[s.chip, s.ruleChip, ruleSaved === `${ruleMatch}|own` && s.chipActive]}
              onPress={() => {
                if (ruleSaved === `${ruleMatch}|own`) return;
                haptic.success();
                const rule = useCategoryRulesStore.getState().add({ field: 'store', match: ruleMatch, kind: 'own', tag: 'transfer' });
                const { expenses: next, changed } = applyRulesToAll(useExpensesStore.getState().expenses, [rule], new Date().toISOString());
                if (changed) useExpensesStore.setState({ expenses: next });
                setRuleSaved(`${ruleMatch}|own`);
                setOwnRuleInfo(changed ? `Oznaczono też ${changed} wcześniejsze` : null);
              }}
              activeOpacity={0.7}
            >
              <Text style={[s.chipLabel, ruleSaved === `${ruleMatch}|own` && s.chipLabelActive]}>
                {ruleSaved === `${ruleMatch}|own` ? `Zapamiętane: „${ruleMatch}” = przelew własny${ownRuleInfo ? ` · ${ownRuleInfo}` : ''}` : `Zawsze przelew własny dla „${ruleMatch}”`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {type === 'expense' && !own && clipboardSuggestion && (
        <View style={[s.section, s.clipboardBanner]}>
          <Text style={s.clipboardBannerText}>Wykryto możliwy paragon w schowku</Text>
          <View style={s.clipboardBannerActions}>
            <TouchableOpacity onPress={dismissClipboardSuggestion} hitSlop={8} style={s.clipboardDismissBtn}>
              <X size={14} color={colors.text.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={acceptClipboardSuggestion} style={s.clipboardAcceptBtn} activeOpacity={0.7}>
              <ClipboardPaste size={13} color={colors.bg.primary} />
              <Text style={s.clipboardAcceptLabel}>Rozpoznaj</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Sklep + data jako pigułka (2026-11-22). */}
      {type === 'expense' && !own ? (
        <View style={s.section}>
          <View style={s.storeRow}>
            <TextInput
              value={storeName}
              onChangeText={setStoreName}
              placeholder="Sklep — np. Lidl, Orlen…"
              placeholderTextColor={colors.text.muted}
              style={[s.textInput, s.storeInput]}
            />
            <TouchableOpacity style={s.datePill} onPress={openDatePicker} activeOpacity={0.7} accessibilityLabel={`Data: ${fmtDateBadge(date)} — zmień`}>
              <CalendarDays size={14} color={colors.text.secondary} />
              <Text style={s.datePillLabel}>{fmtDatePill(date)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[s.section, s.storeRow, { alignItems: 'center' }]}>
          <Text style={[s.label, { flex: 1, marginBottom: 0 }]}>Data</Text>
          <TouchableOpacity style={s.datePill} onPress={openDatePicker} activeOpacity={0.7} accessibilityLabel={`Data: ${fmtDateBadge(date)} — zmień`}>
            <CalendarDays size={14} color={colors.text.secondary} />
            <Text style={s.datePillLabel}>{fmtDatePill(date)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {editingExpense?.originalCurrency && (
        <View style={[s.section, s.clipboardBanner]}>
          <Text style={s.clipboardBannerText}>
            Płatność w obcej walucie: {editingExpense.originalAmount?.toFixed(2)} {editingExpense.originalCurrency} —
            wpisz kwotę w PLN poniżej, żeby zapisać.
          </Text>
        </View>
      )}

      {items.length === 0 && (
        <View style={s.section}>
          <View style={s.amountRow}>
            <TextInput
              value={amountInput}
              onChangeText={setAmountInput}
              placeholder="0,00"
              placeholderTextColor={colors.text.muted}
              keyboardType="decimal-pad"
              style={s.amountInput}
            />
            <Text style={s.currencyLg}>zł</Text>
          </View>
        </View>
      )}

      {/* Pozycje paragonu (2026-11-23, user: "za dużo napisów, chaos"): wklejka i "+ pozycja"
          w nagłówku listy (wklejka wypełnia tę listę), każda pozycja w JEDNEJ linii —
          stuknięcie rozwija pełną edycję (jedna naraz). */}
      {type === 'expense' && !own && (
        <View style={s.section}>
          <View style={s.itemsHeader}>
            <Text style={[s.label, { marginBottom: 0, flex: 1 }]} numberOfLines={1}>
              {items.length === 0 ? 'Paragon' : `${parsedCount > 0 ? 'Paragon' : 'Pozycje'} · ${items.length} poz.`}
            </Text>
            <TouchableOpacity style={[s.addItemBtn, panel === 'paste' && s.addItemBtnOn]} onPress={() => togglePanel('paste')} activeOpacity={0.7}>
              <ClipboardPaste size={13} color={panel === 'paste' ? colors.bg.primary : colors.text.bright} />
              <Text style={[s.addItemLabel, panel === 'paste' && { color: colors.bg.primary }]}>{parsedCount > 0 ? 'Wklej inny' : 'Wklej'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.addItemBtn} onPress={addBlankItem} activeOpacity={0.7}>
              <Plus size={13} color={colors.text.bright} />
              <Text style={s.addItemLabel}>Pozycja</Text>
            </TouchableOpacity>
          </View>
          {panel === 'paste' && (
            <View style={s.panel}>
              <TextInput
                value={pasteText}
                onChangeText={onPasteTextChange}
                placeholder="Wklej tekst paragonu ze sklepu / SMS-a / aplikacji banku — rozpozna się sam…"
                placeholderTextColor={colors.text.muted}
                style={s.pasteInput}
                multiline
                autoFocus
                textAlignVertical="top"
              />
              <TouchableOpacity style={[s.parseBtn, !pasteText.trim() && s.btnDisabled]} onPress={handleParse} disabled={!pasteText.trim()} activeOpacity={0.7}>
                <ClipboardPaste size={14} color={colors.bg.primary} />
                <Text style={s.parseBtnLabel}>Rozpoznaj paragon</Text>
              </TouchableOpacity>
            </View>
          )}
          {items.length > 0 && (
            <View style={s.itemList}>
              {items.map((it, idx) => (
                <ReceiptItemRow
                  key={idx}
                  item={it}
                  open={openItem === idx}
                  onToggle={() => setOpenItem((o) => (o === idx ? null : idx))}
                  onChange={(patch) => updateItem(idx, patch)}
                  onDelete={() => removeItem(idx)}
                  priceMemory={priceMemory}
                  knownNames={knownNames}
                />
              ))}
            </View>
          )}
          {items.length > 0 && (
            <View style={s.savingsRow}>
              {savings.amount > 0
                ? <Text style={s.savingsText}>zniżki −{zl(savings.amount)}</Text>
                : <Text style={s.savingsNone}>bez zniżek</Text>}
              {receiptDisc === null ? (
                <TouchableOpacity onPress={() => setReceiptDisc('')} hitSlop={6} accessibilityLabel="Rabat na cały paragon">
                  <Text style={s.savingsBtn}>+ rabat na paragon</Text>
                </TouchableOpacity>
              ) : (
                <TextInput
                  value={receiptDisc}
                  onChangeText={setReceiptDisc}
                  placeholder="zł albo %"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="numbers-and-punctuation"
                  autoFocus
                  style={s.savingsInput}
                  onSubmitEditing={submitReceiptDisc}
                  onBlur={submitReceiptDisc}
                />
              )}
            </View>
          )}
          {mismatch && (
            <Text style={s.mismatchText}>
              Na paragonie: {zl(parsedTotal)} — różnica {zl(Math.abs(includedSum - parsedTotal))}, sprawdź pozycje
            </Text>
          )}
        </View>
      )}

      <ExpenseDetails
        type={type}
        own={own}
        panel={panel}
        setPanel={setPanel}
        togglePanel={togglePanel}
        fvChoice={fvChoice}
        setFvChoice={setFvChoice}
        foodWhole={foodWhole}
        foodSubcat={foodSubcat}
        setFoodSubcat={setFoodSubcat}
        mealGuess={mealGuess}
        expenseCategory={expenseCategory}
        setExpenseCategory={setExpenseCategory}
        incomeCategory={incomeCategory}
        setIncomeCategory={setIncomeCategory}
        tags={tags}
        removeTag={removeTag}
        note={note}
        setNote={setNote}
        storeName={storeName}
        payer={payer}
        setPayer={setPayer}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        ruleMatch={ruleMatch}
        ruleSaved={ruleSaved}
        setRuleSaved={setRuleSaved}
        tagInput={tagInput}
        setTagInput={setTagInput}
        addTag={addTag}
        tagSuggestions={tagSuggestions}
        addSuggestedTag={addSuggestedTag}
      />
    </AppBottomSheet>
    <FuelSheet
      vehicle={fuelSheetFor}
      prefill={editingExpense ? { expenseId: editingExpense.id, amount: editingExpense.amount, date: editingExpense.date, label: `${editingExpense.storeName || editingExpense.note || 'Wydatek'} · ${editingExpense.amount.toFixed(2)} zł` } : null}
      onClose={() => setFuelSheetFor(null)}
      onSaved={handleClose}
    />
    </>
  );
}
