// Port z sapp (src/utils/recurringBills.ts) — TYLKO słownik rachunków + dopasowanie
// tekstu (`looksLikeBill`/`billTagFor`), logika 1:1. ŚWIADOMIE pominięte: wszystko co
// tam wiąże się z konkretną Subskrypcją (`detectRecurringBills`/
// `advanceNextBillingDate`/`rollOverdueSubscription`/`isDurationExpired`,
// dismiss-list) — sapp2 nie ma jeszcze ekranu/store'a Subskrypcje (patrz
// ARCHITECTURE.md §FINANSE "PRACA/SUBSKRYPCJE — bez zmian, wciąż osobne"), dorzucimy
// to gdy ten ekran faktycznie powstanie, nie teraz (CLAUDE.md: nie buduj czego nie
// potrzebujesz).
//
// `icon` = nazwa komponentu z `lucide-react-native`, rozwiązywana dynamicznie tam
// gdzie potrzebna (ten sam wzorzec co w sapp) — Internet/Prąd/Gaz/Woda dostają WŁASNĄ
// ikonę zamiast dziedziczyć jedną wspólną "dom".
export const BILL_TYPES: { match: string[]; name: string; tag: string; icon: string }[] = [
  { match: ['czynsz', 'mieszkanie', 'administr', 'adm ', 'spółdziel', 'spoldziel', 'wspólnot', 'wspolnot'], name: 'Czynsz / mieszkanie', tag: 'czynsz', icon: 'Home' },
  { match: ['prąd', 'prad', 'pge', 'tauron', 'energa', 'enea', 'energia elektr'], name: 'Prąd', tag: 'prąd', icon: 'Zap' },
  { match: ['internet'], name: 'Internet', tag: 'internet', icon: 'Wifi' },
  { match: ['gaz '], name: 'Gaz', tag: 'gaz', icon: 'Flame' },
  { match: ['woda', 'ścieki', 'scieki', 'wod-kan'], name: 'Woda', tag: 'woda', icon: 'Droplet' },
  { match: ['ogrzewani', 'ciepł', 'cieplo'], name: 'Ogrzewanie', tag: 'ogrzewanie', icon: 'Thermometer' },
  { match: ['ubezpiecz'], name: 'Ubezpieczenie', tag: 'ubezpieczenie', icon: 'Shield' },
  { match: ['abonament', 'telefon'], name: 'Telefon / abonament', tag: 'telefon', icon: 'Phone' },
];

// Czy tekst (note + storeName + tags złączone) brzmi jak rachunek stały.
export function looksLikeBill(text: string): boolean {
  const hay = text.toLowerCase();
  return BILL_TYPES.some((bt) => bt.match.some((m) => hay.includes(m)));
}

// Który BILL_TYPE (jeśli jakiś) pasuje do wydatku — sprawdzane po note + storeName +
// tags, więc wydatek z samym storeName="PGE" (bez note/tagu) i tak złapie "Prąd".
export function billTagFor(e: { note?: string; storeName?: string; tags?: string[] }): { tag: string; name: string; icon: string } | null {
  const hay = `${e.note ?? ''} ${e.storeName ?? ''} ${(e.tags ?? []).join(' ')}`.toLowerCase();
  const t = BILL_TYPES.find((bt) => bt.match.some((m) => hay.includes(m)));
  return t ? { tag: t.tag, name: t.name, icon: t.icon } : null;
}
