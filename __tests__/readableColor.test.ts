import { readableOnDark, luminance } from '@/utils/readableColor';

describe('czytelne kolory na ciemnym tle', () => {
  it('jasne zostają bez zmian', () => {
    expect(readableOnDark('#FBBF24')).toBe('#FBBF24');
    expect(readableOnDark('#F2F2F2')).toBe('#F2F2F2');
  });
  it('ciemne są rozjaśniane do progu, zachowując odcień', () => {
    const blue = readableOnDark('#2563EB');
    expect(blue).not.toBe('#2563EB');
    expect(luminance(blue)).toBeGreaterThanOrEqual(0.3);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(blue.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r); // dalej niebieski
    expect(luminance(readableOnDark('#3A3A3A'))).toBeGreaterThanOrEqual(0.3);
  });
  it('śmieci przechodzą bez zmian', () => {
    expect(readableOnDark('red')).toBe('red');
  });
});
