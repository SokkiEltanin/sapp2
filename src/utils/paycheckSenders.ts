import AsyncStorage from '@react-native-async-storage/async-storage';

// Port z sapp 1:1 (lista nadawców). Pamięta, którzy nadawcy przelewów to wypłaty, więc
// przychodzący przelew od znanego pracodawcy jest od razu rozpoznany jako pensja nawet
// gdy treść powiadomienia nie ma słowa "wynagrodzenie"/"pensja" (np. "Wpłynęło … od
// MARKETING INVESTMENT GROUP"). User uczy raz, potwierdzając przychód jako wypłatę w
// przeglądzie.
const KEY = 'paycheck_sender_keys';

// DOŁĄCZONE 2026-11-09 (bug: user zaznaczył "to wypłata" w przeglądzie, ale appka nie
// miała gdzie wpisać PREFIKSU pracodawcy — `isPaycheck()` w utils/paycheck.ts wymaga
// taga/notatki pasującej do `Employer.workPrefix`, a przełącznik w bank-review.tsx
// dawał tylko generyczny tag 'wypłata'. Teraz pamiętamy też KTÓREGO pracodawcę dany
// nadawca reprezentuje — kolejny przelew od tego samego nadawcy od razu podpowiada
// właściwego pracodawcę, nie tylko "to jest wypłata".
const EMPLOYER_KEY = 'paycheck_sender_employer';

let _cache: string[] | null = null;
let _employerCache: Record<string, string> | null = null;

async function load(): Promise<string[]> {
  if (_cache) return _cache;
  try { const raw = await AsyncStorage.getItem(KEY); _cache = raw ? JSON.parse(raw) : []; }
  catch { _cache = []; }
  if (!Array.isArray(_cache)) _cache = [];
  return _cache;
}

async function loadEmployerMap(): Promise<Record<string, string>> {
  if (_employerCache) return _employerCache;
  try { const raw = await AsyncStorage.getItem(EMPLOYER_KEY); _employerCache = raw ? JSON.parse(raw) : {}; }
  catch { _employerCache = {}; }
  if (!_employerCache || typeof _employerCache !== 'object') _employerCache = {};
  return _employerCache;
}

export async function rememberPaycheckSender(storeKey?: string): Promise<void> {
  const k = (storeKey ?? '').trim().toLowerCase();
  if (k.length < 2) return;
  const list = await load();
  if (list.includes(k)) return;
  _cache = [...list, k].slice(-30);
  try { await AsyncStorage.setItem(KEY, JSON.stringify(_cache)); } catch {}
}

export async function isKnownPaycheckSender(storeKey?: string): Promise<boolean> {
  const k = (storeKey ?? '').trim().toLowerCase();
  if (k.length < 2) return false;
  return (await load()).includes(k);
}

export async function rememberPaycheckSenderEmployer(storeKey: string | undefined, employerId: string): Promise<void> {
  const k = (storeKey ?? '').trim().toLowerCase();
  if (k.length < 2) return;
  const map = await loadEmployerMap();
  if (map[k] === employerId) return;
  _employerCache = { ...map, [k]: employerId };
  try { await AsyncStorage.setItem(EMPLOYER_KEY, JSON.stringify(_employerCache)); } catch {}
}

export async function knownPaycheckSenderEmployer(storeKey?: string): Promise<string | undefined> {
  const k = (storeKey ?? '').trim().toLowerCase();
  if (k.length < 2) return undefined;
  return (await loadEmployerMap())[k];
}
