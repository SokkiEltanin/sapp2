import { parseNumberInput, shouldSyncNumberText, formatNumberInput } from '@/utils/numberInput';

// 2026-11-11 — pola liczbowe gubiły przecinek ("12," → "12") i nie dało się
// skasować "0". Logika `NumberInput` wydzielona do testów.
describe('parseNumberInput', () => {
  test('przecinek jak kropka', () => {
    expect(parseNumberInput('12,5')).toBe(12.5);
    expect(parseNumberInput('0,5')).toBe(0.5);
  });
  test('niedokończone "12," → 12 (liczba), tekst zostaje w polu osobno', () => {
    expect(parseNumberInput('12,')).toBe(12);
  });
  test('puste / śmieci → undefined', () => {
    expect(parseNumberInput('')).toBeUndefined();
    expect(parseNumberInput('  ')).toBeUndefined();
    expect(parseNumberInput('abc')).toBeUndefined();
  });
});

describe('shouldSyncNumberText', () => {
  test('tekst w trakcie pisania znaczący tę samą liczbę → NIE nadpisuj (przecinek zostaje)', () => {
    expect(shouldSyncNumberText('12,', 12)).toBe(false);
    expect(shouldSyncNumberText('0,50', 0.5)).toBe(false);
    expect(shouldSyncNumberText('0,', 0)).toBe(false);
  });
  test('wyczyszczone pole przy wartości 0/undefined → NIE wracaj do "0"', () => {
    expect(shouldSyncNumberText('', 0)).toBe(false);
    expect(shouldSyncNumberText('', undefined)).toBe(false);
  });
  test('wartość zmieniona z zewnątrz (np. przeliczona cena) → nadpisz', () => {
    expect(shouldSyncNumberText('10', 12.5)).toBe(true);
    expect(shouldSyncNumberText('', 7)).toBe(true);
  });
});

describe('formatNumberInput', () => {
  test('undefined → pusty tekst, liczba → String', () => {
    expect(formatNumberInput(undefined)).toBe('');
    expect(formatNumberInput(4200)).toBe('4200');
  });
});
