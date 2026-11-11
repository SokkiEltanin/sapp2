import { findPossibleDuplicate } from '@/utils/duplicateExpense';
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
