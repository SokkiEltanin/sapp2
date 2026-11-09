import AsyncStorage from '@react-native-async-storage/async-storage';
import { importSappPayload } from '@/services/dataImportFromSapp';
import { useExpensesStore } from '@/store/expensesStore';
import { useMoodStore } from '@/store/moodStore';

// NOWE (nie ma odpowiednika w sapp — sapp nie importuje NIC, tylko eksportuje
// własny snapshot przez istniejący backupService.ts). Testuje mapowanie
// sapp's Expense/MoodEntry → sapp2's nieco inny schemat + dedup po id, patrz
// pełny komentarz w src/services/dataImportFromSapp.ts.

const sappPayload = (o: { expenses?: any[]; mood?: any[] }) => JSON.stringify({ cloud: o });

beforeEach(async () => {
  await AsyncStorage.clear();
  useExpensesStore.setState({ expenses: [] });
  useMoodStore.setState({ entries: [] });
});

describe('importSappPayload — wydatki', () => {
  test('mapuje podstawowe pola, prefiksuje id "sapp_"', () => {
    const r = importSappPayload(sappPayload({
      expenses: [{ id: 'abc123', type: 'expense', amount: 42.5, date: '2026-05-01T10:00:00', note: 'Lidl', storeName: 'Lidl', tags: ['zakupy'] }],
    }));
    expect(r.expensesAdded).toBe(1);
    const exp = useExpensesStore.getState().expenses[0];
    expect(exp.id).toBe('sapp_abc123');
    expect(exp.amount).toBe(42.5);
    expect(exp.date).toBe('2026-05-01');
    expect(exp.tags).toContain('zakupy');
  });

  test('kategoria sapp dokleja się jako dodatkowy tag (bez duplikatu gdy już jest)', () => {
    importSappPayload(sappPayload({
      expenses: [
        { id: '1', amount: 10, date: '2026-05-01', category: 'groceries', tags: [] },
        { id: '2', amount: 10, date: '2026-05-01', category: 'groceries', tags: ['spożywcze'] },
      ],
    }));
    const [e1, e2] = useExpensesStore.getState().expenses;
    expect(e1.tags).toEqual(['spożywcze']);
    expect(e2.tags).toEqual(['spożywcze']); // nie zdublowane
  });

  test('type undefined → traktowane jako "expense" (ten sam fallback co sapp)', () => {
    importSappPayload(sappPayload({ expenses: [{ id: '1', amount: 10, date: '2026-05-01' }] }));
    expect(useExpensesStore.getState().expenses[0].type).toBe('expense');
  });

  test('waluta obca nieprzeliczona (originalCurrency) → amount:0, originalAmount ustawione (ta sama konwencja co bankCommit.ts)', () => {
    importSappPayload(sappPayload({
      expenses: [{ id: '1', amount: 25, originalAmount: 25, originalCurrency: 'EUR', date: '2026-05-01' }],
    }));
    const exp = useExpensesStore.getState().expenses[0];
    expect(exp.amount).toBe(0);
    expect(exp.originalAmount).toBe(25);
    expect(exp.originalCurrency).toBe('EUR');
  });

  test('payer: "Ja"/puste → "me", cokolwiek innego → "partner"', () => {
    importSappPayload(sappPayload({
      expenses: [
        { id: '1', amount: 10, date: '2026-05-01', payer: 'Ja' },
        { id: '2', amount: 10, date: '2026-05-01', payer: 'Partnerka' },
        { id: '3', amount: 10, date: '2026-05-01' },
      ],
    }));
    const [e1, e2, e3] = useExpensesStore.getState().expenses;
    expect(e1.payer).toBe('me');
    expect(e2.payer).toBe('partner');
    expect(e3.payer).toBeUndefined();
  });

  test('receiptItems mapowane, pierwszy tag pozycji → foodSubcat', () => {
    importSappPayload(sappPayload({
      expenses: [{
        id: '1', amount: 20, date: '2026-05-01',
        receiptItems: [{ name: 'Mleko', price: 4, quantity: 1, unitPrice: 4, tags: ['nabiał'] }],
      }],
    }));
    const exp = useExpensesStore.getState().expenses[0];
    expect(exp.source).toBe('receipt');
    expect(exp.receiptItems?.[0].name).toBe('Mleko');
    expect(exp.receiptItems?.[0].foodSubcat).toBe('nabiał');
  });

  test('ponowny import TEGO SAMEGO payloadu → dedup po id, nic się nie dubluje', () => {
    const payload = sappPayload({ expenses: [{ id: '1', amount: 10, date: '2026-05-01' }] });
    importSappPayload(payload);
    const r2 = importSappPayload(payload);
    expect(r2.expensesAdded).toBe(0);
    expect(r2.expensesSkipped).toBe(1);
    expect(useExpensesStore.getState().expenses).toHaveLength(1);
  });
});

describe('importSappPayload — humor', () => {
  test('mapuje 1:1 (ten sam kształt co sapp2), prefiksuje id', () => {
    const r = importSappPayload(sappPayload({
      mood: [{ id: 'm1', date: '2026-05-01', mood: 4, energy: 3, tags: ['spokój'] }],
    }));
    expect(r.moodAdded).toBe(1);
    const m = useMoodStore.getState().entries[0];
    expect(m.id).toBe('sapp_m1');
    expect(m.mood).toBe(4);
    expect(m.energy).toBe(3);
    expect(m.tags).toEqual(['spokój']);
  });

  test('dedup po id jak przy wydatkach', () => {
    const payload = sappPayload({ mood: [{ id: 'm1', date: '2026-05-01', mood: 3, energy: 3 }] });
    importSappPayload(payload);
    const r2 = importSappPayload(payload);
    expect(r2.moodSkipped).toBe(1);
    expect(useMoodStore.getState().entries).toHaveLength(1);
  });
});

describe('importSappPayload — brak bloków / pusty payload', () => {
  test('brak cloud.expenses/cloud.mood → zera, bez rzucania', () => {
    const r = importSappPayload(JSON.stringify({ cloud: {} }));
    expect(r).toEqual({ expensesAdded: 0, expensesSkipped: 0, moodAdded: 0, moodSkipped: 0 });
  });

  test('niepoprawny JSON → rzuca (ekran importu to łapie)', () => {
    expect(() => importSappPayload('{nie json')).toThrow();
  });
});

// Ręczny monkeypatch zamiast `jest.spyOn` (2026-11-09) — zustand's `set()` kopiuje
// WSZYSTKIE akcje (w tym `jest.spyOn`-owane) do NOWEGO obiektu stanu przy każdym
// wywołaniu; `mockRestore()` naprawia tylko STARY (już osierocony) obiekt, więc
// `jest.spyOn` użyte w dwóch kolejnych testach na tym samym store'owym polu
// "wycieka" między testami (Jest po cichu ODDAJE ten sam mock drugi raz zamiast
// nowego, z doklejoną historią wywołań z poprzedniego testu). Lokalna tablica
// `calls` w domknięciu nie ma tego problemu — liczy tylko wywołania W TRAKCIE
// życia TEGO konkretnego patcha, niezależnie od głębszych, "wyciekłych" warstw.
function countCalls(obj: any, key: string) {
  const original = obj[key];
  const calls: any[][] = [];
  obj[key] = (...args: any[]) => { calls.push(args); return original(...args); };
  return { calls, restore: () => { obj[key] = original; } };
}

// 2026-11-09, bug fix regression guard — user: "dane sie nie zaczynały złapało
// cała apke". Pierwotna wersja wołała `addExpense`/`addEntry` W PĘTLI, po
// jednym wpisie, każde wywołanie kopiując CAŁĄ rosnącą tablicę + osobny zapis
// `persist` do AsyncStorage — O(n) zapisów na dysk w jednej synchronicznej
// pętli dla importu liczącego setki/tysiące wpisów. Test pilnuje, żeby import
// zawsze szedł przez `addExpenses`/`addEntries` (JEDEN `set()`), nie wracał do
// pętli pojedynczych wywołań.
describe('importSappPayload — wstawia WSADOWO (jeden set(), nie pętla pojedynczych addExpense/addEntry)', () => {
  test('N wydatków → addExpenses wołane RAZ z N elementami, addExpense ani razu', () => {
    const state = useExpensesStore.getState();
    const addExpenses = countCalls(state, 'addExpenses');
    const addExpense = countCalls(state, 'addExpense');
    const expenses = Array.from({ length: 50 }, (_, i) => ({ id: `e${i}`, amount: 10, date: '2026-05-01' }));
    importSappPayload(sappPayload({ expenses }));
    expect(addExpenses.calls).toHaveLength(1);
    expect(addExpenses.calls[0][0]).toHaveLength(50);
    expect(addExpense.calls).toHaveLength(0);
    addExpenses.restore();
    addExpense.restore();
  });

  test('N wpisów humoru → addEntries wołane RAZ z N elementami, addEntry ani razu', () => {
    const state = useMoodStore.getState();
    const addEntries = countCalls(state, 'addEntries');
    const addEntry = countCalls(state, 'addEntry');
    const mood = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, date: '2026-05-01', mood: 5, energy: 5 }));
    importSappPayload(sappPayload({ mood }));
    expect(addEntries.calls).toHaveLength(1);
    expect(addEntries.calls[0][0]).toHaveLength(30);
    expect(addEntry.calls).toHaveLength(0);
    addEntries.restore();
    addEntry.restore();
  });

  test('zero nowych wpisów (wszystko już zaimportowane) → addExpenses NIE wołane wcale', () => {
    importSappPayload(sappPayload({ expenses: [{ id: 'dup', amount: 10, date: '2026-05-01' }] }));
    const addExpenses = countCalls(useExpensesStore.getState(), 'addExpenses');
    importSappPayload(sappPayload({ expenses: [{ id: 'dup', amount: 10, date: '2026-05-01' }] }));
    expect(addExpenses.calls).toHaveLength(0);
    addExpenses.restore();
  });
});
