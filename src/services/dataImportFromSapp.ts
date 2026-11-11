import { useExpensesStore } from '@/store/expensesStore';
import { useMoodStore } from '@/store/moodStore';
import { useSubscriptionsStore } from '@/store/subscriptionsStore';
import type { Expense, ReceiptItem } from '@/types/finances';
import type { MoodEntry } from '@/types/mood';
import type { Subscription, BillingCycle } from '@/types/subscriptions';
import { rollOverdueSubscription, isDurationExpired } from '@/utils/recurringBills';
import { ymdLocal } from '@/utils/dateMath';

// Import z sapp (2026-11-09, user: "musimy dodac zeby eksport zrobic z sapp danych
// do sapp2 - glownie zalezy mi na finansach i paragonach wstecz oraz humor") — sapp
// i sapp2 są OSOBNYMI projektami Firebase, więc nie da się bezpośrednio czytać
// jednego z drugiego. sapp JUŻ ma gotowy eksport całego JSON snapshotu (Ustawienia
// → Dane → "Kopia zapasowa" → eksportuje, `backupService.ts`'s
// `exportSnapshotToFile()`, Share Sheet → plik `sapp-export-*.json`) — ta appka
// WYŁĄCZNIE PARSUJE ten plik (user otwiera go gdziekolwiek wylądował i wkleja
// treść, `app/import-sapp.tsx`), mapuje `cloud.expenses`/`cloud.mood` (jedyne dwa
// bloki które user chciał — "głównie finanse/paragony i humor") na sapp2's nieco
// inny schemat, i wstawia offline-first przez istniejące store'y. Reszta bloku
// (events/tasks/workShifts/pojazdy...) ŚWIADOMIE ignorowana — sapp2 ma
// własny, osobny Kalendarz/Zadania/Praca/Pojazdy, mieszanie starych danych tamtych
// podsystemów byłoby zgadywaniem, nie tym o co user prosił.

// Kształt sapp's `Expense` (src/types/index.ts) — tylko pola które faktycznie
// mapujemy, reszta (payer jako wolny tekst, vehicleId, reimbursedAmount/
// reimbursedFromId, viaScan...) celowo pominięta, patrz mapExpense niżej.
interface SappExpense {
  id: string;
  type?: 'expense' | 'income';
  amount: number;
  originalAmount?: number;
  originalCurrency?: string;
  category?: string;
  tags?: string[];
  note?: string;
  date: string;
  storeName?: string;
  receiptItems?: Array<{
    name: string; price: number; quantity: number; unitPrice: number;
    discount?: number; tags?: string[]; kind?: 'deposit'; excluded?: boolean; weightKg?: number;
  }>;
  payer?: string;
  bankMatched?: boolean;
  fvOverride?: 'fixed' | 'variable' | 'food' | null;
  paymentMethod?: 'cash' | 'card';
  createdAt?: string;
  updatedAt?: string;
}

interface SappMoodEntry {
  id: string;
  date: string;
  mood: number;
  energy: number;
  note?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Subskrypcje / Stałe opłaty (DOŁĄCZONE 2026-11-11 — wcześniej świadomie
// odłożone: zaległe `nextBillingDate` z sapp wymagały przemyślenia, patrz
// `mapSubscription`). sapp's typ ≈ sapp2's, różnice: daty createdAt/updatedAt
// jako ISO string (sapp2: ms), `currency`/`category` (sapp2 nie ma).
interface SappSubscription {
  id: string;
  name: string;
  amount: number;
  currency?: string;
  category?: string;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  reminderDaysBefore?: number;
  active?: boolean;
  tags?: string[];
  note?: string;
  durationMonths?: number;
  startDate?: string;
  missedCycles?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SappExportPayload {
  cloud?: {
    expenses?: SappExpense[];
    mood?: SappMoodEntry[];
    subscriptions?: SappSubscription[];
  };
}

// sapp's kategorie → tag sapp2 (sapp2 nie ma kategorii, tylko tagi, patrz
// types/finances.ts). `other`/`other_income`/`transfer` pominięte — zbyt
// generyczne, żeby jako tag coś realnie znaczyły.
const CATEGORY_TO_TAG: Record<string, string> = {
  groceries: 'spożywcze', transport: 'transport', entertainment: 'rozrywka',
  health: 'zdrowie', clothing: 'ubrania', housing: 'mieszkanie', subscriptions: 'subskrypcje',
  // sapp2's własny bank-ingest już używa tagu 'wypłata' dla przychodu z pracy
  // (patrz bankCommit.ts) — ta sama etykieta tutaj dla spójności.
  salary: 'wypłata', freelance: 'freelance', gift: 'prezent', investment: 'inwestycja',
};

function mapReceiptItem(it: SappExpense['receiptItems'] extends (infer T)[] | undefined ? T : never): ReceiptItem {
  return {
    name: it.name, price: it.price, quantity: it.quantity, unitPrice: it.unitPrice,
    discount: it.discount, foodSubcat: it.tags?.[0], kind: it.kind, excluded: it.excluded, weightKg: it.weightKg,
  };
}

// Heurystyka `payer`: sapp trzyma wolny tekst (np. "Ja"/"Partnerka"), sapp2 ma
// zamknięty wybór 'me'|'partner'. Puste/"ja" → 'me' (wartość domyślna, zgodna z
// `undefined`), cokolwiek innego → 'partner'.
function mapPayer(p?: string): 'me' | 'partner' | undefined {
  if (!p) return undefined;
  return p.trim().toLowerCase() === 'ja' ? 'me' : 'partner';
}

function mapExpense(e: SappExpense): Expense {
  // Waluta obca jeszcze nieprzeliczona w sapp — sapp2's ta sama konwencja co
  // bankCommit.ts (Runda 13, 2026-11-09): amount:0 dopóki user nie wpisze PLN.
  const isForeignPending = !!e.originalCurrency;
  const extraTag = e.category ? CATEGORY_TO_TAG[e.category] : undefined;
  const tags = [...(e.tags ?? [])];
  if (extraTag && !tags.includes(extraTag)) tags.push(extraTag);

  const now = new Date().toISOString();
  return {
    id: `sapp_${e.id}`,
    type: e.type === 'income' ? 'income' : 'expense',
    amount: isForeignPending ? 0 : e.amount,
    date: (e.date || '').slice(0, 10),
    note: e.note ?? '',
    storeName: e.storeName,
    tags,
    receiptItems: e.receiptItems?.map(mapReceiptItem),
    source: e.receiptItems?.length ? 'receipt' : (e.bankMatched ? 'bank' : 'manual'),
    fvOverride: e.fvOverride ?? undefined,
    paymentMethod: e.paymentMethod,
    payer: mapPayer(e.payer),
    bankMatched: e.bankMatched,
    originalAmount: isForeignPending ? e.amount : undefined,
    originalCurrency: e.originalCurrency,
    createdAt: e.createdAt ?? now,
    updatedAt: e.updatedAt ?? now,
  };
}

function mapMood(m: SappMoodEntry): MoodEntry {
  const now = new Date().toISOString();
  return {
    id: `sapp_${m.id}`,
    date: (m.date || '').slice(0, 10),
    mood: m.mood,
    energy: m.energy,
    note: m.note,
    tags: m.tags ?? [],
    createdAt: m.createdAt ?? now,
    updatedAt: m.updatedAt ?? now,
  };
}

const VALID_CYCLES: BillingCycle[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

// `today` parametrem (nie `new Date()` w środku) — testowalne.
export function mapSubscription(s: SappSubscription, today: string): Subscription {
  const tags = [...(s.tags ?? [])];
  const catTag = s.category ? CATEGORY_TO_TAG[s.category] : undefined;
  if (catTag && !tags.includes(catTag)) tags.push(catTag);
  // sapp2 liczy wszystko w PLN — obca waluta zostaje widoczna w notatce,
  // zamiast cicho udawać że "9.99" to złotówki.
  const foreign = s.currency && s.currency.toUpperCase() !== 'PLN' ? s.currency.toUpperCase() : null;
  const note = [s.note?.trim(), foreign ? `kwota w ${foreign}` : undefined].filter(Boolean).join(' · ') || undefined;
  const billingCycle = VALID_CYCLES.includes(s.billingCycle) ? s.billingCycle : 'monthly';
  // Zaległa data z eksportu (plik mógł leżeć tygodniami) → najbliższy PRZYSZŁY
  // termin od razu przy imporcie. `missedCycles` NIE dolicza tych przesunięć —
  // przerwa wynika z przenosin między appkami, nie z niezapłaconych cykli.
  const rolled = rollOverdueSubscription({ nextBillingDate: s.nextBillingDate, billingCycle, missedCycles: 0 }, today);
  const base: Subscription = {
    id: `sapp_${s.id}`,
    name: s.name,
    amount: s.amount,
    billingCycle,
    nextBillingDate: rolled?.nextBillingDate ?? s.nextBillingDate,
    reminderDaysBefore: s.reminderDaysBefore ?? 0,
    active: s.active !== false,
    tags: tags.length ? tags : undefined,
    note,
    durationMonths: s.durationMonths,
    startDate: s.startDate,
    missedCycles: s.missedCycles,
    createdAt: Date.parse(s.createdAt ?? '') || Date.now(),
    updatedAt: Date.parse(s.updatedAt ?? '') || Date.now(),
  };
  if (base.active && isDurationExpired(base)) base.active = false;
  return base;
}

export interface ImportResult {
  expensesAdded: number;
  expensesSkipped: number;
  moodAdded: number;
  moodSkipped: number;
  subscriptionsAdded: number;
  subscriptionsSkipped: number;
}

// Wstawia offline-first, DEDUP po id (prefiks `sapp_` + oryginalny id z sapp —
// ponowny import tego samego pliku jest bezpieczny, nic się nie zdubluje).
// Rzuca wyjątek przy niepoprawnym JSON-ie — ekran importu łapie i pokazuje błąd.
//
// 2026-11-09, bug fix (user: "dane sie nie zaczynały złapało cała apke... nawet
// nie pokazuje wczytywanie danych") — pierwotna wersja wołała `addExpense`/
// `addEntry` W PĘTLI, po jednym wpisie: każde wywołanie kopiowało CAŁĄ rosnącą
// tablicę store'a I wyzwalało osobny `persist` zapis do AsyncStorage (pełna
// serializacja JSON za każdym razem). Dla realnego eksportu sapp (miesiące/lata
// paragonów = setki-tysiące wpisów) to setki-tysiące synchronicznych zapisów na
// dysk W JEDNEJ PĘTLI, bez oddania sterowania JS threadowi — appka wygląda jak
// zawieszona, bo dosłownie jest (żaden spinner nie zdąży się namalować, UI
// thread stoi). Teraz: mapuje WSZYSTKO do tablic najpierw, jeden
// `addExpenses`/`addEntries` na końcu — JEDEN `set()`, JEDEN zapis persist,
// niezależnie od liczby wpisów.
export function importSappPayload(raw: string): ImportResult {
  const parsed = JSON.parse(raw) as SappExportPayload;
  const sappExpenses = parsed.cloud?.expenses ?? [];
  const sappMood = parsed.cloud?.mood ?? [];

  const expensesStore = useExpensesStore.getState();
  const existingExpenseIds = new Set(expensesStore.expenses.map((e) => e.id));
  const newExpenses: Expense[] = [];
  let expensesAdded = 0, expensesSkipped = 0;
  for (const e of sappExpenses) {
    const mapped = mapExpense(e);
    if (existingExpenseIds.has(mapped.id)) { expensesSkipped++; continue; }
    newExpenses.push(mapped);
    existingExpenseIds.add(mapped.id);
    expensesAdded++;
  }
  if (newExpenses.length > 0) expensesStore.addExpenses(newExpenses);

  const moodStore = useMoodStore.getState();
  const existingMoodIds = new Set(moodStore.entries.map((m) => m.id));
  const newMoodEntries: MoodEntry[] = [];
  let moodAdded = 0, moodSkipped = 0;
  for (const m of sappMood) {
    const mapped = mapMood(m);
    if (existingMoodIds.has(mapped.id)) { moodSkipped++; continue; }
    newMoodEntries.push(mapped);
    existingMoodIds.add(mapped.id);
    moodAdded++;
  }
  if (newMoodEntries.length > 0) moodStore.addEntries(newMoodEntries);

  // Dedup: po id (ponowny import) ORAZ po nazwie+kwocie — user mógł już ręcznie
  // założyć tę samą subskrypcję w sapp2, zanim zaimportował plik.
  const subsStore = useSubscriptionsStore.getState();
  const existingSubIds = new Set(subsStore.subscriptions.map((s) => s.id));
  const subKey = (name: string, amount: number) => `${name.trim().toLowerCase()}|${amount.toFixed(2)}`;
  const existingSubKeys = new Set(subsStore.subscriptions.map((s) => subKey(s.name, s.amount)));
  const today = ymdLocal(new Date());
  const newSubs: Subscription[] = [];
  let subscriptionsAdded = 0, subscriptionsSkipped = 0;
  for (const s of parsed.cloud?.subscriptions ?? []) {
    if (!s?.name || !(s.amount > 0) || !s.nextBillingDate) { subscriptionsSkipped++; continue; }
    const mapped = mapSubscription(s, today);
    const key = subKey(mapped.name, mapped.amount);
    if (existingSubIds.has(mapped.id) || existingSubKeys.has(key)) { subscriptionsSkipped++; continue; }
    newSubs.push(mapped);
    existingSubIds.add(mapped.id);
    existingSubKeys.add(key);
    subscriptionsAdded++;
  }
  if (newSubs.length > 0) subsStore.addSubscriptions(newSubs);

  return { expensesAdded, expensesSkipped, moodAdded, moodSkipped, subscriptionsAdded, subscriptionsSkipped };
}
