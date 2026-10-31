import { sortMoodTags, tagRelevance, PRESET_TAGS, POSITIVE_TAGS, NEGATIVE_TAGS, HIGH_ENERGY_TAGS, LOW_ENERGY_TAGS } from '@/utils/moodTags';
import type { MoodEntry } from '@/types/mood';

// Port z sapp (__tests__/moodTags.test.ts) 1:1 — logika kategorio-niezależna, tylko
// import path zmieniony (@/types → @/types/mood).
const NOW = new Date('2026-09-19T18:00:00');
const empty: MoodEntry[] = [];

let seq = 0;
const entry = (tags: string[], o: Partial<MoodEntry> = {}): MoodEntry => ({
  id: `e${seq++}`, date: '2026-09-01', mood: 3, energy: 3, tags,
  createdAt: '2026-09-01T12:00:00', updatedAt: '2026-09-01T12:00:00',
  ...o,
});

describe('moodTags — sortMoodTags/tagRelevance', () => {
  test('bez wybranego nastroju/energii, bez historii → kolejność PRESET_TAGS bez zmian', () => {
    expect(sortMoodTags(undefined, undefined, empty, NOW)).toEqual(PRESET_TAGS);
  });

  test('bez wybranego nastroju/energii → częściej i świeżej używany tag wyżej', () => {
    const entries = [
      ...Array.from({ length: 5 }, () => entry(['smutny'], { date: '2026-09-18', createdAt: '2026-09-18T12:00:00' })),
      entry(['radosny'], { date: '2026-01-01', createdAt: '2026-01-01T12:00:00' }),
    ];
    const sorted = sortMoodTags(undefined, undefined, entries, NOW);
    expect(sorted.indexOf('smutny')).toBeLessThan(sorted.indexOf('radosny'));
  });

  test('dobry nastrój (mood=5) → tagi pozytywne wyżej niż negatywne', () => {
    const sorted = sortMoodTags(5, undefined, empty, NOW);
    expect(sorted.indexOf('szczęśliwy')).toBeLessThan(sorted.indexOf('smutny'));
  });

  test('zły nastrój (mood=1) → tagi negatywne wyżej niż pozytywne', () => {
    const sorted = sortMoodTags(1, undefined, empty, NOW);
    expect(sorted.indexOf('smutny')).toBeLessThan(sorted.indexOf('szczęśliwy'));
  });

  test('niska energia (energy=1) → "zmęczony"/"niewyspany" wyżej niż tag niezwiązany z energią', () => {
    const sorted = sortMoodTags(undefined, 1, empty, NOW);
    expect(sorted.indexOf('zmęczony')).toBeLessThan(sorted.indexOf('towarzyski'));
    expect(sorted.indexOf('niewyspany')).toBeLessThan(sorted.indexOf('towarzyski'));
  });

  test('wysoka energia (energy=5) → "pełen energii" wyżej niż "zmęczony"', () => {
    const sorted = sortMoodTags(undefined, 5, empty, NOW);
    expect(sorted.indexOf('pełen energii')).toBeLessThan(sorted.indexOf('zmęczony'));
  });

  test('"szczęśliwy ale niewyspany" (mood=5, energy=1) → OBIE osie na górze, nie tylko nastrój', () => {
    const sorted = sortMoodTags(5, 1, empty, NOW);
    const badFitIdx = sorted.indexOf('smutny');
    expect(sorted.indexOf('szczęśliwy')).toBeLessThan(badFitIdx);
    expect(sorted.indexOf('niewyspany')).toBeLessThan(badFitIdx);
    expect(sorted.indexOf('zmęczony')).toBeLessThan(badFitIdx);
    expect(tagRelevance('zmęczony', 1, -1)).toBeGreaterThanOrEqual(tagRelevance('pełen energii', 1, -1));
  });

  test('"zmęczony" NIE jest już w NEGATIVE_TAGS (regresja naprawionego buga)', () => {
    expect(NEGATIVE_TAGS.has('zmęczony')).toBe(false);
    expect(POSITIVE_TAGS.has('zmęczony')).toBe(false);
  });

  test('"niewyspany" jest realnym presetem (user nazwał go wprost)', () => {
    expect(PRESET_TAGS).toContain('niewyspany');
  });

  test('sortMoodTags zawsze zwraca dokładnie te same tagi co PRESET_TAGS (żaden nie ginie/duplikuje)', () => {
    const sorted = sortMoodTags(3, 3, empty, NOW);
    expect([...sorted].sort()).toEqual([...PRESET_TAGS].sort());
  });

  test('tag używany zwykle o TEJ porze dnia (±2h) wyżej niż równie częsty, ale o innej porze', () => {
    const dates = ['2026-01-10', '2026-02-10', '2026-03-10', '2026-04-10', '2026-05-10'];
    const entries = [
      ...dates.map(d => entry(['niewyspany'], { date: d, createdAt: `${d}T08:00:00` })),
      ...dates.map(d => entry(['zestresowany'], { date: d, createdAt: `${d}T20:00:00` })),
    ];
    const morning = new Date('2026-09-19T08:30:00');
    const sorted = sortMoodTags(undefined, undefined, entries, morning);
    expect(sorted.indexOf('niewyspany')).toBeLessThan(sorted.indexOf('zestresowany'));
  });

  test('recency: tag użyty niedawno wyżej niż równie trafny, ale nieużywany od miesięcy', () => {
    const entries = [
      entry(['radosny'], { date: '2026-09-17', createdAt: '2026-09-17T18:00:00' }),
      entry(['szczęśliwy'], { date: '2026-03-01', createdAt: '2026-03-01T18:00:00' }),
    ];
    const sorted = sortMoodTags(undefined, undefined, entries, NOW);
    expect(sorted.indexOf('radosny')).toBeLessThan(sorted.indexOf('szczęśliwy'));
  });
});

describe('moodTags — integralność rozszerzonej listy (56 presetów)', () => {
  test('brak zduplikowanych tagów w PRESET_TAGS', () => {
    expect(new Set(PRESET_TAGS).size).toBe(PRESET_TAGS.length);
  });

  test('POSITIVE_TAGS i NEGATIVE_TAGS się nie przecinają (tag nie może ciągnąć w obie strony naraz)', () => {
    const overlap = [...POSITIVE_TAGS].filter(t => NEGATIVE_TAGS.has(t));
    expect(overlap).toEqual([]);
  });

  test('HIGH_ENERGY_TAGS i LOW_ENERGY_TAGS się nie przecinają', () => {
    const overlap = [...HIGH_ENERGY_TAGS].filter(t => LOW_ENERGY_TAGS.has(t));
    expect(overlap).toEqual([]);
  });

  test('każdy tag z 4 zbiorów sentymentu/energii realnie istnieje w PRESET_TAGS (literówka łatwo rozjeżdża zbiór od listy)', () => {
    const preset = new Set(PRESET_TAGS);
    for (const t of [...POSITIVE_TAGS, ...NEGATIVE_TAGS, ...HIGH_ENERGY_TAGS, ...LOW_ENERGY_TAGS]) {
      expect(preset.has(t)).toBe(true);
    }
  });

  test('nowe tagi z tej rundy (duma, wina, znudzenie, wypalenie…) realnie są presetami', () => {
    for (const t of ['dumny', 'winny', 'znudzony', 'wypalony', 'zrezygnowany', 'ambitny']) {
      expect(PRESET_TAGS).toContain(t);
    }
  });

  test('"zaskoczony" świadomie neutralny — w ŻADNYM z dwóch zbiorów nastroju', () => {
    expect(POSITIVE_TAGS.has('zaskoczony')).toBe(false);
    expect(NEGATIVE_TAGS.has('zaskoczony')).toBe(false);
  });

  test('"wyczerpany"/"leniwy" czysto energetyczne jak "zmęczony" — poza obiema osiami nastroju', () => {
    for (const t of ['wyczerpany', 'leniwy']) {
      expect(POSITIVE_TAGS.has(t)).toBe(false);
      expect(NEGATIVE_TAGS.has(t)).toBe(false);
    }
  });
});
