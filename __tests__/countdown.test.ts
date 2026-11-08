import { countdownParts, formatCountdown } from '@/utils/countdown';

describe('countdown — countdownParts/formatCountdown', () => {
  const now = new Date(2026, 0, 1, 12, 0, 0);

  test('kilka dni naprzód → "X dni Yh"', () => {
    const target = new Date(2026, 0, 4, 15, 0, 0); // 3 dni 3h
    const p = countdownParts(target, now);
    expect(p.days).toBe(3);
    expect(p.hours).toBe(3);
    expect(p.past).toBe(false);
    expect(formatCountdown(p)).toBe('3 dni 3h');
  });

  test('dokładnie 1 dzień → liczba pojedyncza "dzień"', () => {
    const target = new Date(2026, 0, 2, 12, 0, 0);
    const p = countdownParts(target, now);
    expect(formatCountdown(p)).toBe('1 dzień 0h');
  });

  test('mniej niż dzień, kilka godzin → "Xh Ym"', () => {
    const target = new Date(2026, 0, 1, 15, 30, 0); // 3h30m
    const p = countdownParts(target, now);
    expect(p.days).toBe(0);
    expect(p.hours).toBe(3);
    expect(formatCountdown(p)).toBe('3h 30m');
  });

  test('mniej niż godzina → tylko minuty', () => {
    const target = new Date(2026, 0, 1, 12, 20, 0);
    const p = countdownParts(target, now);
    expect(p.hours).toBe(0);
    expect(formatCountdown(p)).toBe('20 min');
  });

  test('wydarzenie już minęło → past:true, "już się zaczęło"', () => {
    const target = new Date(2026, 0, 1, 10, 0, 0);
    const p = countdownParts(target, now);
    expect(p.past).toBe(true);
    expect(formatCountdown(p)).toBe('już się zaczęło');
  });

  test('wydarzenie trwa TERAZ (totalMs=0) → traktowane jako już trwające', () => {
    const p = countdownParts(now, now);
    expect(p.past).toBe(true);
  });
});
