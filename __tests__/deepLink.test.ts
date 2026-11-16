import { rewriteDeepLink } from '@/utils/deepLink';

describe('linki z widgetów', () => {
  it('pogoda → Dashboard z otwartą pogodą (bez ekranu pośredniego)', () => {
    expect(rewriteDeepLink('sapp2://weather')).toBe('/?weather=1');
    expect(rewriteDeepLink('/weather')).toBe('/?weather=1');
    expect(rewriteDeepLink('sapp2:///weather')).toBe('/?weather=1');
  });
  it('zakładki i notatka z parametrem', () => {
    expect(rewriteDeepLink('sapp2://tasks')).toBe('/tasks');
    expect(rewriteDeepLink('sapp2://finances')).toBe('/finances');
    expect(rewriteDeepLink('sapp2://note?id=note_abc')).toBe('/note?id=note_abc');
    expect(rewriteDeepLink('sapp2://')).toBe('/');
  });
  it('nieznane bez zmian (z ukośnikiem)', () => {
    expect(rewriteDeepLink('sapp2://bank-review')).toBe('/bank-review');
  });
  it('widget: wiersz zadania → szczegóły', () => {
    expect(rewriteDeepLink('sapp2://tasks?task=t_123')).toBe('/tasks?task=t_123');
  });
});
