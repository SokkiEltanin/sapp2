import {
  isFixedExpense, fixedVariableMonths, fixedDeviations, topVariableContributors,
  bucketOf, bucketTransactions, fvSplitOf,
} from '@/utils/fixedVariable';
import type { Expense, ReceiptItem } from '@/types/finances';

// Port z sapp (__tests__/fixedVariable.test.ts), PRZEPISANY pod sapp2's model bez
// sztywnej kategorii (patrz types/finances.ts, komentarz na górze) — Stałe teraz
// przez `subscriptionId`/dopasowanie słownika rachunków zamiast
// `category === 'housing'/'subscriptions'`, Jedzenie przez `ReceiptItem.foodSubcat`
// zamiast `category === 'groceries'` + tagi `tags:['pieczywo']`/`['nie jedzenie']`.
// Pominięte testy sapp'a zależne od funkcji nieportowanych w Fazie 2.1:
// `workFixedProgress` (czeka na ekran Praca) i self-transfer (czeka na Fazę 2.5,
// powiadomienia z banku).
const e = (o: Partial<Expense>): Expense => ({
  id: 'x', type: 'expense', amount: 0, date: '2026-08-04', note: '', tags: [],
  source: 'manual', createdAt: '', updatedAt: '', ...o,
});

const item = (o: Partial<ReceiptItem>): ReceiptItem => ({
  name: 'x', price: 0, quantity: 1, unitPrice: 0, ...o,
});

describe('fixedVariable — isFixedExpense', () => {
  test('subskrypcja i rozpoznany rachunek = stałe; przychód/zwykłe zakupy = nie', () => {
    expect(isFixedExpense(e({ subscriptionId: 'sub1', amount: 40 }))).toBe(true);
    expect(isFixedExpense(e({ note: 'Czynsz za mieszkanie', amount: 1000 }))).toBe(true);
    expect(isFixedExpense(e({ type: 'income', subscriptionId: 'sub1' }))).toBe(false);
    expect(isFixedExpense(e({ note: 'Biedronka - zakupy' }))).toBe(false);
  });
});

describe('fixedVariable — fixedVariableMonths', () => {
  test('rozdziela stałe/zmienne/jedzenie w danym miesiącu, pomija przychód', () => {
    const now = new Date(2026, 7, 15); // sierpień 2026
    const exps = [
      e({ note: 'Czynsz', amount: 1000, date: '2026-08-03' }), // stałe
      e({
        note: 'Biedronka', amount: 200, date: '2026-08-04',
        receiptItems: [item({ name: 'Chleb', price: 200, foodSubcat: 'pieczywo' })],
      }), // jedzenie
      e({ note: 'Kino', amount: 50, date: '2026-08-05' }), // zmienne
      e({ type: 'income', amount: 5000, date: '2026-08-01' }), // przychód (pomiń)
      e({ note: 'Czynsz', amount: 800, date: '2026-07-01' }), // inny miesiąc
    ];
    const [m] = fixedVariableMonths(exps, 1, now);
    expect(m.month).toBe('2026-08');
    expect(m.fixed).toBe(1000);
    expect(m.food).toBe(200);
    expect(m.variable).toBe(50);
  });

  test('respektuje fvOverride', () => {
    const exps = [
      e({ note: 'Czynsz', amount: 1000, date: '2026-08-03', fvOverride: 'variable' }),
      e({ note: 'Kino', amount: 50, date: '2026-08-05' }),
    ];
    const [m] = fixedVariableMonths(exps, 1, new Date(2026, 7, 15));
    expect(m.fixed).toBe(0);
    expect(m.variable).toBe(1050);
  });
});

describe('fixedVariable — fixedDeviations', () => {
  test('flaguje rachunek wyraźnie wyższy niż jego własna historyczna średnia', () => {
    const exps = [
      e({ note: 'Prąd', amount: 180, date: '2026-06-05' }),
      e({ note: 'Prąd', amount: 190, date: '2026-07-05' }),
      e({ note: 'Prąd', amount: 220, date: '2026-08-05' }),
    ];
    const out = fixedDeviations(exps, '2026-08', 3);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('Prąd');
    expect(out[0].amount).toBe(220);
    expect(out[0].avgAmount).toBe(185);
    expect(out[0].deltaPct).toBeGreaterThan(0.15);
  });

  test('nie flaguje małej, normalnej różnicy (poniżej progu)', () => {
    const exps = [
      e({ note: 'Internet', amount: 60, date: '2026-07-05' }),
      e({ note: 'Internet', amount: 62, date: '2026-08-05' }),
    ];
    expect(fixedDeviations(exps, '2026-08', 3)).toHaveLength(0);
  });

  test('nowy rachunek bez historii NIE jest fałszywie flagowany jako 100% skok', () => {
    const exps = [
      e({ subscriptionId: 'sub1', note: 'Nowy serwis', amount: 40, date: '2026-08-05' }),
    ];
    expect(fixedDeviations(exps, '2026-08', 3)).toHaveLength(0);
  });
});

describe('fixedVariable — topVariableContributors', () => {
  test('zwraca największe zmienne zakupy tego miesiąca, pomija stałe i jedzenie', () => {
    const exps = [
      e({ note: 'Czynsz', amount: 1200, date: '2026-08-03' }),
      e({
        note: 'Biedronka', amount: 300, date: '2026-08-04',
        receiptItems: [item({ name: 'Chleb', price: 300, foodSubcat: 'pieczywo' })],
      }),
      e({ note: 'Wiatrak', amount: 120, date: '2026-08-10' }),
      e({ note: 'Kino', amount: 40, date: '2026-08-12' }),
    ];
    const out = topVariableContributors(exps, '2026-08', 2);
    expect(out).toEqual([{ label: 'Wiatrak', amount: 120 }, { label: 'Kino', amount: 40 }]);
  });

  test('sumuje powtórzone zakupy w tym samym miejscu/nazwie', () => {
    const exps = [
      e({ note: 'Steam', amount: 30, date: '2026-08-02' }),
      e({ note: 'Steam', amount: 20, date: '2026-08-15' }),
    ];
    expect(topVariableContributors(exps, '2026-08', 1)).toEqual([{ label: 'Steam', amount: 50 }]);
  });
});

describe('fixedVariable — bucketOf (fvOverride ma pierwszeństwo)', () => {
  test('bez override: standardowa heurystyka (rachunek=fixed, jedzenie=food, reszta=variable)', () => {
    expect(bucketOf(e({ note: 'Czynsz', amount: 1000 }))).toBe('fixed');
    expect(bucketOf(e({
      note: 'Biedronka', amount: 100,
      receiptItems: [item({ name: 'Chleb', price: 100, foodSubcat: 'pieczywo' })],
    }))).toBe('food');
    expect(bucketOf(e({ note: 'Kino', amount: 50 }))).toBe('variable');
  });

  test('fvOverride nadpisuje heurystykę w obie strony', () => {
    expect(bucketOf(e({ note: 'Czynsz', amount: 1000, fvOverride: 'variable' }))).toBe('variable');
    expect(bucketOf(e({ note: 'Kino', amount: 50, fvOverride: 'fixed' }))).toBe('fixed');
  });

  test('fvOverride: null (wyczyszczone) wraca do heurystyki', () => {
    expect(bucketOf(e({ note: 'Czynsz', amount: 1000, fvOverride: null }))).toBe('fixed');
  });
});

// 2026-10-31 (port z sapp, user: "tak jak w jedzeniu mogę zaznaczyć że to nie
// jedzenie każdego produktu osobno" — ta sama zasada tutaj). `fvSplitOf` reużywa
// `foodAmountOf()` (per-produkt, przez `ReceiptItem.foodSubcat`) zamiast traktować
// CAŁY paragon jako jeden kubeł.
describe('fixedVariable — fvSplitOf (rozbicie mieszanego paragonu jedzenie/zmienne per produkt)', () => {
  test('paragon BEZ pozycji (i bez fvOverride): cała kwota idzie do variable, NIE food', () => {
    // Świadoma zmiana względem sapp (tam: category==='groceries' bez pozycji → cała
    // kwota = food) — sapp2 nie ma kategorii, więc bez pozycji/foodSubcat nie ma jak
    // zgadnąć że to jedzenie; user musi albo dodać pozycje, albo ustawić
    // fvOverride:'food' ręcznie.
    expect(fvSplitOf(e({ note: 'Biedronka', amount: 100 }))).toEqual({ fixed: 0, variable: 100, food: 0 });
  });

  test('mieszany paragon (jedzenie + nie-jedzenie) dzieli kwotę PROPORCJONALNIE do produktów', () => {
    const mixed = e({
      note: 'Biedronka', amount: 100,
      receiptItems: [
        item({ name: 'chleb', price: 30, foodSubcat: 'pieczywo' }),
        item({ name: 'proszek do prania', price: 70 }), // brak foodSubcat = nie jedzenie
      ],
    });
    expect(fvSplitOf(mixed)).toEqual({ fixed: 0, variable: 70, food: 30 });
  });

  test('zdjęcie foodSubcat z produktu przesuwa jego udział z food do variable', () => {
    const beforeTag = e({ amount: 50, receiptItems: [item({ name: 'cukierki', price: 50, foodSubcat: 'słodycze' })] });
    const afterTag = e({ amount: 50, receiptItems: [item({ name: 'cukierki', price: 50 })] });
    expect(fvSplitOf(beforeTag)).toEqual({ fixed: 0, variable: 0, food: 50 });
    expect(fvSplitOf(afterTag)).toEqual({ fixed: 0, variable: 50, food: 0 });
  });

  test('fvOverride na CAŁYM wydatku wygrywa ze wszystkim, nawet z mieszanym paragonem', () => {
    const mixed = e({
      amount: 100, fvOverride: 'variable',
      receiptItems: [item({ name: 'chleb', price: 30, foodSubcat: 'pieczywo' }), item({ name: 'mydło', price: 70 })],
    });
    expect(fvSplitOf(mixed)).toEqual({ fixed: 0, variable: 100, food: 0 });
  });

  test('rozpoznany rachunek stały idzie w 100% do fixed, ignorując ewentualne pozycje', () => {
    expect(fvSplitOf(e({ note: 'Czynsz', amount: 1000 }))).toEqual({ fixed: 1000, variable: 0, food: 0 });
  });

  test('bucketOf na mieszanym paragonie zwraca dominujący kubeł (większy udział)', () => {
    const mostlyFood = e({
      amount: 100,
      receiptItems: [item({ name: 'chleb', price: 80, foodSubcat: 'pieczywo' }), item({ name: 'mydło', price: 20 })],
    });
    expect(bucketOf(mostlyFood)).toBe('food');
  });

  test('fixedVariableMonths poprawnie sumuje mieszany paragon do OBU kubłów naraz', () => {
    const mixed = e({
      amount: 100, date: '2026-08-04',
      receiptItems: [item({ name: 'chleb', price: 30, foodSubcat: 'pieczywo' }), item({ name: 'proszek', price: 70 })],
    });
    const [m] = fixedVariableMonths([mixed], 1, new Date(2026, 7, 15));
    expect(m.food).toBe(30);
    expect(m.variable).toBe(70);
  });

  test('bucketTransactions pokazuje mieszany paragon w OBU zakładkach, każda tylko ze swoją częścią kwoty', () => {
    const mixed = e({
      id: 'm1', amount: 100, date: '2026-08-04', note: 'Biedronka',
      receiptItems: [item({ name: 'chleb', price: 30, foodSubcat: 'pieczywo' }), item({ name: 'proszek', price: 70 })],
    });
    const foodTx = bucketTransactions([mixed], '2026-08', 'food');
    const varTx = bucketTransactions([mixed], '2026-08', 'variable');
    expect(foodTx).toEqual([{ id: 'm1', label: 'Biedronka', amount: 30, date: '2026-08-04', overridden: false }]);
    expect(varTx).toEqual([{ id: 'm1', label: 'Biedronka', amount: 70, date: '2026-08-04', overridden: false }]);
  });
});

describe('fixedVariable — bucketTransactions', () => {
  test('zwraca surową, chronologiczną (najnowsze pierwsze) listę transakcji danego kubła', () => {
    const exps = [
      e({ id: 'a', note: 'Kino', amount: 40, date: '2026-08-05' }),
      e({ id: 'b', note: 'Wiatrak', amount: 120, date: '2026-08-10' }),
      e({ id: 'c', note: 'Czynsz', amount: 1200, date: '2026-08-03' }),
    ];
    const out = bucketTransactions(exps, '2026-08', 'variable');
    expect(out.map((t) => t.id)).toEqual(['b', 'a']);
    expect(out.every((t) => t.overridden === false)).toBe(true);
  });

  test('flaguje overridden i respektuje przeklasyfikowanie', () => {
    const exps = [
      e({ id: 'a', note: 'Czynsz', amount: 100, date: '2026-08-05', fvOverride: 'variable' }),
    ];
    expect(bucketTransactions(exps, '2026-08', 'fixed')).toHaveLength(0);
    const out = bucketTransactions(exps, '2026-08', 'variable');
    expect(out).toEqual([{ id: 'a', label: 'Czynsz', amount: 100, date: '2026-08-05', overridden: true }]);
  });
});
