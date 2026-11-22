// Czas z telefonem (2026-11-22, user: "zamiast #JedzeniePerMiesiąc statystyki użycia innych
// aplikacji, ilość włączeń telefonu dziennie… po otwarciu więcej szczegółów"). Dane z
// Androida (UsageStatsManager, plugins/withUsageStats.js) → dzień w minutach. Czyste funkcje
// (__tests__/screenTime.test.ts); store: store/screenTimeStore.ts; widok: kafel w
// ui/DashboardScreen.tsx + components/screen/ScreenTimeSheet.tsx.

export interface ScreenApp { p: string; l: string; m: number; n: number; c: number }
export interface ScreenDay {
  date: string;          // RRRR-MM-DD
  total: number;         // minuty w appkach (bez ekranu głównego i paska systemu)
  unlocks: number;       // odblokowania
  screenOns: number;     // włączenia ekranu
  first: string | null;  // pierwsze odblokowanie "HH:MM"
  apps: ScreenApp[];     // od najdłużej używanej
  hours: number[];       // 24 × minuty
  unlockHours?: number[]; // 24 × odblokowania (od APK z 2026-11-22; starsze dni bez)
  longest: { p: string; l: string; m: number } | null; // najdłużej bez przerwy w jednej appce
  t: number;             // kiedy odczytano (ms)
  v?: number;            // wersja liczenia w module (brak = 1; v2 bez nakładania i "od północy")
}

/** Surowy dzień z modułu natywnego (milisekundy). */
export interface RawScreenDay {
  s: number; total: number; unlocks: number; screenOns: number; first: number;
  apps: { p: string; l: string; ms: number; n: number; c: number }[];
  hours: number[]; longest?: { p: string; l: string; ms: number } | null; uh?: number[]; v?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const min = (ms: number) => Math.round(Math.max(0, ms) / 60000);

/** Początki (północ, czas lokalny) ostatnich `n` dni, od najstarszego; ostatni = dziś. */
export function dayStarts(now: Date, n: number): number[] {
  return Array.from({ length: n }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1 - i)).getTime());
}

export function fromRaw(r: RawScreenDay, t: number): ScreenDay {
  const d = new Date(r.s);
  const f = r.first > 0 ? new Date(r.first) : null;
  return {
    date: ymd(d),
    total: min(r.total),
    unlocks: r.unlocks | 0,
    screenOns: r.screenOns | 0,
    first: f ? `${pad(f.getHours())}:${pad(f.getMinutes())}` : null,
    apps: (r.apps ?? []).map((a) => ({ p: a.p, l: a.l || a.p, m: min(a.ms), n: a.n | 0, c: a.c ?? -1 })).filter((a) => a.m > 0 || a.n > 0)
      .sort((a, b) => b.m - a.m || b.n - a.n).slice(0, 40),
    hours: Array.from({ length: 24 }, (_, i) => min(r.hours?.[i] ?? 0)),
    ...(Array.isArray(r.uh) && r.uh.length === 24 ? { unlockHours: r.uh.map((x) => x | 0) } : {}),
    longest: r.longest && r.longest.ms > 0 ? { p: r.longest.p, l: r.longest.l || r.longest.p, m: min(r.longest.ms) } : null,
    t,
    ...(r.v ? { v: r.v } : {}),
  };
}

/** "3 h 12 min" / "45 min" / "2 h". */
export function fmtDur(m: number): string {
  const v = Math.max(0, Math.round(m));
  if (v < 60) return `${v} min`;
  const h = Math.floor(v / 60), r = v % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
/** Krótko do kafla: "3:12" (h:mm) albo "45 min". */
export function fmtShort(m: number): { big: string; unit: string } {
  const v = Math.max(0, Math.round(m));
  if (v < 60) return { big: String(v), unit: 'min' };
  return { big: `${Math.floor(v / 60)}:${pad(v % 60)}`, unit: 'h' };
}

// Kategorie: najpierw z Androida (ApplicationInfo.category), potem znane pakiety, reszta "inne".
export type ScreenCat = 'social' | 'chat' | 'video' | 'audio' | 'games' | 'web' | 'work' | 'maps' | 'photo' | 'news' | 'other';
export const CAT_LABEL: Record<ScreenCat, string> = {
  social: 'Społeczności', chat: 'Komunikatory', video: 'Wideo', audio: 'Muzyka i audio', games: 'Gry',
  web: 'Przeglądarka', work: 'Praca i narzędzia', maps: 'Mapy i dojazdy', photo: 'Zdjęcia', news: 'Wiadomości', other: 'Inne',
};
export const CAT_COLOR: Record<ScreenCat, string> = {
  social: '#F472B6', chat: '#60A5FA', video: '#F87171', audio: '#4ADE80', games: '#C084FC',
  web: '#FBBF24', work: '#2DD4BF', maps: '#A3E635', photo: '#FB923C', news: '#94A3B8', other: '#6E6E6E',
};
const ANDROID_CAT: Record<number, ScreenCat> = { 0: 'games', 1: 'audio', 2: 'video', 3: 'photo', 4: 'social', 5: 'news', 6: 'maps', 7: 'work' };
const KNOWN: [RegExp, ScreenCat][] = [
  [/^(com\.whatsapp|org\.telegram|org\.thoughtcrime\.securesms|com\.facebook\.orca|com\.discord|com\.viber|com\.samsung\.android\.messaging|com\.google\.android\.apps\.messaging|com\.snapchat)/, 'chat'],
  [/^(com\.instagram|com\.facebook\.katana|com\.facebook\.lite|com\.twitter|com\.x\.|com\.reddit|com\.zhiliaoapp|com\.ss\.android\.ugc|com\.pinterest|com\.linkedin|com\.threads|com\.bereal)/, 'social'],
  [/^(com\.google\.android\.youtube|com\.netflix|com\.amazon\.avod|com\.disney|pl\.tvn|pl\.redefine|tv\.twitch|com\.hbo|com\.max|pl\.cda|com\.vanced)/, 'video'],
  [/^(com\.spotify|deezer|com\.google\.android\.apps\.youtube\.music|com\.audible|fm\.castbox|au\.com\.shiftyjelly\.pocketcasts|com\.soundcloud|pl\.audioteka)/, 'audio'],
  [/^(com\.android\.chrome|com\.sec\.android\.app\.sbrowser|org\.mozilla|com\.opera|com\.brave|com\.microsoft\.emmx|com\.duckduckgo|com\.google\.android\.googlequicksearchbox)/, 'web'],
  [/^(com\.google\.android\.apps\.maps|com\.waze|pl\.jakdojade|com\.ubercab|com\.bolt|ee\.mtakso|com\.citymapper)/, 'maps'],
  [/^(com\.google\.android\.gm|com\.microsoft\.office|com\.google\.android\.apps\.docs|com\.slack|com\.microsoft\.teams|com\.notion|com\.todoist|com\.google\.android\.calendar|com\.samsung\.android\.calendar|com\.sokki\.)/, 'work'],
  [/^(com\.google\.android\.apps\.photos|com\.sec\.android\.gallery3d|com\.sec\.android\.app\.camera|com\.google\.android\.GoogleCamera)/, 'photo'],
];
/** Ustawienia usera (2026-11-22, user: "oznaczyć aplikacje, które to rozrywka, bo niektóre może
 *  źle łapać"): własna kategoria i/lub "rozrywka tak/nie" per pakiet (store/appCategoryStore.ts). */
export interface AppPrefs { cats?: Record<string, ScreenCat>; fun?: Record<string, boolean> }

export function catOf(a: Pick<ScreenApp, 'p' | 'c'>, pr?: AppPrefs): ScreenCat {
  const own = pr?.cats?.[a.p];
  if (own) return own;
  for (const [re, c] of KNOWN) if (re.test(a.p)) return c;
  return ANDROID_CAT[a.c] ?? 'other';
}

// Rozrywka domyślnie: społeczności, wideo, gry (zmienialne per appka).
export const FUN_CATS: ReadonlySet<ScreenCat> = new Set<ScreenCat>(['social', 'video', 'games']);
export function isFun(a: Pick<ScreenApp, 'p' | 'c'>, pr?: AppPrefs): boolean {
  const own = pr?.fun?.[a.p];
  return own != null ? own : FUN_CATS.has(catOf(a, pr));
}
export const funMinutes = (d: ScreenDay, pr?: AppPrefs) => d.apps.reduce((acc, a) => acc + (isFun(a, pr) ? a.m : 0), 0);

export function byCategory(apps: ScreenApp[], pr?: AppPrefs): { cat: ScreenCat; m: number }[] {
  const acc = new Map<ScreenCat, number>();
  for (const a of apps) if (a.m > 0) { const c = catOf(a, pr); acc.set(c, (acc.get(c) ?? 0) + a.m); }
  return [...acc.entries()].map(([cat, m]) => ({ cat, m })).sort((a, b) => b.m - a.m);
}

/** Ostatnie `n` dni do `now` (puste dni = null), od najstarszego. */
export function lastScreenDays(days: Record<string, ScreenDay>, now: Date, n: number): { date: string; d: ScreenDay | null }[] {
  return dayStarts(now, n).map((s) => { const date = ymd(new Date(s)); return { date, d: days[date] ?? null }; });
}

/** Średnia z poprzednich (pełnych) dni — bez dzisiejszego, tylko dni z danymi. */
export function avgBefore(days: Record<string, ScreenDay>, now: Date, n = 7): { total: number; unlocks: number; days: number } | null {
  const prev = lastScreenDays(days, now, n + 1).slice(0, n).map((x) => x.d).filter((d): d is ScreenDay => !!d && (d.total > 0 || d.unlocks > 0));
  if (!prev.length) return null;
  return {
    total: prev.reduce((a, d) => a + d.total, 0) / prev.length,
    unlocks: prev.reduce((a, d) => a + d.unlocks, 0) / prev.length,
    days: prev.length,
  };
}

/**
 * Porównanie z przeciętnym dniem DO TEJ PORY (dziś niepełny — porównywanie z całym dniem
 * zawsze dawałoby "mniej"). Średnia z poprzednich dni liczona do tej samej godziny.
 */
export function vsUsual(days: Record<string, ScreenDay>, now: Date, n = 7): { pct: number; usual: number } | null {
  const today = days[ymd(now)];
  if (!today) return null;
  const h = now.getHours(), frac = now.getMinutes() / 60;
  const upTo = (d: ScreenDay) => d.hours.slice(0, h).reduce((a, b) => a + b, 0) + (d.hours[h] ?? 0) * frac;
  const prev = lastScreenDays(days, now, n + 1).slice(0, n).map((x) => x.d).filter((d): d is ScreenDay => !!d && d.total > 0);
  if (prev.length < 2) return null;
  const usual = prev.reduce((a, d) => a + upTo(d), 0) / prev.length;
  if (usual < 5) return null;
  return { pct: Math.round(((today.total - usual) / usual) * 100), usual: Math.round(usual) };
}

/** Najbardziej "telefonowa" godzina dnia. */
export function peakHour(d: ScreenDay): { h: number; m: number } | null {
  let best = -1, bm = 0;
  d.hours.forEach((m, h) => { if (m > bm) { bm = m; best = h; } });
  return best < 0 ? null : { h: best, m: bm };
}
/** Minuty w nocy (0:00–5:59). */
export const nightMinutes = (d: ScreenDay) => d.hours.slice(0, 6).reduce((a, b) => a + b, 0);

/** Scalenie: nowszy odczyt dnia wygrywa; trzyma ostatnie `keep` dni. */
export function mergeScreenDays(cur: Record<string, ScreenDay>, add: ScreenDay[], keep = 90): Record<string, ScreenDay> {
  const out = { ...cur };
  for (const d of add) if (!out[d.date] || out[d.date].t <= d.t) out[d.date] = d;
  const keys = Object.keys(out).sort().slice(-keep);
  return Object.fromEntries(keys.map((k) => [k, out[k]]));
}

/** Dni do (ponownego) pobrania: dziś zawsze, wcześniejsze — brak, odczyt sprzed końca dnia albo
 *  policzone starszą wersją modułu (`v` < `version`, np. błąd "od północy" w v1). */
export function daysToFetch(days: Record<string, ScreenDay>, now: Date, n = 7, version = 1): number[] {
  const starts = dayStarts(now, n);
  return starts.filter((s, i) => {
    if (i === starts.length - 1) return true;
    const d = days[ymd(new Date(s))];
    const end = starts[i + 1];
    return !d || d.t < end || (d.v ?? 1) < version;
  });
}
