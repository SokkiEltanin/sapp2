import { luminance, isLightPage, inkOn, pageInk, patternPath } from '../src/utils/notePage';

describe('notePage', () => {
  test('luminance i jasna strona', () => {
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(luminance('#000000')).toBe(0);
    expect(luminance('zły')).toBe(0);
    expect(isLightPage('#F5F1E8')).toBe(true);
    expect(isLightPage('#141414')).toBe(false);
    expect(isLightPage(undefined)).toBe(false);
  });
  test('tusz: biały na jasnej stronie → czarny, kolory bez zmian', () => {
    expect(inkOn('#F2F2F2', true)).toBe('#1A1A1A');
    expect(inkOn('#EF4444', true)).toBe('#EF4444');
    expect(inkOn('#F2F2F2', false)).toBe('#F2F2F2');
    expect(inkOn('#000000', false)).toBe('#F2F2F2');
    expect(inkOn(undefined, true)).toBeUndefined();
  });
  test('pageInk', () => {
    expect(pageInk(undefined)).toEqual({ light: false });
    expect(pageInk({ pattern: 'grid' }).pattern).toBeUndefined();
    expect(pageInk({ bg: '#FFFFFF' }).light).toBe(true);
    expect(pageInk({ bg: '#0F172A' }).text).toBe('#D6D6D6');
  });
  test('wzory', () => {
    expect(patternPath('none', 100, 100, 22)).toBe('');
    expect(patternPath('lines', 0, 100, 22)).toBe('');
    expect(patternPath('lines', 100, 100, 22, 30)).toBe('M0 30H100M0 52H100M0 74H100M0 96H100');
    const grid = patternPath('grid', 44, 44, 22);
    expect((grid.match(/H/g) ?? []).length).toBe(3);
    expect((grid.match(/V/g) ?? []).length).toBe(3);
    expect((patternPath('dots', 44, 44, 22).match(/h0\.01/g) ?? []).length).toBe(9);
  });
});
