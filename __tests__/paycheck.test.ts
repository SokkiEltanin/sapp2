import { paycheckTargetMonth, isPaycheck } from '@/utils/paycheck';
import type { Expense } from '@/types/finances';

// Port z sapp (__tests__/paycheck.test.ts) — `paycheckTargetMonth` 1:1; `isPaycheck`
// dopisany tu (sapp2 nie ma oddzielnego `__tests__/useWorkEarnings.test.ts`, funkcja
// przeniosła się do paycheck.ts, patrz komentarz tam).

const p = (note: string, date: string) => paycheckTargetMonth({ note, date });

describe('paycheck — paycheckTargetMonth', () => {
  test('„WYPŁATA ZA <miesiąc>" → ten miesiąc', () => {
    expect(p('[JD] WYPŁATA ZA KWIECIEŃ', '2026-05-10')).toBe('2026-04');
    expect(p('wypłata za sierpień', '2026-08-25')).toBe('2026-08');
  });

  test('styczniowa wypłata „za grudzień" → grudzień POPRZEDNIEGO roku', () => {
    expect(p('WYPŁATA ZA GRUDZIEŃ', '2026-01-10')).toBe('2025-12');
  });

  test('brak „za <miesiąc>" → fallback: miesiąc PRZED datą (wynagrodzenie z dołu)', () => {
    expect(p('Wynagrodzenie', '2026-08-10')).toBe('2026-07');
  });

  test('nazwa pracodawcy zawierająca stem miesiąca NIE łapie (zamraża bug MARKETING→marzec)', () => {
    expect(p('MARKETING INVESTMENT GROUP', '2026-08-10')).toBe('2026-07');
  });
});

describe('paycheck — isPaycheck', () => {
  const e = (o: Partial<Expense>): Expense => ({
    id: 'x', type: 'income', amount: 3000, date: '2026-08-10', note: '', tags: [],
    source: 'manual', createdAt: '', updatedAt: '', ...o,
  });

  test('tag pasujący do prefiksu (bez wielkości liter) → wypłata', () => {
    expect(isPaycheck(e({ tags: ['[jd]'] }), '[JD]')).toBe(true);
  });
  test('prefiks w notatce → wypłata', () => {
    expect(isPaycheck(e({ note: '[JD] wypłata za lipiec' }), '[JD]')).toBe(true);
  });
  test('wydatek (nie przychód) → nigdy wypłata, nawet z pasującym tagiem', () => {
    expect(isPaycheck(e({ type: 'expense', tags: ['[jd]'] }), '[JD]')).toBe(false);
  });
  test('przychód bez pasującego tagu/notatki → nie wypłata (rygorystycznie, żeby dorywcza fucha się nie wliczyła)', () => {
    expect(isPaycheck(e({ tags: ['inne'], note: 'Zwrot' }), '[JD]')).toBe(false);
  });
  test('brak skonfigurowanego prefiksu → nigdy wypłata (sapp2 nie ma fallbacku na kategorię "salary")', () => {
    expect(isPaycheck(e({ tags: ['[jd]'] }), undefined)).toBe(false);
  });
});
