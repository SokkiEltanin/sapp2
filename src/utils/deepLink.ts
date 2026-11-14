// Linki z widgetów i powiadomień (2026-11-14, user: "jak wchodzę z widgetu na pogodę
// i cofam, mam szary ekran, cofnę ponownie i wraca"). sapp2://weather prowadził na
// pusty ekran-przekierowanie, który zostawał w historii (stąd "szary" krok przy
// cofaniu). Tu link jest przepisywany ZANIM router cokolwiek otworzy
// (app/+native-intent.tsx) — od razu na właściwy ekran. Testy: __tests__/deepLink.test.ts.
const MAP: Record<string, string> = {
  weather: '/?weather=1',
  pogoda: '/?weather=1',
  tasks: '/tasks',
  zadania: '/tasks',
  finances: '/finances',
  finanse: '/finances',
  notes: '/notes',
  daily: '/daily',
  '': '/',
};

export function rewriteDeepLink(path: string): string {
  try {
    // "sapp2://weather", "sapp2:///weather?x=1", "/weather" → "weather" + query
    const noScheme = path.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^\/+/, '');
    const [route, query = ''] = noScheme.split('?');
    const key = route.replace(/\/+$/, '').toLowerCase();
    if (key in MAP) {
      const target = MAP[key];
      if (!query) return target;
      return target.includes('?') ? `${target}&${query}` : `${target}?${query}`;
    }
    return `/${route}${query ? `?${query}` : ''}`;
  } catch {
    return path;
  }
}
