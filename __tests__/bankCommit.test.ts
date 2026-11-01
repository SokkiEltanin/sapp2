import AsyncStorage from '@react-native-async-storage/async-storage';
import { commitBankTx } from '@/services/bankCommit';
import { useExpensesStore } from '@/store/expensesStore';
import { useBankQueue, type PendingBankTx } from '@/store/bankQueueStore';

// Nowa logika (adaptacja sapp's bankCommit.ts do offline-first modelu sapp2, patrz
// komentarz w pliku źródłowym) — dedykowane testy, bo to nie czysty 1:1 port: zapis
// jest teraz SYNCHRONICZNY (useExpensesStore.getState() bezpośrednio, nie awaited
// Firestore), subskrypcje/praca/payday z sapp odpadły (sapp2 ich jeszcze nie ma).
const ptx = (o: Partial<PendingBankTx>): PendingBankTx => ({
  id: 'p1', amount: 60, currency: 'PLN', dateISO: '2026-11-01T09:00:00',
  store: 'LIDL', storeKey: 'lidl', method: 'card', direction: 'out', raw: 'test',
  tags: [], suggestedTags: [], addedAt: Date.now(), ...o,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  useExpensesStore.setState({ expenses: [] });
  useBankQueue.setState({ pending: [], enabled: true, autoAll: false, seenNotifications: [], history: [] });
});

describe('commitBankTx — wydatek wychodzący', () => {
  test('brak pasującego wydatku → dodaje nowy, otagowany, oznaczony bankMatched', async () => {
    const res = await commitBankTx(ptx({ tags: ['spożywcze'] }));
    expect(res.ok).toBe(true);
    expect(res.matched).toBe(false);
    const exps = useExpensesStore.getState().expenses;
    expect(exps).toHaveLength(1);
    expect(exps[0]).toMatchObject({ type: 'expense', amount: 60, storeName: 'LIDL', tags: ['spożywcze'], bankMatched: true, source: 'bank' });
  });

  test('auto:true → source "bank-auto"', async () => {
    await commitBankTx(ptx({ auto: true }));
    expect(useExpensesStore.getState().expenses[0].source).toBe('bank-auto');
  });

  test('pasujący już dodany wydatek (ta sama kwota/dzień/sklep) → oznacza bankMatched, NIE dubluje', async () => {
    useExpensesStore.getState().addExpense({
      id: 'e1', type: 'expense', amount: 60, date: '2026-11-01T08:55:00', note: '', storeName: 'Lidl Rzeszów',
      tags: [], source: 'manual', createdAt: '', updatedAt: '',
    });
    const res = await commitBankTx(ptx({}));
    expect(res.ok).toBe(true);
    expect(res.matched).toBe(true);
    const exps = useExpensesStore.getState().expenses;
    expect(exps).toHaveLength(1); // nie dodano drugiego
    expect(exps[0].bankMatched).toBe(true);
  });

  test('ten sam bank tx scommitowany drugi raz (re-drain) → wykrywa że już zaksięgowany, nie dubluje', async () => {
    await commitBankTx(ptx({ id: 'p1' }));
    expect(useExpensesStore.getState().expenses).toHaveLength(1);
    const res2 = await commitBankTx(ptx({ id: 'p2' })); // inny id kolejki, ta sama płatność
    expect(res2.matched).toBe(true);
    expect(useExpensesStore.getState().expenses).toHaveLength(1);
  });

  test('uczy pamięć sprzedawcy (merchant) po zaakceptowaniu', async () => {
    const res = await commitBankTx(ptx({ tags: ['spożywcze'] }));
    expect(res.merchant?.tags).toEqual(['spożywcze']);
    expect(res.merchant?.cleanAccepts).toBe(1);
  });
});

describe('commitBankTx — przychód przychodzący', () => {
  test('nowy przychód → dodaje, tag "wypłata" tylko gdy isPaycheck', async () => {
    const res = await commitBankTx(ptx({ direction: 'in', amount: 3000, store: 'Pracodawca', storeKey: 'pracodawca', isPaycheck: true }));
    expect(res.ok).toBe(true);
    const exps = useExpensesStore.getState().expenses;
    expect(exps[0]).toMatchObject({ type: 'income', amount: 3000, tags: ['wypłata'], bankMatched: true });
  });

  test('pasujący już dodany przychód → oznacza bankMatched, nie dubluje', async () => {
    useExpensesStore.getState().addExpense({
      id: 'e1', type: 'income', amount: 3000, date: '2026-11-01T09:00:00', note: '', tags: [],
      source: 'manual', createdAt: '', updatedAt: '',
    });
    const res = await commitBankTx(ptx({ direction: 'in', amount: 3000 }));
    expect(res.matched).toBe(true);
    expect(useExpensesStore.getState().expenses).toHaveLength(1);
  });
});
