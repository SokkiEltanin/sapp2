import { applyStyle, onTextEdit, styleAt, allHave, fitRuns, segments, normalize } from '@/utils/richText';

describe('formatowanie notatki', () => {
  const text = 'Ala ma kota';
  const plain = fitRuns(undefined, text.length);

  it('bold fragmentu i scalanie', () => {
    const r = applyStyle(plain, 4, 6, { b: true });
    expect(r).toEqual([{ n: 4 }, { n: 2, b: true }, { n: 5 }]);
    expect(segments(text, r).map((x) => x.t)).toEqual(['Ala ', 'ma', ' kota']);
    expect(applyStyle(r, 4, 6, { b: false })).toEqual([{ n: 11 }]);
  });

  it('zaznaczenie przez kilka odcinków', () => {
    const r = applyStyle(applyStyle(plain, 0, 3, { c: '#f00' }), 2, 8, { z: 'xl' });
    expect(r).toEqual([{ n: 2, c: '#f00' }, { n: 1, c: '#f00', z: 'xl' }, { n: 5, z: 'xl' }, { n: 3 }]);
    expect(allHave(applyStyle(plain, 0, 11, { u: true }), 2, 5, 'u')).toBe(true);
    expect(allHave(r, 0, 5, 'b')).toBe(false);
  });

  it('pisanie dziedziczy styl przy kursorze', () => {
    const r = applyStyle(plain, 4, 6, { b: true });
    expect(styleAt(r, 6)).toEqual({ b: true });
    const t2 = 'Ala maa kota';
    const r2 = onTextEdit(text, t2, r, styleAt(r, 6));
    expect(r2).toEqual([{ n: 4 }, { n: 3, b: true }, { n: 5 }]);
  });

  it('wstawienie z innym stylem, usuwanie i podmiana', () => {
    const r = onTextEdit('Ala', 'Ala!!', [{ n: 3 }], { i: true });
    expect(r).toEqual([{ n: 3 }, { n: 2, i: true }]);
    const del = onTextEdit('Ala ma kota', 'Ala kota', applyStyle(plain, 4, 6, { b: true }), {});
    expect(del).toEqual([{ n: 8 }]);
    const rep = onTextEdit('abc', 'aXc', [{ n: 3, u: true }], { b: true });
    expect(rep).toEqual([{ n: 1, u: true }, { n: 1, b: true }, { n: 1, u: true }]);
  });

  it('odcinki zawsze pasują do tekstu (np. tekst zmieniony na innym urządzeniu)', () => {
    expect(fitRuns([{ n: 50, b: true }], 3)).toEqual([{ n: 3, b: true }]);
    expect(fitRuns([{ n: 1, b: true }], 3)).toEqual([{ n: 1, b: true }, { n: 2 }]);
    expect(normalize([{ n: 0, b: true }, { n: 2, z: 'm' }, { n: 1 }])).toEqual([{ n: 3 }]);
  });
});
