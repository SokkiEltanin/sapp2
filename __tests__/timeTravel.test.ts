// "Podróż w czasie" (2026-11-25, user: "samowystarczalna na długo") — przełom roku, rok
// przestępny, zmiana czasu. Błędy dat wychodzą zwykle dopiero 1 stycznia.
import { monthPace, yearPace, monthlySeries } from '@/utils/monthPace';
import { budgetHistory, budgetStatus } from '@/utils/budgets';
import { nextBirthday, ageOn } from '@/utils/profile';
import { countdownParts } from '@/utils/countdown';
import { buildMonthCards } from '@/utils/monthCards';
import { dayNumber } from '@/utils/insightRotation';
import { isBackupDue } from '@/utils/backupSnapshot';
import type { Expense } from '@/types/finances';

const ex = (date: string, amount: number, extra: Partial<Expense> = {}): Expense =>
  ({ id: date + amount, type: 'expense', amount, date, note: '', storeName: 'Sklep', tags: [], createdAt: date, updatedAt: date, ...extra } as Expense);

const data = [ex('2026-10-02', 100), ex('2026-11-02', 200), ex('2026-12-02', 300), ex('2026-12-31T23:30:00', 50), ex('2027-01-01T00:10:00', 40), ex('2026-01-01', 10)];

describe('przełom roku', () => {
  const ny = new Date(2027, 0, 1, 9, 0);
  it('tempo miesiąca 1 stycznia porównuje z paź–gru poprzedniego roku', () => {
    const p = monthPace(data, 'all', ny);
    expect(p.current).toBe(40);
    expect(p.months.map((m) => m.key)).toEqual(['2026-10', '2026-11', '2026-12']);
  });
  it('rok do dziś: nowy rok liczy się od zera, rok temu = 1 stycznia 2026', () => {
    const y = yearPace(data, 'all', ny);
    expect(y.current).toBe(40);
    expect(y.last).toBe(10);
  });
  it('12 miesięcy kończy się na styczniu, bez dziur i dubli', () => {
    const s = monthlySeries(data, 'all', 12, new Date(2027, 0, 15));
    expect(s.map((x) => x.key)).toEqual(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
    expect(s[10].value).toBe(350);
  });
  it('historia budżetu w styczniu = lip–gru poprzedniego roku; status liczy tylko styczeń', () => {
    const b = { id: 'b', scope: 'all', limit: 100, createdAt: '2026-01-01' } as any;
    expect(budgetHistory(b, data, 6, new Date(2027, 0, 5)).map((m) => m.key)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
    expect(budgetStatus(b, data, new Date(2027, 0, 5)).spent).toBe(40);
  });
  it('karty miesięcy: grudzień jest gotową kartą 1 stycznia', () => {
    const cards = buildMonthCards(data, {} as any, new Date(2027, 0, 1, 12));
    expect(cards.map((c: any) => c.key)).toContain('2026-12');
    expect(cards.map((c: any) => c.key)).not.toContain('2027-01');
  });
  it('urodziny 1 stycznia widziane 31 grudnia', () => {
    expect(nextBirthday('1995-01-01', new Date(2026, 11, 31, 20))).toEqual({ date: '2027-01-01', days: 1, turns: 32 });
  });
});

describe('rok przestępny i zmiana czasu', () => {
  it('urodziny 29.02: w nieprzestępnym 28.02, w przestępnym 29.02', () => {
    expect(nextBirthday('2000-02-29', new Date(2027, 1, 1))!.date).toBe('2027-02-28');
    expect(nextBirthday('2000-02-29', new Date(2028, 1, 1))!.date).toBe('2028-02-29');
    expect(ageOn('2000-02-29', new Date(2028, 1, 29))).toBe(28);
  });
  it('tempo 29 lutego (przestępny) i 31 marca vs luty', () => {
    const d = [ex('2028-01-29', 10), ex('2028-02-29', 20), ex('2028-03-31', 30)];
    expect(monthPace(d, 'all', new Date(2028, 1, 29)).current).toBe(20);
    expect(monthPace(d, 'all', new Date(2028, 2, 31)).months.find((m) => m.key === '2028-02')!.value).toBe(20);
  });
  it('numer dnia rośnie o 1 przez zmianę czasu (marzec i październik)', () => {
    expect(dayNumber(new Date(2027, 2, 28, 12)) - dayNumber(new Date(2027, 2, 27, 12))).toBe(1);
    expect(dayNumber(new Date(2026, 9, 25, 1)) - dayNumber(new Date(2026, 9, 24, 23))).toBe(1);
  });
  it('odliczanie przez zmianę czasu nie daje ujemnych ani zawyżonych dni', () => {
    const p = countdownParts(new Date(2027, 2, 29, 10), new Date(2027, 2, 27, 10));
    expect(p.past).toBe(false);
    expect(p.days).toBe(1); // 47 h realnego czasu (noc z 28 na 29 krótsza o godzinę)
    expect(p.hours).toBe(23);
  });
  it('kopia "co 6 h" przez północ sylwestrową', () => {
    expect(isBackupDue('2026-12-31T21:00:00.000Z', new Date('2027-01-01T03:00:00.000Z'), 6)).toBe(true);
    expect(isBackupDue('2026-12-31T23:00:00.000Z', new Date('2027-01-01T03:00:00.000Z'), 6)).toBe(false);
  });
});
