import AsyncStorage from '@react-native-async-storage/async-storage';

// Port z sapp 1:1. Pamięta, którzy nadawcy przelewów to wypłaty, więc przychodzący
// przelew od znanego pracodawcy jest od razu rozpoznany jako pensja nawet gdy treść
// powiadomienia nie ma słowa "wynagrodzenie"/"pensja" (np. "Wpłynęło … od MARKETING
// INVESTMENT GROUP"). User uczy raz, potwierdzając przychód jako wypłatę w przeglądzie.
const KEY = 'paycheck_sender_keys';

let _cache: string[] | null = null;

async function load(): Promise<string[]> {
  if (_cache) return _cache;
  try { const raw = await AsyncStorage.getItem(KEY); _cache = raw ? JSON.parse(raw) : []; }
  catch { _cache = []; }
  if (!Array.isArray(_cache)) _cache = [];
  return _cache;
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
