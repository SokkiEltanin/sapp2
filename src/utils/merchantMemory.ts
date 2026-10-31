import AsyncStorage from '@react-native-async-storage/async-storage';

// Port z sapp (src/utils/merchantMemory.ts) — mechanizm zaufania/auto-akceptacji
// 1:1. JEDNA adaptacja: sapp pamiętał `category: ExpenseCategory` per sprzedawca —
// sapp2 pamięta `tags: string[]` (dowolne, wielokrotne, patrz types/finances.ts) i
// liczy "czyste zaakceptowanie" jako "user NIE zmienił podpowiedzianych tagów"
// zamiast "nie zmienił kategorii". Reszta (licznik/próg/reset przy korekcie,
// wymuszony ręczny przegląd dla dużych kwot) bez zmian.
const KEY = 'merchant_memory_v1';

export const AUTO_THRESHOLD = 5; // ile czystych akceptacji zanim sprzedawca dostaje autopilota

export interface MerchantInfo {
  tags: string[];
  name?: string;
  cleanAccepts?: number; // kolejne akceptacje gdzie podpowiedziane tagi zostały bez zmian
  auto?: boolean;        // "ukończył szkołę" → loguje automatycznie bez ręcznego przeglądu
}
export type MerchantMemory = Record<string, MerchantInfo>; // storeKey (lowercase) → info

const norm = (k: string) => k.trim().toLowerCase();

export async function loadMerchantMemory(): Promise<MerchantMemory> {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

async function writeMemory(mem: MerchantMemory): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(mem)); } catch {}
}

// Zapisz/odśwież tagi + nazwę sprzedawcy BEZ dotykania liczników zaufania.
export async function saveMerchant(storeKey: string, info: { tags: string[]; name?: string }): Promise<void> {
  const key = norm(storeKey);
  if (!key) return;
  const mem = await loadMerchantMemory();
  const prev = mem[key] ?? { tags: info.tags };
  mem[key] = { ...prev, tags: info.tags, ...(info.name ? { name: info.name } : {}) };
  await writeMemory(mem);
}

// Zapisuje jedną zaakceptowaną płatność i przesuwa (albo resetuje) zaufanie
// sprzedawcy. Zwraca zaktualizowane info, żeby UI mogło pokazać "3/5" albo "właśnie
// przeszedł na automat".
export async function recordMerchantAccept(
  storeKey: string,
  opts: { tags: string[]; name?: string; corrected: boolean },
): Promise<MerchantInfo | undefined> {
  const key = norm(storeKey);
  if (!key) return undefined;
  const mem = await loadMerchantMemory();
  const prev = mem[key] ?? { tags: opts.tags };
  const next: MerchantInfo = { ...prev, tags: opts.tags, ...(opts.name ? { name: opts.name } : {}) };
  if (opts.corrected) {
    next.cleanAccepts = 0;
    next.auto = false;
  } else {
    next.cleanAccepts = (prev.cleanAccepts ?? 0) + 1;
    if (next.cleanAccepts >= AUTO_THRESHOLD) next.auto = true;
  }
  mem[key] = next;
  await writeMemory(mem);
  return next;
}

export function merchantFor(storeKey: string, mem: MerchantMemory): MerchantInfo | undefined {
  return mem[norm(storeKey)];
}

// Czy ten sprzedawca jest wystarczająco zaufany żeby logować automatycznie?
export async function merchantIsAuto(storeKey: string): Promise<boolean> {
  const mem = await loadMerchantMemory();
  return !!merchantFor(storeKey, mem)?.auto;
}

// Ręczne nadpisanie — odbierz (albo nadaj) autopilota z poziomu UI.
export async function setMerchantAuto(storeKey: string, auto: boolean): Promise<void> {
  const key = norm(storeKey);
  const mem = await loadMerchantMemory();
  const prev = mem[key];
  if (!prev) return;
  mem[key] = { ...prev, auto, ...(auto ? {} : { cleanAccepts: 0 }) };
  await writeMemory(mem);
}

// Pierwsza podpowiedź tagów dla sklepu, zanim appka się czegokolwiek nauczy — mały
// wbudowany słownik popularnych polskich sieci. Zwraca pustą listę gdy nic nie pasuje
// (user wtedy po prostu nie dostaje żadnej podpowiedzi, nie fałszywej).
const STORE_TAGS: [string[], string[]][] = [
  [['lidl', 'biedronka', 'kaufland', 'auchan', 'carrefour', 'żabka', 'zabka', 'aldi', 'netto', 'dino', 'stokrotka', 'lewiatan', 'delikatesy', 'spar'], ['Jedzenie']],
  [['orlen', ' bp', 'shell', 'circle k', 'moya', 'lotos', 'amic', 'stacja paliw', 'mpk', 'pkp', 'intercity', 'uber', 'bolt'], ['Transport']],
  [['mcdonald', 'kfc', 'burger', 'pizza', 'kebab', 'sushi', 'restauracja', 'pyszne', 'glovo', 'wolt'], ['Jedzenie']],
  [['kino', 'cinema', 'steam', 'nuvei', 'núvei', 'spotify', 'netflix', 'playstation', 'xbox', 'epic games', 'gog'], ['Rozrywka']],
  [['rossmann', 'hebe', 'super-pharm', 'apteka', 'ziko', 'dr max', 'gemini'], ['Zdrowie']],
  [['ccc', 'deichmann', 'reserved', 'sinsay', 'house', 'cropp', 'h&m', 'zara', 'pepco', 'primark', 'decathlon'], ['Odzież']],
  [['media expert', 'rtv euro', 'x-kom', 'komputronik', 'media markt', 'empik', 'action', 'ikea', 'leroy'], ['Dom']],
];

export function guessTags(store: string): string[] {
  const s = store.toLowerCase();
  for (const [kws, tags] of STORE_TAGS) if (kws.some((k) => s.includes(k))) return tags;
  return [];
}
