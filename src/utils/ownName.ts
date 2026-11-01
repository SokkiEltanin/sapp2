import AsyncStorage from '@react-native-async-storage/async-storage';

// Port z sapp 1:1. Własne imię/nazwisko usera — bank push przy przelewie między
// WŁASNYMI kontami (nie do Revolut/oszczędności, po prostu drugie konto na to samo
// nazwisko) niesie `odbiorca: <Imię Nazwisko>`, bez żadnego słowa-klucza typu
// "Revolut"/"oszczędności" które `selfTransfer` już łapie w bankNotification.ts. User
// wpisuje swoje imię+nazwisko RAZ w Ustawieniach, dalej `parseBankNotification`
// porównuje `odbiorca` z tą wartością (znormalizowane) — wczytane raz przy starcie
// appki, potem czysta, synchroniczna funkcja bez await w gorącej ścieżce parsowania.
const OWN_NAME_KEY = 'own_name_v1';
let ownName = '';

export function normalizeName(s: string): string {
  const DIACRITICS: Record<string, string> = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ż: 'z', ź: 'z' };
  return s.toLowerCase().trim()
    .replace(/[ąćęłńóśżź]/g, (c) => DIACRITICS[c] ?? c)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getOwnName(): string {
  return ownName;
}

export async function setOwnName(name: string): Promise<void> {
  ownName = name.trim();
  try { await AsyncStorage.setItem(OWN_NAME_KEY, ownName); } catch {}
}

export async function loadOwnName(): Promise<string> {
  try { ownName = (await AsyncStorage.getItem(OWN_NAME_KEY)) ?? ''; } catch { ownName = ''; }
  return ownName;
}

// Czy `text` (np. pole "odbiorca" z powiadomienia banku) zawiera skonfigurowane własne
// imię+nazwisko? Puste `ownName`/`text` → zawsze false.
export function matchesOwnName(text: string): boolean {
  if (!ownName || !text) return false;
  return normalizeName(text).includes(normalizeName(ownName));
}
