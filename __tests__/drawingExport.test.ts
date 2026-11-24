import { exportFrame, strokesSvg, drawingYRange } from '@/utils/drawingExport';

describe('eksport rysunku', () => {
  const strokes = [{ color: '#FFFFFF', width: 3, p: [0.1, 0.5, 0.4, 0.6] }, { color: '#F00', width: 2, p: [0.2, 0.8, 0.3, 0.9], t: 'marker' as const }];
  it('kadr od najwyższej do najniższej kreski + margines', () => {
    expect(drawingYRange(strokes)).toEqual({ min: 0.5, max: 0.9 });
    const f = exportFrame(strokes, 1000)!;
    expect(f.y0).toBe(440);
    expect(f.h).toBe(520);
    expect(exportFrame([], 1000)).toBeNull();
  });
  it('SVG z tłem strony; biały tusz na jasnej stronie robi się ciemny', () => {
    const r = strokesSvg(strokes, { bg: '#F5F1E8', light: true, W: 1000 })!;
    expect(r.svg).toContain('viewBox="0 440 1000 520"');
    expect(r.svg).toContain('fill="#F5F1E8"');
    expect(r.svg).toContain('stroke="#1A1A1A"');
    expect(r.svg).toContain('stroke-opacity="0.38"');
  });
});
