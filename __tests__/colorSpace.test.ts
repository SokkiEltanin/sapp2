import { hslToHex, hexToHsl, spectrumAt } from '@/utils/colorSpace';

describe('colorSpace', () => {
  test('podstawowe', () => {
    expect(hslToHex({ h: 0, s: 100, l: 50 })).toBe('#FF0000');
    expect(hslToHex({ h: 120, s: 100, l: 50 })).toBe('#00FF00');
    expect(hslToHex({ h: 240, s: 100, l: 50 })).toBe('#0000FF');
    expect(hslToHex({ h: 0, s: 0, l: 100 })).toBe('#FFFFFF');
    expect(hslToHex({ h: 0, s: 0, l: 0 })).toBe('#000000');
  });
  test('w obie strony', () => {
    for (const hex of ['#FF8800', '#00C2A8', '#8B5CF6', '#D6D6D6']) {
      const back = hslToHex(hexToHsl(hex)!);
      const diff = (a: string, b: string, i: number) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16));
      expect(Math.max(diff(hex, back, 1), diff(hex, back, 3), diff(hex, back, 5))).toBeLessThanOrEqual(3);
    }
    expect(hexToHsl('zly')).toBeNull();
  });
  test('spektrum: góra biała, dół czarny', () => {
    expect(hslToHex(spectrumAt(0.5, 0, 100))).toBe('#FFFFFF');
    expect(hslToHex(spectrumAt(0.5, 1, 100))).toBe('#000000');
    expect(hslToHex(spectrumAt(0, 0.5, 100))).toBe('#FF0000');
  });
});
