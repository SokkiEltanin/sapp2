import { parseBankNotification, findExpenseForBankTx, amountMatches } from '@/utils/bankNotification';

// 2026-11-12, user: "jak dodaję paragon z lidla... dubluje a powinno rozumieć
// że to to samo co złapało z powiadomień". Kierunek: paragon NAJPIERW, potem
// zatwierdzenie płatności z banku — ma się połączyć z paragonem.
const CARD = 'Zapłacono kwotę 10,18 PLN karta *8743 dnia 03-07-2026 godz. 06:37:30 w LIDL HETMANSKA LIDL HETMANSKA Rzeszow POL. Bank Pekao S.A.';

describe('paragon dodany przed powiadomieniem', () => {
  const tx = parseBankNotification(CARD)!;

  test('paragon z tą samą kwotą i dniem (data bez godziny) → łączy', () => {
    const receipt = { id: 'r', type: 'expense', amount: 10.18, date: '2026-07-03', storeName: 'Lidl' };
    expect(findExpenseForBankTx(tx, [receipt])?.id).toBe('r');
  });

  test('paragon z wykluczoną pozycją: kwota netto ≠ karta, ale pełna suma pozycji = karta → łączy', () => {
    const receipt = {
      id: 'r', type: 'expense', amount: 8.18, date: '2026-07-03', storeName: 'Lidl',
      receiptItems: [{ price: 8.18 }, { price: 2.0 }],
    };
    expect(amountMatches(receipt, 10.18)).toBe(true);
    expect(findExpenseForBankTx(tx, [receipt])?.id).toBe('r');
  });

  test('inny dzień i inna kwota → brak', () => {
    expect(findExpenseForBankTx(tx, [{ id: 'x', type: 'expense', amount: 10.18, date: '2026-07-05', storeName: 'Lidl' }])).toBeNull();
    expect(findExpenseForBankTx(tx, [{ id: 'y', type: 'expense', amount: 12, date: '2026-07-03', storeName: 'Lidl' }])).toBeNull();
  });
});
