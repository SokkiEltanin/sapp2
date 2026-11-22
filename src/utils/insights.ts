// Wzorce zachowań (2026-11-22, user: "sensowne porównanie danych, które mamy, i schematy zachowań:
// że mam mniej energii, albo kupuję więcej słodyczy jak więcej pracuję, albo jak więcej siedzę na
// appkach rozrywki, to więcej jem słodyczy i chcę coś kupować"). Czyste funkcje
// (__tests__/insights.test.ts); widok: components/insights/InsightsSheet.tsx + kafel w Daily.
//
// Metoda: dzień po dniu zbieramy cechy (humor, energia, sen, kroki, wydatki wg rodzaju, godziny
// pracy, telefon). Dla wybranych, sensownych par "przyczyna → skutek" dzielimy dni na grupę
// "więcej" i "mniej" (progi stałe albo mediana), porównujemy średni skutek i liczymy siłę
// efektu (d Cohena) + test Welcha z korektą wielu porównań (BH). Min. 5 dni w grupie i 14 łącznie,
// wyraźna i sensowna różnica bezwzględna. To korelacje — UI mówi to wprost.

export type FeatKey =
  | 'mood' | 'energy' | 'sleep' | 'steps'
  | 'spend' | 'sweets' | 'fastfood' | 'shop'
  | 'work' | 'screen' | 'fun' | 'unlocks' | 'night' | 'good';

export interface DayFeat { date: string; v: Partial<Record<FeatKey, number>> }

export interface FeatInput {
  days: string[];                                          // zakres dni (RRRR-MM-DD), rosnąco
  mood?: Map<string, { mood: number; energy: number }>;
  health?: Record<string, [number | null, number | null]>; // [kroki, sen min]
  spend?: { from: string | null; byDay: Map<string, { total: number; sweets: number; fastfood: number; shop: number }> };
  workMin?: { from: string | null; byDay: Map<string, number> };
  screen?: Record<string, { total: number; fun: number; unlocks: number; night: number }>;
  good?: { from: string | null; dates: Set<string> };
}

/** Tabela dzień → cechy. Brak danych = brak klucza (nie zero), poza wydatkami/pracą/dobrą
 *  rzeczą, które od pierwszego wpisu liczą brak jako 0. */
export function buildDays(inp: FeatInput): DayFeat[] {
  return inp.days.map((date) => {
    const v: Partial<Record<FeatKey, number>> = {};
    const m = inp.mood?.get(date);
    if (m) { v.mood = m.mood; v.energy = m.energy; }
    const h = inp.health?.[date];
    if (h?.[0] != null && h[0] > 0) v.steps = h[0];
    if (h?.[1] != null && h[1] > 0) v.sleep = h[1];
    if (inp.spend?.from && date >= inp.spend.from) {
      const s = inp.spend.byDay.get(date);
      v.spend = s?.total ?? 0; v.sweets = s?.sweets ?? 0; v.fastfood = s?.fastfood ?? 0; v.shop = s?.shop ?? 0;
    }
    if (inp.workMin?.from && date >= inp.workMin.from) v.work = (inp.workMin.byDay.get(date) ?? 0) / 60;
    const sc = inp.screen?.[date];
    if (sc && sc.total > 0) { v.screen = sc.total; v.fun = sc.fun; v.unlocks = sc.unlocks; v.night = sc.night; }
    if (inp.good?.from && date >= inp.good.from) v.good = inp.good.dates.has(date) ? 1 : 0;
    return { date, v };
  });
}

type Unit = 'zł' | 'min' | 'pkt' | 'h' | 'kroków' | 'razy';
const UNIT: Record<FeatKey, Unit> = {
  mood: 'pkt', energy: 'pkt', sleep: 'min', steps: 'kroków', spend: 'zł', sweets: 'zł', fastfood: 'zł', shop: 'zł',
  work: 'h', screen: 'min', fun: 'min', unlocks: 'razy', night: 'min', good: 'razy',
};
// Najmniejsza różnica, która coś znaczy (żeby nie pokazywać "0,4 zł więcej").
const MIN_DIFF: Record<FeatKey, number> = {
  mood: 0.25, energy: 0.25, sleep: 15, steps: 800, spend: 10, sweets: 3, fastfood: 5, shop: 10,
  work: 0.5, screen: 15, fun: 10, unlocks: 6, night: 5, good: 0.1,
};

export type Group = 'energia' | 'wydatki' | 'telefon' | 'sen';
interface Split { hi: (x: number, med: number) => boolean | null; hiLabel: (med: number) => string; loLabel: (med: number) => string; short: [string, string] }

// Podziały dni dla przyczyn: progi życiowe, gdzie są oczywiste; mediana dla telefonu.
const SPLIT: Partial<Record<FeatKey, Split>> = {
  work: { hi: (x) => (x >= 3 ? true : x === 0 ? false : null), hiLabel: () => 'W dni pracy', loLabel: () => 'w dni wolne', short: ['Dni pracy', 'Dni wolne'] },
  sleep: { hi: (x) => (x >= 420 ? true : x < 390 ? false : null), hiLabel: () => 'Po nocy z 7 h+ snu', loLabel: () => 'po krótszej (poniżej 6,5 h)', short: ['7 h+ snu', 'Poniżej 6,5 h'] },
  steps: { hi: (x) => (x >= 8000 ? true : x < 5000 ? false : null), hiLabel: () => 'W dni z 8 000+ kroków', loLabel: () => 'przy mniej niż 5 000', short: ['8 000+ kroków', 'Poniżej 5 000'] },
  fun: { hi: (x, m) => x > m, hiLabel: (m) => `W dni z więcej niż ${fmtMin(m)} rozrywki w telefonie`, loLabel: () => 'przy mniejszej', short: ['Więcej rozrywki', 'Mniej rozrywki'] },
  screen: { hi: (x, m) => x > m, hiLabel: (m) => `W dni z ponad ${fmtMin(m)} telefonu`, loLabel: () => 'przy krótszym', short: ['Więcej telefonu', 'Mniej telefonu'] },
  unlocks: { hi: (x, m) => x > m, hiLabel: (m) => `W dni z ponad ${Math.round(m)} odblokowaniami`, loLabel: () => 'przy mniejszej liczbie', short: ['Więcej odblok.', 'Mniej odblok.'] },
  night: { hi: (x) => (x >= 20 ? true : x < 5 ? false : null), hiLabel: () => 'Po wieczorze z telefonem po północy (20 min+)', loLabel: () => 'bez nocnego telefonu', short: ['Telefon w nocy', 'Bez nocnego'] },
  sweets: { hi: (x) => x > 0, hiLabel: () => 'Dzień po kupieniu słodyczy', loLabel: () => 'po dniu bez', short: ['Po słodyczach', 'Bez słodyczy'] },
  good: { hi: (x) => x > 0, hiLabel: () => 'W dni z zapisaną dobrą rzeczą', loLabel: () => 'bez niej', short: ['Z dobrą rzeczą', 'Bez'] },
};

// Opis skutku: "masz średnio {X} energii" / "wydajesz na słodycze {X}".
const OUTCOME: Record<FeatKey, string> = {
  mood: 'humor', energy: 'energia', sleep: 'sen', steps: 'kroki', spend: 'wydatki (bez stałych)', sweets: 'słodycze i przekąski',
  fastfood: 'jedzenie na mieście', shop: 'zakupy (zmienne)', work: 'praca', screen: 'czas z telefonem', fun: 'rozrywka w telefonie',
  unlocks: 'odblokowania', night: 'telefon w nocy', good: 'dobra rzecz',
};

export interface PairDef { id: string; x: FeatKey; y: FeatKey; lag?: 0 | 1; group: Group; good: 1 | -1 | 0 }
// Sensowne pary (przyczyna → skutek). `lag` 1 = skutek dzień później (sen po wieczorze itd.).
// `good` = czy wzrost skutku jest dobry (kolor), 0 = neutralnie.
export const PAIRS: PairDef[] = [
  { id: 'work-sweets', x: 'work', y: 'sweets', group: 'wydatki', good: -1 },
  { id: 'work-fastfood', x: 'work', y: 'fastfood', group: 'wydatki', good: -1 },
  { id: 'work-shop', x: 'work', y: 'shop', group: 'wydatki', good: -1 },
  { id: 'work-energy', x: 'work', y: 'energy', group: 'energia', good: 1 },
  { id: 'work-mood', x: 'work', y: 'mood', group: 'energia', good: 1 },
  { id: 'work-fun', x: 'work', y: 'fun', group: 'telefon', good: -1 },
  { id: 'fun-sweets', x: 'fun', y: 'sweets', group: 'wydatki', good: -1 },
  { id: 'fun-shop', x: 'fun', y: 'shop', group: 'wydatki', good: -1 },
  { id: 'fun-fastfood', x: 'fun', y: 'fastfood', group: 'wydatki', good: -1 },
  { id: 'fun-mood', x: 'fun', y: 'mood', group: 'energia', good: 1 },
  { id: 'fun-energy', x: 'fun', y: 'energy', group: 'energia', good: 1 },
  { id: 'fun-sleep', x: 'fun', y: 'sleep', lag: 1, group: 'sen', good: 1 },
  { id: 'fun-steps', x: 'fun', y: 'steps', group: 'energia', good: 1 },
  { id: 'sleep-energy', x: 'sleep', y: 'energy', group: 'sen', good: 1 },
  { id: 'sleep-mood', x: 'sleep', y: 'mood', group: 'sen', good: 1 },
  { id: 'sleep-sweets', x: 'sleep', y: 'sweets', group: 'wydatki', good: -1 },
  { id: 'sleep-fastfood', x: 'sleep', y: 'fastfood', group: 'wydatki', good: -1 },
  { id: 'sleep-fun', x: 'sleep', y: 'fun', group: 'telefon', good: -1 },
  { id: 'steps-mood', x: 'steps', y: 'mood', group: 'energia', good: 1 },
  { id: 'steps-energy', x: 'steps', y: 'energy', group: 'energia', good: 1 },
  { id: 'unlocks-mood', x: 'unlocks', y: 'mood', group: 'telefon', good: 1 },
  { id: 'unlocks-energy', x: 'unlocks', y: 'energy', group: 'telefon', good: 1 },
  { id: 'screen-spend', x: 'screen', y: 'spend', group: 'wydatki', good: -1 },
  { id: 'night-energy', x: 'night', y: 'energy', lag: 1, group: 'sen', good: 1 },
  { id: 'night-mood', x: 'night', y: 'mood', lag: 1, group: 'sen', good: 1 },
  { id: 'sweets-energy', x: 'sweets', y: 'energy', lag: 1, group: 'energia', good: 1 },
  { id: 'sweets-mood', x: 'sweets', y: 'mood', lag: 1, group: 'energia', good: 1 },
  { id: 'good-mood', x: 'good', y: 'mood', group: 'energia', good: 1 },
];

export interface Insight {
  id: string; group: Group; x: FeatKey; y: FeatKey;
  text: string;            // pełne zdanie
  short: string;           // krótko do kafla
  hi: { mean: number; n: number; label: string };
  lo: { mean: number; n: number; label: string };
  d: number;               // siła efektu (d Cohena, ze znakiem)
  strength: 'słaby' | 'wyraźny' | 'silny';
  tone: 'good' | 'bad' | 'neutral';
  unit: Unit;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const variance = (xs: number[], m: number) => xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

export function fmtMin(m: number): string {
  const v = Math.round(m);
  if (v < 60) return `${v} min`;
  const h = Math.floor(v / 60), r = v % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
export function fmtVal(v: number, u: Unit): string {
  switch (u) {
    case 'zł': return `${Math.round(v)} zł`;
    case 'min': return fmtMin(v);
    case 'pkt': return `${v.toFixed(1).replace('.', ',')}/5`;
    case 'h': return `${v.toFixed(1).replace('.', ',')} h`;
    case 'kroków': return `${Math.round(v / 100) * 100} kroków`;
    default: return String(Math.round(v));
  }
}

function compare(hiRaw: number, loRaw: number, u: Unit): string {
  // proporcje z liczb, które user widzi w zdaniu (zaokrąglonych), żeby się zgadzały
  const hi = u === 'zł' || u === 'min' || u === 'razy' ? Math.round(hiRaw) : hiRaw;
  const lo = u === 'zł' || u === 'min' || u === 'razy' ? Math.round(loRaw) : loRaw;
  if (u === 'pkt') { const d = hi - lo; return `${d > 0 ? 'o' : 'o'} ${Math.abs(d).toFixed(1).replace('.', ',')} pkt ${d > 0 ? 'więcej' : 'mniej'}`; }
  if (lo > 0 && hi / lo >= 1.8) return `${(hi / lo).toFixed(1).replace('.', ',')}× więcej`;
  if (hi > 0 && lo / hi >= 1.8) return `${(lo / hi).toFixed(1).replace('.', ',')}× mniej`;
  if (lo === 0 && hi > 0) return 'a bez tego prawie wcale';
  const pct = lo > 0 ? Math.round(((hi - lo) / lo) * 100) : 0;
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}

const VERB: Record<FeatKey, (v: string) => string> = {
  mood: (v) => `humor średnio ${v}`, energy: (v) => `energia średnio ${v}`, sleep: (v) => `śpisz średnio ${v}`,
  steps: (v) => `robisz średnio ${v}`, spend: (v) => `wydajesz średnio ${v} (bez stałych)`, sweets: (v) => `na słodycze i przekąski idzie średnio ${v}`,
  fastfood: (v) => `na jedzenie na mieście idzie średnio ${v}`, shop: (v) => `na zakupy (zmienne) idzie średnio ${v}`,
  work: (v) => `pracujesz średnio ${v}`, screen: (v) => `telefon średnio ${v}`, fun: (v) => `rozrywka w telefonie średnio ${v}`,
  unlocks: (v) => `odblokowujesz średnio ${v} razy`, night: (v) => `w nocy telefon średnio ${v}`, good: (v) => v,
};

// ── Statystyka (2026-11-22, user: "rozegrać mądrze, żeby nie było bez sensu strzałów na małych
// próbkach"): test t Welcha (różne wariancje i liczności grup) + korekta wielu porównań
// Benjaminiego–Hochberga (testujemy ~30 par naraz — bez korekty część "wzorców" byłaby czystym
// przypadkiem). Do tego minimum dni w każdej grupie i łącznie.
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
  let c = 1, d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function lgamma(x: number): number {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x; const tmp0 = x + 5.5; const tmp = tmp0 - (x + 0.5) * Math.log(tmp0);
  let ser = 1.000000000190015;
  for (const c of g) ser += c / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}
/** Regularyzowana niepełna funkcja beta I_x(a, b). */
function ibeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}
/** Dwustronne p testu t Welcha. */
export function welchP(a: number[], b: number[]): number {
  const ma = mean(a), mb = mean(b);
  const va = variance(a, ma) / a.length, vb = variance(b, mb) / b.length;
  const se = Math.sqrt(va + vb);
  if (!(se > 0)) return ma === mb ? 1 : 0;
  const t = (ma - mb) / se;
  const df = (va + vb) ** 2 / ((va * va) / Math.max(1, a.length - 1) + (vb * vb) / Math.max(1, b.length - 1));
  return ibeta(df / (df + t * t), df / 2, 0.5);
}
/** Benjamini–Hochberg: które p przechodzą przy kontroli odsetka fałszywych odkryć `q`. */
export function bhPass(ps: number[], q = 0.1): boolean[] {
  const idx = ps.map((p, i) => [p, i] as const).sort((x, y) => x[0] - y[0]);
  let k = -1;
  idx.forEach(([p], r) => { if (p <= ((r + 1) / ps.length) * q) k = r; });
  const pass = ps.map(() => false);
  for (let r = 0; r <= k; r++) pass[idx[r][1]] = true;
  return pass;
}

/** Wzorce: min. `minPerGroup` dni w każdej grupie i `minTotal` łącznie, test Welcha + korekta BH. */
export function computeInsights(days: DayFeat[], pairs: PairDef[] = PAIRS, minPerGroup = 5, minTotal = 14): Insight[] {
  const cand: (Insight & { p: number })[] = [];
  for (const p of pairs) {
    const split = SPLIT[p.x];
    if (!split) continue;
    const xs = days.map((d) => d.v[p.x]).filter((x): x is number => x != null);
    if (xs.length < minTotal) continue;
    const med = median(xs);
    const hi: number[] = [], lo: number[] = [];
    days.forEach((d, i) => {
      const x = d.v[p.x];
      const yDay = days[i + (p.lag ?? 0)];
      const y = yDay?.v[p.y];
      if (x == null || y == null) return;
      const side = split.hi(x, med);
      if (side == null) return;
      (side ? hi : lo).push(y);
    });
    if (hi.length < minPerGroup || lo.length < minPerGroup || hi.length + lo.length < minTotal) continue;
    const mh = mean(hi), ml = mean(lo);
    const sd = Math.sqrt(((hi.length - 1) * variance(hi, mh) + (lo.length - 1) * variance(lo, ml)) / Math.max(1, hi.length + lo.length - 2));
    const pv = welchP(hi, lo);
    const d = sd > 0 ? (mh - ml) / sd : 0;
    const u = UNIT[p.y];
    const hiL = split.hiLabel(med), loL = split.loLabel(med);
    const up = mh > ml;
    const tone = p.good === 0 ? 'neutral' : (up ? p.good > 0 : p.good < 0) ? 'good' : 'bad';
    cand.push({
      id: p.id, group: p.group, x: p.x, y: p.y,
      text: `${hiL} ${VERB[p.y](fmtVal(mh, u))}, ${loL} ${fmtVal(ml, u)} — ${compare(mh, ml, u)}.`,
      short: `${hiL}: ${OUTCOME[p.y]} ${up ? '↑' : '↓'} ${compare(mh, ml, u)}`,
      hi: { mean: mh, n: hi.length, label: split.short[0] }, lo: { mean: ml, n: lo.length, label: split.short[1] },
      d, strength: 'słaby', tone, unit: u, p: pv,
    });
  }
  // korekta liczona po WSZYSTKICH przetestowanych parach (także tych bez różnicy)
  const pass = bhPass(cand.map((c) => c.p));
  return cand
    .filter((c, i) => pass[i] && Math.abs(c.d) >= 0.4 && Math.abs(c.hi.mean - c.lo.mean) >= MIN_DIFF[c.y])
    .map(({ p, ...c }) => ({ ...c, strength: (Math.abs(c.d) >= 0.8 && p < 0.01 ? 'silny' : Math.abs(c.d) >= 0.5 && p < 0.05 ? 'wyraźny' : 'słaby') as Insight['strength'] }))
    .sort((a, b) => Math.abs(b.d) * Math.sqrt(Math.min(b.hi.n, b.lo.n)) - Math.abs(a.d) * Math.sqrt(Math.min(a.hi.n, a.lo.n)));
}

/** Ile dni jakich danych mamy (stan pusty: co jeszcze zbierać). */
export function coverage(days: DayFeat[]): Record<'humor' | 'sen' | 'wydatki' | 'praca' | 'telefon', number> {
  const c = (k: FeatKey) => days.filter((d) => d.v[k] != null).length;
  return { humor: c('mood'), sen: c('sleep'), wydatki: c('spend'), praca: days.filter((d) => (d.v.work ?? 0) > 0).length, telefon: c('screen') };
}
