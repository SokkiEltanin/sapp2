import { buildNoteWidgetSnapshot } from '@/utils/widgetNote';

const N = (x: any) => ({ id: 'n', kind: 'text', title: '', text: '', items: [], strokes: [], pinned: true, createdAt: '', updatedAt: '', ...x });

describe('widget notatki', () => {
  it('brak przypiętej', () => {
    expect(buildNoteWidgetSnapshot(null)).toMatchObject({ id: null, kind: 'none' });
  });
  it('lista: nieodhaczone pierwsze, licznik, limit wierszy', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: String(i), text: `p${i}`, done: i < 3 }));
    const s = buildNoteWidgetSnapshot(N({ kind: 'list', title: 'Zakupy', items }));
    expect(s.title).toBe('ZAKUPY · 7/10');
    expect(s.rows).toHaveLength(8);
    expect(s.rows[0]).toEqual({ text: 'p3', done: false });
    expect(s.rows[7].done).toBe(true);
    expect(s.more).toBe(2);
  });
  it('tekst skrócony, tytuł z pierwszej linii', () => {
    const s = buildNoteWidgetSnapshot(N({ text: 'Pierwsza linia\n\n\n\nDruga' }));
    expect(s.title).toBe('PIERWSZA LINIA');
    expect(s.text).toBe('Pierwsza linia\n\nDruga');
  });
});

describe('widget notatki — rysunek', () => {
  const st = (p: number[], extra: any = {}) => ({ color: '#fff', width: 7.2, p, ...extra });
  it('rysunek idzie w snapshocie, przycięty do treści', () => {
    const s = buildNoteWidgetSnapshot(N({ kind: 'drawing', strokes: [st([0.5, 0.5, 0.7, 0.6])] }));
    expect(s.kind).toBe('drawing');
    expect(s.text).toBe('');
    const d = s.drawing!;
    // pad = grubość/2 (0.01) + 0.02 margines
    expect(d.w).toBeCloseTo(0.2 + 0.06, 4);
    expect(d.h).toBeCloseTo(0.1 + 0.06, 4);
    expect(d.strokes[0].p[0]).toBeCloseTo(0.03, 4);
    expect(d.strokes[0].s).toBeCloseTo(0.02, 4);
  });
  it('pusty rysunek → komunikat, bez bitmapy', () => {
    const s = buildNoteWidgetSnapshot(N({ kind: 'drawing', strokes: [] }));
    expect(s.drawing).toBeUndefined();
    expect(s.text).toBe('Pusty rysunek');
  });
  it('pędzel: mnożniki zostają, gęste kreski przerzedzone z zachowaniem końca', () => {
    const n = 20000;
    const p = Array.from({ length: n * 2 }, (_, i) => (i % 2 ? 0.5 : i / (n * 2)));
    const w = Array.from({ length: n }, () => 1.2);
    const d = buildNoteWidgetSnapshot(N({ kind: 'drawing', strokes: [st(p, { w })] })).drawing!;
    const pts = d.strokes[0].p.length / 2;
    expect(pts).toBeLessThanOrEqual(6001);
    expect(d.strokes[0].k).toHaveLength(pts);
    expect(d.strokes[0].p.at(-2)).toBeCloseTo(p[n * 2 - 2] - (0 - (7.2 / 360) * 1.2 / 2 - 0.02), 3);
  });
  it('tekst + rysunek: oba', () => {
    const s = buildNoteWidgetSnapshot(N({ text: 'Opis', strokes: [st([0.1, 0.1])] }));
    expect(s.text).toBe('Opis');
    expect(s.drawing).toBeDefined();
  });
});

describe('androidColor', () => {
  const { androidColor } = require('@/utils/widgetNote');
  it('przekłada formaty', () => {
    expect(androidColor('#fff')).toBe('#ffffff');
    expect(androidColor('#22C55E')).toBe('#22C55E');
    expect(androidColor('#11223380')).toBe('#80112233');
    expect(androidColor('red')).toBe('#F2F2F2');
  });
});
