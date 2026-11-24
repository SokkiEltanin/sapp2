import { pixelIconRects } from '@/utils/pixelWeatherIcon';

describe('ikony pogody pixel art (wspólne z widgetem)', () => {
  it('każda scena ma rysunek w siatce 13×11', () => {
    for (const k of ['sun', 'night', 'partly', 'partlyNight', 'cloud', 'fog', 'drizzle', 'rain', 'heavy', 'freezing', 'snow', 'storm'] as const) {
      const r = pixelIconRects(k);
      expect(r.length).toBeGreaterThan(3);
      for (const x of r) { expect(x.x + x.w).toBeLessThanOrEqual(13); expect(x.y).toBeLessThan(11); }
    }
  });
  it('śnieg ma białe płatki, deszcz niebieskie krople', () => {
    expect(pixelIconRects('snow').some((r) => r.fill === '#F8FAFC')).toBe(true);
    expect(pixelIconRects('rain').some((r) => r.fill === '#60A5FA')).toBe(true);
  });
});
