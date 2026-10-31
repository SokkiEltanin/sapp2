import AsyncStorage from '@react-native-async-storage/async-storage';

// Port z sapp (src/utils/productMemory.ts) — fuzzy-matching/grupowanie/aliasy/pamięć
// wag i cen PORTOWANE 1:1 (kategorio-niezależne, nic tu nie wymagało adaptacji).
// JEDNA zmiana: sapp's "pamięć kategorii" (`ProductMemory = Record<string,
// ExpenseCategory>`) przemianowana na "pamięć podkategorii jedzenia"
// (`Record<string, string>` → klucz z FOOD_SUBCATS) — sapp2 nie ma sztywnej
// kategorii (patrz types/finances.ts), ale podkategoria jedzenia per-produkt wciąż
// jest użytecznym, powtarzalnym sygnałem (ten sam "Chleb" zawsze → pieczywo).
// ŚWIADOMIE POMINIĘTE z sapp: pamięć tagów (`loadTagMemory`/`allKnownTags`/
// `tagsMatchingWords`/`getTagFrequency`) — w sapp2 tagi żyją na poziomie CAŁEGO
// wydatku, nie pojedynczego produktu (patrz Expense.tags), więc sugerowanie tagów
// per-nazwa-produktu nie ma tu zastosowania; pamięć kcal (sapp's "Co zjadłem" — sapp2
// świadomie nie ma tej funkcji, patrz food.ts).
const FOOD_SUBCAT_KEY = 'product_foodsubcat_memory';
const NAME_KEY = 'product_name_aliases';
const WEIGHT_KEY = 'product_weight_memory';
const PRICE_KEY = 'product_price_memory';
const LINE_KEY = 'receipt_line_memory';
const MAX_ENTRIES = 500;

function normalize(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Silna normalizacja dla TOŻSAMOŚCI produktu (grupowanie w statystykach). Składa szum
// OCR tak, że ten sam produkt zapisany lekko inaczej zwija się do jednego klucza.
// Rozmiary ZOSTAJĄ (user chce różne rozmiary liczone osobno).
const DIACRITICS: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ż: 'z', ź: 'z',
};
export function normalizeProductName(name: string): string {
  let s = name.toLowerCase().trim();
  s = s.replace(/[ąćęłńóśżź]/g, (c) => DIACRITICS[c] ?? c);
  s = s.replace(/[^a-z0-9]+/g, ' ').trim();
  s = s.replace(/\s+/g, ' ');
  return s;
}

// ─── Grupowanie produktów dla statystyk ───────────────────────────────────────
// "Serek wiejski lekki" / "Serek wiejski Pilos" → grupa "serek". Rozmiary/
// kwalifikatory (lekki, bio, XXL…) i liczby ignorowane. Paragony dalej pokazują
// pełne nazwy, tylko zestawienia grupują.
const GROUP_STOP = new Set([
  'lekki', 'lekkie', 'light', 'bio', 'eko', 'duzy', 'duza', 'maly', 'mala', 'mini',
  'maxi', 'xxl', 'xl', 'xxxl', 'classic', 'klasyczny', 'naturalny', 'naturalna',
  'swiezy', 'swieza', 'czerwony', 'zielony', 'bezglutenowy',
]);
function groupTokens(name: string): string[] {
  return normalizeProductName(name).split(' ').filter((t) => t.length >= 2 && !/^\d/.test(t) && !GROUP_STOP.has(t));
}
export function productGroupKey(name: string): string {
  const toks = groupTokens(name);
  return toks[0] ?? normalizeProductName(name) ?? name.toLowerCase();
}
export function productGroupLabel(names: string[]): string {
  if (names.length === 0) return '';
  const norm = names.map(groupTokens);
  let plen = norm[0]?.length ?? 0;
  for (const tl of norm.slice(1)) {
    let i = 0;
    while (i < plen && i < tl.length && norm[0][i] === tl[i]) i++;
    plen = i;
    if (plen === 0) break;
  }
  plen = Math.max(1, plen);
  const base = [...names].sort((a, b) => a.length - b.length)[0];
  const words = base.split(/\s+/).slice(0, plen).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ─── Fuzzy matching (podobieństwo trójgramowe) ────────────────────────────────

function trigrams(s: string): Set<string> {
  const result = new Set<string>();
  const padded = `  ${s}  `;
  for (let i = 0; i < padded.length - 2; i++) result.add(padded.slice(i, i + 3));
  return result;
}

function trigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ta = trigrams(a);
  const tb = trigrams(b);
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  return (2 * intersection) / (ta.size + tb.size);
}

const FUZZY_THRESHOLD = 0.60; // minimalne podobieństwo żeby zastosować pamięć

function findFuzzyMatch<V>(key: string, memory: Record<string, V>): V | undefined {
  const keys = Object.keys(memory);
  if (keys.length === 0) return undefined;
  let bestScore = FUZZY_THRESHOLD;
  let bestVal: V | undefined;
  for (const k of keys) {
    const score = trigramSimilarity(key, k);
    if (score > bestScore) { bestScore = score; bestVal = memory[k]; }
  }
  return bestVal;
}

export function productNameSimilarity(a: string, b: string): number {
  return trigramSimilarity(normalizeProductName(a), normalizeProductName(b));
}

// "Czy to jest to samo co X?" — szuka znanej nazwy PODOBNEJ do `name`, ale w pasmie
// niepewności [lo, FUZZY_THRESHOLD): za blisko żeby ignorować, za daleko żeby
// auto-scalić. Parser DELIKATNIE sugeruje scalenie, user potwierdza.
export function suggestSimilarName(name: string, knownNames: string[], lo = 0.45): string | null {
  const key = normalizeProductName(name);
  if (!key) return null;
  let best: string | null = null;
  let bestScore = lo;
  for (const kn of knownNames) {
    const nk = normalizeProductName(kn);
    if (nk === key) return null;
    const score = trigramSimilarity(key, nk);
    if (score >= bestScore && score < FUZZY_THRESHOLD) { bestScore = score; best = kn; }
  }
  return best;
}

// ─── Pamięć podkategorii jedzenia (per nazwa produktu) ────────────────────────

type FoodSubcatMemory = Record<string, string>; // znormalizowana nazwa → tag z FOOD_SUBCATS

export async function loadFoodSubcatMemory(): Promise<FoodSubcatMemory> {
  try { const raw = await AsyncStorage.getItem(FOOD_SUBCAT_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export function applyFoodSubcatMemory(names: string[], memory: FoodSubcatMemory): Record<number, string> {
  const result: Record<number, string> = {};
  for (let i = 0; i < names.length; i++) {
    const key = normalize(names[i]);
    const val = memory[key] ?? findFuzzyMatch(key, memory);
    if (val) result[i] = val;
  }
  return result;
}

export async function saveFoodSubcatMemory(items: { name: string; foodSubcat?: string }[]): Promise<void> {
  const valid = items.filter((i) => i.name.trim() && i.foodSubcat);
  if (valid.length === 0) return;
  try {
    const memory = await loadFoodSubcatMemory();
    for (const i of valid) memory[normalize(i.name)] = i.foodSubcat!;
    const entries = Object.entries(memory);
    const trimmed = entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : memory;
    await AsyncStorage.setItem(FOOD_SUBCAT_KEY, JSON.stringify(trimmed));
  } catch {}
}

// ─── Aliasy nazw (kanoniczna tożsamość produktu dla statystyk) ────────────────
// Gdy user przemianuje sparsowany produkt, pamiętamy zniekształcona→kanoniczna, żeby
// ten sam produkt zapisany inaczej (OCR / sklep) scalał się w jedną pozycję statystyk.

type NameAliases = Record<string, string>;

export async function loadNameAliases(): Promise<NameAliases> {
  try { const raw = await AsyncStorage.getItem(NAME_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export async function saveNameAliases(products: { name: string }[], editedNames: Record<number, string>): Promise<void> {
  const entries = Object.entries(editedNames);
  if (entries.length === 0) return;
  try {
    const aliases = await loadNameAliases();
    for (const [idxStr, editedRaw] of entries) {
      const idx = parseInt(idxStr, 10);
      const canonical = editedRaw.trim();
      const original = products[idx]?.name;
      if (!canonical) continue;
      if (original) aliases[normalizeProductName(original)] = canonical;
      aliases[normalizeProductName(canonical)] = canonical;
    }
    const all = Object.entries(aliases);
    const trimmed = all.length > MAX_ENTRIES ? Object.fromEntries(all.slice(-MAX_ENTRIES)) : aliases;
    await AsyncStorage.setItem(NAME_KEY, JSON.stringify(trimmed));
  } catch {}
}

export async function removeNameAliases(names: string[]): Promise<void> {
  try {
    const aliases = await loadNameAliases();
    for (const n of names) delete aliases[normalizeProductName(n)];
    await AsyncStorage.setItem(NAME_KEY, JSON.stringify(aliases));
  } catch {}
}

// ─── Znane bazy produktów (marki) ──────────────────────────────────────────────
// Wiele przekąsek/słodyczy pojawia się pod dziesiątkami lekko innych nazw OCR/
// smaków ("Jeżyki", "jeżyki cherry", "jezykicherry"…). Gdy rozpoznawalny token-baza
// pojawia się w nazwie, cała rodzina składa się do JEDNEJ kanonicznej nazwy.
const BRAND_CANON: { tokens: string[]; name: string; tag?: string }[] = [
  { tokens: ['jezyki'], name: 'Jeżyki', tag: 'słodycze' },
  { tokens: ['grzeski'], name: 'Grześki', tag: 'słodycze' },
  { tokens: ['princepolo'], name: 'Prince Polo', tag: 'słodycze' },
  { tokens: ['delicje'], name: 'Delicje', tag: 'słodycze' },
  { tokens: ['ptasiemleczko'], name: 'Ptasie mleczko', tag: 'słodycze' },
  { tokens: ['michalki'], name: 'Michałki', tag: 'słodycze' },
  { tokens: ['krowki', 'krowka'], name: 'Krówki', tag: 'słodycze' },
  { tokens: ['lays'], name: "Lay's", tag: 'przekąski' },
  { tokens: ['pringles'], name: 'Pringles', tag: 'przekąski' },
  { tokens: ['doritos'], name: 'Doritos', tag: 'przekąski' },
  { tokens: ['cheetos'], name: 'Cheetos', tag: 'przekąski' },
  { tokens: ['chrupki'], name: 'Chrupki', tag: 'przekąski' },
  { tokens: ['krakers', 'krakersy'], name: 'Krakersy', tag: 'przekąski' },
  { tokens: ['paluszki'], name: 'Paluszki', tag: 'przekąski' },
  { tokens: ['precle', 'precelki'], name: 'Precle', tag: 'przekąski' },
  { tokens: ['nachos'], name: 'Nachos', tag: 'przekąski' },
  { tokens: ['orzeszki', 'orzeszkiwskorupkach'], name: 'Orzeszki', tag: 'przekąski' },
  { tokens: ['grzanki'], name: 'Grzanki', tag: 'przekąski' },
  { tokens: ['ovenbaked'], name: 'Ovenbaked', tag: 'przekąski' },
  { tokens: ['snickers'], name: 'Snickers', tag: 'słodycze' },
  { tokens: ['twix'], name: 'Twix', tag: 'słodycze' },
  { tokens: ['kitkat'], name: 'KitKat', tag: 'słodycze' },
  { tokens: ['kinder'], name: 'Kinder', tag: 'słodycze' },
  { tokens: ['milka'], name: 'Milka', tag: 'słodycze' },
  { tokens: ['wedel'], name: 'Wedel', tag: 'słodycze' },
  { tokens: ['oreo'], name: 'Oreo', tag: 'słodycze' },
  { tokens: ['lubella'], name: 'Lubella' },
  { tokens: ['coca', 'cocacola'], name: 'Coca-Cola', tag: 'napoje' },
  { tokens: ['pepsi'], name: 'Pepsi', tag: 'napoje' },
  { tokens: ['redbull'], name: 'Red Bull', tag: 'napoje' },
  { tokens: ['monster'], name: 'Monster', tag: 'napoje' },
  { tokens: ['tymbark'], name: 'Tymbark', tag: 'napoje' },
];

// Marki własne sklepów (Lidl, Biedronka, Kaufland…) obejmują WIELE różnych produktów,
// więc NIE składamy ich do jednej nazwy — tylko podpowiadamy podkategorię (np.
// cokolwiek "Pikok" to wędlina → mięso, "Milbona" to nabiał).
const STORE_LABELS: { tokens: string[]; tag: string }[] = [
  { tokens: ['pikok'], tag: 'mięso' },
  { tokens: ['dulano'], tag: 'mięso' },
  { tokens: ['milbona'], tag: 'nabiał' },
  { tokens: ['pilos'], tag: 'nabiał' },
  { tokens: ['sondey'], tag: 'słodycze' },
  { tokens: ['snackday', 'snack'], tag: 'przekąski' },
  { tokens: ['alesto'], tag: 'przekąski' },
  { tokens: ['chefselect', 'chef'], tag: 'dania gotowe' },
  { tokens: ['freshona'], tag: 'warzywa' },
  { tokens: ['oceansea'], tag: 'ryby' },
  { tokens: ['kclassic', 'kklassik'], tag: 'dania gotowe' },
];

function findInList<T extends { tokens: string[] }>(key: string, list: T[]): T | undefined {
  const words = key.split(' ');
  const flat = key.replace(/ /g, '');
  for (const b of list) {
    for (const t of b.tokens) {
      if (words.includes(t)) return b;
      if (t.length >= 4 && flat.startsWith(t)) return b;
      if (t.length >= 6 && flat.includes(t)) return b;
    }
  }
  return undefined;
}

const matchBrand = (key: string) => findInList(key, BRAND_CANON);

// Podkategoria jedzenia sugerowana przez rozpoznaną markę/markę sklepu — fallback
// gdy dopasowanie po słowach kluczowych (receiptParser.ts, Faza 2.2) nic nie znalazło.
export function brandFoodSubcat(raw: string): string | undefined {
  const key = normalizeProductName(raw);
  return matchBrand(key)?.tag ?? findInList(key, STORE_LABELS)?.tag;
}

export function canonicalProductName(raw: string, aliases: NameAliases): string {
  const key = normalizeProductName(raw);
  if (aliases[key]) return aliases[key];
  const brand = matchBrand(key);
  if (brand) return brand.name;
  const flat = key.replace(/ /g, '');
  for (const k of Object.keys(aliases)) {
    if (k.replace(/ /g, '') === flat) return aliases[k];
  }
  const fuzzy = findFuzzyMatch(key, aliases);
  if (fuzzy) return fuzzy;
  return raw.trim();
}

// ─── Pamięć wagi produktu (kg) ──────────────────────────────────────────────────

export type WeightMemory = Record<string, number>;

export async function loadWeightMemory(): Promise<WeightMemory> {
  try { const raw = await AsyncStorage.getItem(WEIGHT_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export async function saveWeightMemory(items: { name: string; kg: number }[]): Promise<void> {
  const valid = items.filter((i) => i.name.trim() && i.kg > 0);
  if (valid.length === 0) return;
  try {
    const mem = await loadWeightMemory();
    for (const i of valid) mem[normalize(i.name)] = i.kg;
    const entries = Object.entries(mem);
    const trimmed = entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : mem;
    await AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function weightFor(name: string, mem: WeightMemory): number | undefined {
  const key = normalize(name);
  return mem[key] ?? findFuzzyMatch(key, mem);
}

function unitToKg(n: number, unit: string): number | undefined {
  if (!(n > 0)) return undefined;
  const kg = unit === 'kg' || unit === 'l' ? n : n / 1000;
  if (kg <= 0 || kg > 50) return undefined;
  return Math.round(kg * 1000) / 1000;
}

// Wyciąga jawną wagę/objętość wpisaną W nazwę produktu, w kg. "Ogórki 700g" → 0.7,
// "Ser Gouda 0,5 kg" → 0.5, "Woda 1,5l" → 1.5, "Chipsy 6x40g" → 0.24 (paczki
// wielokrotne). `undefined` gdy nazwa nie niesie żadnego tokenu wagi.
export function parseWeightFromName(name: string): number | undefined {
  if (!name) return undefined;
  const s = name.toLowerCase().replace(/,/g, '.');
  const mult = s.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  if (mult) return unitToKg(parseFloat(mult[1]) * parseFloat(mult[2]), mult[3]);
  const all = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/g)];
  if (all.length === 0) return undefined;
  const m = all[all.length - 1];
  return unitToKg(parseFloat(m[1]), m[2]);
}

// ─── Pamięć ceny produktu (typowa cena jednostkowa) ────────────────────────────
// Uczy się typowej ceny/jednostkę każdego produktu z zapisanych paragonów, żeby
// skaner mógł oflagować pozycję z bezsensowną ceną (OCR złapał złą liczbę, albo
// linia "SUMA/RAZEM" wkradła się jako produkt).

export interface PriceStat { n: number; mean: number; min: number; max: number; last: number }
export type PriceMemory = Record<string, PriceStat>;

export async function loadPriceMemory(): Promise<PriceMemory> {
  try { const raw = await AsyncStorage.getItem(PRICE_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export async function savePriceMemory(items: { name: string; unitPrice: number }[]): Promise<void> {
  const valid = items.filter((i) => i.name.trim() && i.unitPrice > 0 && i.unitPrice < 100000);
  if (valid.length === 0) return;
  try {
    const mem = await loadPriceMemory();
    for (const i of valid) {
      const key = normalize(i.name);
      const p = Math.round(i.unitPrice * 100) / 100;
      const cur = mem[key];
      if (!cur) mem[key] = { n: 1, mean: p, min: p, max: p, last: p };
      else {
        const n = Math.min(cur.n + 1, 20);
        mem[key] = { n, mean: cur.mean + (p - cur.mean) / n, min: Math.min(cur.min, p), max: Math.max(cur.max, p), last: p };
      }
    }
    const entries = Object.entries(mem);
    await AsyncStorage.setItem(PRICE_KEY, JSON.stringify(entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : mem));
  } catch {}
}

export function priceFor(name: string, mem: PriceMemory): PriceStat | undefined {
  const key = normalize(name);
  return mem[key] ?? findFuzzyMatch(key, mem);
}

// Flaguje TYLKO rażąco WYSOKĄ cenę (potrzeba ≥3 próbek). Rabaty obniżają cenę, więc
// nigdy nie flagujemy taniej/promocyjnej ceny. Wysoki odstający wynik vs cena
// regularna (max widziana) to niemal zawsze OCR złapał złą liczbę albo wkradła się
// linia "SUMA/RAZEM".
export type PriceFlag = { kind: 'high'; typical: number } | null;
export function priceAnomaly(unitPrice: number, stat: PriceStat | undefined): PriceFlag {
  if (!stat || stat.n < 3 || !(unitPrice > 0)) return null;
  const typical = Math.round(stat.mean * 100) / 100;
  if (unitPrice > stat.max * 2.5 && unitPrice - stat.max >= 5) return { kind: 'high', typical };
  return null;
}

// ─── Pamięć decyzji per-linia (czy to w ogóle produkt?) ────────────────────────
// Gdy podejrzana linia się pojawi, UI pyta; werdykt usera pamiętany PER SKLEP, żeby
// następnym razem ten sam śmieciowy wiersz był obsłużony automatycznie.

export type LineVerdict = 'ignore' | 'product';
type LineMemory = Record<string, Record<string, LineVerdict>>; // sklep → znormName → werdykt

function storeSlug(store?: string): string {
  return (store ?? 'generic').toLowerCase().trim() || 'generic';
}

export async function loadLineMemory(): Promise<LineMemory> {
  try { const raw = await AsyncStorage.getItem(LINE_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export function lineVerdict(mem: LineMemory, store: string | undefined, name: string): LineVerdict | undefined {
  const byStore = mem[storeSlug(store)];
  if (!byStore) return undefined;
  const key = normalizeProductName(name);
  if (byStore[key]) return byStore[key];
  return findFuzzyMatch(key, byStore);
}

export async function saveLineVerdicts(store: string | undefined, verdicts: { name: string; verdict: LineVerdict }[]): Promise<void> {
  if (verdicts.length === 0) return;
  try {
    const mem = await loadLineMemory();
    const slug = storeSlug(store);
    const byStore = mem[slug] ?? {};
    for (const v of verdicts) {
      const key = normalizeProductName(v.name);
      if (key) byStore[key] = v.verdict;
    }
    const entries = Object.entries(byStore);
    mem[slug] = entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : byStore;
    await AsyncStorage.setItem(LINE_KEY, JSON.stringify(mem));
  } catch {}
}
