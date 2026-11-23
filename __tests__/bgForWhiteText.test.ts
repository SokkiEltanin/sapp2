import { bgForWhiteText, luminance } from '@/utils/readableColor';

describe('tło pod biały tekst', () => {
  it('jasny żółty (Google „banan”) przyciemniony, ciemne bez zmian', () => {
    const y = bgForWhiteText('#F6BF26');
    expect(y).not.toBe('#F6BF26');
    expect(luminance(y)).toBeLessThanOrEqual(0.2);
    expect(luminance(y)).toBeGreaterThan(0.12); // dalej żółty, nie czarny
    expect(bgForWhiteText('#3F51B5')).toBe('#3F51B5');
  });
});
