import { transactionsCsv, csvCell, csvFileName } from '@/utils/csvExport';

const E = (x: any) => ({ id: Math.random().toString(), type: 'expense', amount: 10, date: '2026-11-01', note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', ...x });

describe('eksport CSV', () => {
  it('nagłówek, BOM, średniki, przecinek dziesiętny, kolejność dat', () => {
    const csv = transactionsCsv([
      E({ date: '2026-11-05', storeName: 'Lidl', amount: 31.5, paymentMethod: 'card', receiptItems: [{ name: 'Ser', price: 8.99, quantity: 1, unitPrice: 12.98, discount: 3.99, foodSubcat: 'nabiał' }] }),
      E({ date: '2026-11-02', type: 'income', note: 'Wypłata', amount: 5000 }),
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe('Data;Typ;Sklep / opis;Kwota;Koszyk;Kategorie;Notatka;Płatność;Tagi;Pozycje');
    expect(lines[1]).toBe('2026-11-02;przychód;Wypłata;5000,00;przychód;Wypłata;;;;');
    expect(lines[2]).toContain('2026-11-05;wydatek;Lidl;-31,50;');
    expect(lines[2]).toContain('karta');
    expect(lines[2]).toContain('Ser 8,99 (−3,99)');
  });
  it('komórki ze średnikiem/cudzysłowem i nowymi liniami', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('powiedział "hej"')).toBe('"powiedział ""hej"""');
    expect(csvCell('linia1\nlinia2')).toBe('linia1 linia2');
  });
  it('nazwa pliku', () => {
    expect(csvFileName(new Date(2026, 10, 4))).toBe('sapp-transakcje-2026-11-04.csv');
  });
});
