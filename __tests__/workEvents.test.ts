import { titleTimeRange, shiftClockRange, shiftMinutes, shiftHours, isWorkEvent } from '@/utils/workEvents';

// Port z sapp (__tests__/workEvents.test.ts) — `elapsedShiftHours`/`shiftFireTimes`
// pominięte (nieportowane funkcje, patrz komentarz w src/types/work.ts: żywy
// licznik/powiadomienia zmiany świadomie nie w tej rundzie).

describe('workEvents — titleTimeRange (parsowanie zakresu godzin z tytułu)', () => {
  test('pełny zakres HH:MM - HH:MM', () => {
    expect(titleTimeRange('[JD] 10:00 - 21:00. (11h)')).toEqual({ startMin: 600, endMin: 1260 });
  });
  test('nocna zmiana (koniec przed początkiem) → +24h, żeby czas trwania był dodatni', () => {
    expect(titleTimeRange('22:00 - 06:00')).toEqual({ startMin: 1320, endMin: 1800 });
  });
  test('słowny wariant "od HH:MM do HH:MM"', () => {
    expect(titleTimeRange('od 10:00 do 18:00')).toEqual({ startMin: 600, endMin: 1080 });
  });
  test('zakres samych godzin bez minut (fallback), z i bez "od/do"', () => {
    expect(titleTimeRange('[JD] 10-21')).toEqual({ startMin: 600, endMin: 1260 });
    expect(titleTimeRange('od 9 do 17')).toEqual({ startMin: 540, endMin: 1020 });
  });
  test('tytuł bez ŻADNEJ informacji o czasie → null, nie zgaduje z przypadkowej liczby', () => {
    expect(titleTimeRange('[JD] Spotkanie')).toBeNull();
    expect(titleTimeRange('[JD] projekt 2026')).toBeNull();
    expect(titleTimeRange(undefined)).toBeNull();
  });
  test('zakres w tytule ma PIERWSZEŃSTWO nad znacznikiem (Nh), nawet gdy się nie zgadzają', () => {
    expect(titleTimeRange('[JD] 10:00-21:00 (8h)')).toEqual({ startMin: 600, endMin: 1260 });
  });
});

describe('workEvents — shiftClockRange (preferuje tytuł, potem czasy wydarzenia)', () => {
  test('zakres z tytułu zwrócony jako HH:MM, nocna zmiana "zawija się" z powrotem do 24h', () => {
    expect(shiftClockRange({ title: '22:00 - 06:00' })).toEqual({ start: '22:00', end: '06:00' });
  });
  test('brak zakresu w tytule → fallback do czasów samego wydarzenia', () => {
    expect(shiftClockRange({ title: 'Spotkanie', startTime: '09:00', endTime: '17:00' })).toEqual({ start: '09:00', end: '17:00' });
  });
  test('ani tytuł ani czasy wydarzenia → null', () => {
    expect(shiftClockRange({ title: 'Spotkanie' })).toBeNull();
  });
});

describe('workEvents — shiftMinutes / shiftHours (priorytet: zakres w tytule > (Nh) > czasy wydarzenia)', () => {
  test('zakres w tytule wygrywa nad wszystkim innym', () => {
    expect(shiftMinutes({ title: '[JD] 10:00 - 21:00', startTime: '09:00', endTime: '10:00' })).toBe(660);
  });
  test('brak zakresu, ale jest znacznik (Nh) → używa go (z przecinkiem lub kropką)', () => {
    expect(shiftMinutes({ title: '[JD] zmiana (8h)' })).toBe(480);
    expect(shiftHours({ title: '[JD] zmiana (8,5h)' })).toBe(8.5);
  });
  test('brak tytułowych wskazówek → fallback do czasów wydarzenia, z zawinięciem przez północ', () => {
    expect(shiftMinutes({ title: 'Zmiana', startTime: '22:00', endTime: '06:00' })).toBe(480);
  });
  test('kompletny brak danych → 0, nie NaN', () => {
    expect(shiftMinutes({ title: '' })).toBe(0);
  });
});

describe('workEvents — isWorkEvent (kolor LUB prefiks, ale TYLKO gdy jest jakaś informacja o czasie)', () => {
  const opts = { workColor: '#FF0000', workPrefix: '[JD]' };

  test('pasujący kolor + realne czasy wydarzenia → praca', () => {
    expect(isWorkEvent({ title: 'Zmiana', color: '#FF0000', startTime: '09:00', endTime: '17:00' }, opts)).toBe(true);
  });
  test('tytuł zaczynający się od prefiksu (bez uwzględniania wielkości liter) + zakres w tytule → praca', () => {
    expect(isWorkEvent({ title: '[jd] 10:00 - 18:00' }, opts)).toBe(true);
  });
  test('pasujący kolor, ale ZERO informacji o czasie → NIE praca', () => {
    expect(isWorkEvent({ color: '#FF0000', title: 'Coś tam' }, opts)).toBe(false);
  });
  test('prefiks pasuje, ale tytuł nie niesie żadnego czasu i brak startTime/endTime → NIE praca', () => {
    expect(isWorkEvent({ title: '[JD] tylko notatka' }, opts)).toBe(false);
  });
  test('ani kolor ani prefiks nie pasują, mimo że czasy są → NIE praca', () => {
    expect(isWorkEvent({ color: '#00FF00', title: 'Siłownia', startTime: '18:00', endTime: '19:00' }, opts)).toBe(false);
  });
  test('znacznik (Nh) w tytule sam w sobie liczy się jako "ma czas" nawet bez zakresu godzin', () => {
    expect(isWorkEvent({ title: '[JD] zmiana (8h)' }, opts)).toBe(true);
  });
});
