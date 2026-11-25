import { FACT_LIST } from '../src/utils/factsData';
import { FACT_ART, ART_BY_FACT, ART_SIZE, artKeyFor } from '../src/utils/factArt';

describe('ikony ciekawostek', () => {
  it('każda ciekawostka ma przypisany, istniejący motyw', () => {
    const missing = FACT_LIST.filter((f) => !ART_BY_FACT[f.id] || !FACT_ART[ART_BY_FACT[f.id]]).map((f) => f.id);
    expect(missing).toEqual([]);
  });

  it('każdy rysunek ma 16×16 i kolory z palety', () => {
    for (const [k, a] of Object.entries(FACT_ART)) {
      expect([k, a.rows.length]).toEqual([k, ART_SIZE]);
      for (const r of a.rows) {
        expect([k, r.length]).toEqual([k, ART_SIZE]);
        for (const ch of r) if (ch !== '.') expect([k, !!a.pal[ch]]).toEqual([k, true]);
      }
    }
  });

  it('nowa ciekawostka bez wpisu: słowo kluczowe, potem dziedzina', () => {
    expect(artKeyFor({ id: 'nowa-1', cat: 'zdrowie', topic: 'Drzemka po obiedzie', teaser: 'Krótki sen pomaga.' })).toBe('sleep');
    expect(artKeyFor({ id: 'nowa-2', cat: 'kosmos', topic: 'Coś innego', teaser: 'Bez słów kluczowych.' })).toBe('star');
  });
});
