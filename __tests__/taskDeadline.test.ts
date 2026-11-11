import { deadlineLabel, deadlineHasTime, parseDeadline } from '@/utils/taskDeadline';

// 2026-11-11 — etykieta terminu na liście zadań (wcześniej niewidoczny).
const now = new Date(2026, 10, 11, 12, 0); // śr. 11 lis 2026, 12:00

describe('deadlineLabel', () => {
  test('date-only dziś → "Dziś", nie zaległe przez cały dzień', () => {
    expect(deadlineLabel('2026-11-11', now)).toEqual({ text: 'Dziś', overdue: false });
  });

  test('date-only jutro → "Jutro"', () => {
    expect(deadlineLabel('2026-11-12', now)).toEqual({ text: 'Jutro', overdue: false });
  });

  test('w ciągu tygodnia → skrót dnia tygodnia', () => {
    expect(deadlineLabel('2026-11-14', now).text).toBe('sob.');
  });

  test('dalej niż tydzień → dzień + miesiąc', () => {
    expect(deadlineLabel('2026-11-25', now).text).toBe('25 lis');
  });

  test('date-only w przeszłości → zaległe', () => {
    expect(deadlineLabel('2026-11-08', now)).toEqual({ text: 'Zaległe · 8 lis', overdue: true });
    expect(deadlineLabel('2026-11-10', now)).toEqual({ text: 'Zaległe · Wczoraj', overdue: true });
  });

  test('z godziną: dziś później → nie zaległe, z godziną w etykiecie', () => {
    expect(deadlineLabel('2026-11-11T18:30:00', now)).toEqual({ text: 'Dziś · 18:30', overdue: false });
  });

  test('z godziną: dziś, godzina już minęła → zaległe (bez prefiksu "Zaległe", dzień ten sam)', () => {
    expect(deadlineLabel('2026-11-11T09:00:00', now)).toEqual({ text: 'Dziś · 09:00', overdue: true });
  });
});

describe('deadlineHasTime / parseDeadline', () => {
  test('rozróżnia date-only od daty z godziną', () => {
    expect(deadlineHasTime('2026-11-11')).toBe(false);
    expect(deadlineHasTime('2026-11-11T09:00:00')).toBe(true);
  });

  test('date-only parsowane jako lokalna północ (nie UTC)', () => {
    const d = parseDeadline('2026-11-11');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 11, 0]);
  });
});
