import { findPossibleDuplicate, findReceiptTarget, isConfidentReceiptMatch, mergeReceiptInto } from '@/utils/duplicateExpense';
import type { Expense } from '@/types/finances';

// 2026-11-11, user: "jak dodałem z opóźnieniem paragon to mi nie złapało że
// to ta sama suma pieniążków i dzień i przez to mi się zdublowało" — Lidl
// złapany najpierw powiadomieniem z banku (`bankMatched:true`, data z
// czasem), potem user ręcznie wkleił paragon tej samej transakcji z
// opóźnieniem (data bez czasu) → zero wykrycia, dwa wydatki. Inny kierunek
// niż `findMatchingExpense` (bankNotification.ts), która świadomie pomija
// `bankMatched` — tu sprawdzamy WSZYSTKIE istniejące wydatki.
const e = (o: Partial<Expense>): Expense => ({
  id: 'x', type: 'expense', amount: 0, date: '2026-11-10', note: '', tags: [],
  source: 'manual', createdAt: '', updatedAt: '', ...o,
});

describe('findPossibleDuplicate', () => {
  test('ta sama kwota i dzień (nawet z czasem w dacie istniejącego) → duplikat, NIEZALEŻNIE od bankMatched', () => {
    const existing = e({ id: 'e1', storeName: 'Lidl', amount: 48.84, date: '2026-11-10T06:23:00', bankMatched: true });
    const dup = findPossibleDuplicate({ amount: 48.84, date: '2026-11-10' }, [existing]);
    expect(dup?.id).toBe('e1');
  });

  test('inna kwota → brak duplikatu', () => {
    const existing = e({ id: 'e1', amount: 48.84, date: '2026-11-10' });
    expect(findPossibleDuplicate({ amount: 50.0, date: '2026-11-10' }, [existing])).toBeNull();
  });

  test('ta sama kwota, inny dzień → brak duplikatu', () => {
    const existing = e({ id: 'e1', amount: 48.84, date: '2026-11-09' });
    expect(findPossibleDuplicate({ amount: 48.84, date: '2026-11-10' }, [existing])).toBeNull();
  });

  test('pomija przychody', () => {
    const existing = e({ id: 'e1', type: 'income', amount: 48.84, date: '2026-11-10' });
    expect(findPossibleDuplicate({ amount: 48.84, date: '2026-11-10' }, [existing])).toBeNull();
  });

  test('dopasowuje też po originalAmount (płatność walutowa przeliczona)', () => {
    const existing = e({ id: 'e1', amount: 220, originalAmount: 48.84, date: '2026-11-10' });
    expect(findPossibleDuplicate({ amount: 48.84, date: '2026-11-10' }, [existing])?.id).toBe('e1');
  });

  test('pusta historia → brak duplikatu', () => {
    expect(findPossibleDuplicate({ amount: 48.84, date: '2026-11-10' }, [])).toBeNull();
  });
});

describe('paragon ↔ płatność z banku (2026-11-12)', () => {
  const bank = e({ id: 'b', storeName: 'LIDL SP. Z O.O.', note: 'LIDL SP. Z O.O.', amount: 47.67, date: '2026-11-12T13:51:33', bankMatched: true, source: 'bank-auto', tags: ['Jedzenie'], paymentMethod: 'card' });

  test('wybiera wpis bez paragonu z tym samym sklepem', () => {
    const other = e({ id: 'o', storeName: 'Kaufland', amount: 47.67, date: '2026-11-12', receiptItems: [{ name: 'x', price: 47.67, quantity: 1, unitPrice: 47.67 }] as any });
    expect(findReceiptTarget({ amount: 47.67, date: '2026-11-12', storeName: 'Lidl' }, [other, bank])?.id).toBe('b');
  });

  test('pewne dopasowanie tylko dla bankowego wpisu bez paragonu z tym samym sklepem', () => {
    expect(isConfidentReceiptMatch(bank, 'Lidl')).toBe(true);
    expect(isConfidentReceiptMatch(bank, 'Biedronka')).toBe(false);
    expect(isConfidentReceiptMatch({ ...bank, bankMatched: false }, 'Lidl')).toBe(false);
  });

  test('merge: pozycje i sklep z paragonu, data z banku zostaje, tagi łączone', () => {
    const items = [{ name: 'Mleko', price: 47.67, quantity: 1, unitPrice: 47.67 }] as any;
    const patch = mergeReceiptInto(bank, { amount: 47.67, storeName: 'Lidl', tags: ['jedzenie', 'Nabiał'], receiptItems: items, note: '' });
    expect(patch.receiptItems).toBe(items);
    expect(patch.storeName).toBe('Lidl');
    expect(patch.tags).toEqual(['Jedzenie', 'Nabiał']);
    expect(patch.note).toBe('LIDL SP. Z O.O.');
    expect(patch).not.toHaveProperty('date');
  });
});
