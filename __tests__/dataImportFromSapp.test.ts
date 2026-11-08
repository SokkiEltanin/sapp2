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
