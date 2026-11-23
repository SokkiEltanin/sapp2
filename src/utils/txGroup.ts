import type { Expense } from '@/types/finances';
import type { TxHit } from './txFilter';
import { bucketOf, isOwnTransfer } from './fixedVariable';
import { FOOD_SUBCAT_META } from './food';
import { EXPENSE_CATEGORY_META } from './expenseCategory';
import { round2 } from './money';

// Lista transakcji pogrupowana (2026-11-17, user: "po rozwinięciu listy nie tylko sklep
// i data — posegregowane dniami / tygodniami / miesiącami / latami, domyślnie per dzień,
// i żeby wyczytać więcej: jak paragon, to jakie tagi; jak opis, to fragment; nazwa lekko
// wyróżniona"). Czyste — testy __tests__/txGroup.test.ts; UI: TransactionsModal.tsx.
export type GroupMode = 'day' | 'week' | 'month' | 'year';
export interface TxGroup { key: string; label: string; out: number; in: number; hits: TxHit[] }

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MON = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const WD = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dateOf = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

function mondayOf(iso: string): string {
  const d = dateOf(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}

export function groupKey(iso: string, mode: GroupMode): string {
  if (mode === 'day') return iso.slice(0, 10);
  if (mode === 'week') return mondayOf(iso);
  if (mode === 'month') return iso.slice(0, 7);
  return iso.slice(0, 4);
}

export function groupLabel(key: string, mode: GroupMode, now: Date = new Date()): string {
  const year = now.getFullYear();
  if (mode === 'year') return key;
  if (mode === 'month') return `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  if (mode === 'week') {
    const a = dateOf(key), b = dateOf(key); b.setDate(b.getDate() + 6);
    const sameMonth = a.getMonth() === b.getMonth();
    const yr = b.getFullYear() !== year ? ` ${b.getFullYear()}` : '';
    if (ymd(a) === mondayOf(ymd(now))) return 'Ten tydzień';
    return sameMonth ? `${a.getDate()}–${b.getDate()} ${MON[b.getMonth()]}${yr}` : `${a.getDate()} ${MON[a.getMonth()]} – ${b.getDate()} ${MON[b.getMonth()]}${yr}`;
  }
  const today = ymd(now);
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (key === today) return 'Dziś';
  if (key === ymd(y)) return 'Wczoraj';
  const d = dateOf(key);
  return `${WD[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() !== year ? ` ${d.getFullYear()}` : ''}`;
}

/** Grupy w kolejności trafień (najnowsze pierwsze), z sumami bez przelewów własnych. */
export function groupTransactions(hits: TxHit[], mode: GroupMode, now: Date = new Date()): TxGroup[] {
  const map = new Map<string, TxGroup>();
  for (const h of hits) {
    const key = groupKey(h.e.date ?? '', mode);
    let g = map.get(key);
    if (!g) { g = { key, label: groupLabel(key, mode, now), out: 0, in: 0, hits: [] }; map.set(key, g); }
    g.hits.push(h);
    if (isOwnTransfer(h.e) || h.e.originalCurrency) continue;
    if (h.e.type === 'income') g.in += h.e.amount; else g.out += h.e.amount;
  }
  return [...map.values()].map((g) => ({ ...g, out: round2(g.out), in: round2(g.in) }));
}

/** Druga linijka wiersza: co było na paragonie / fragment opisu / kategoria i tagi. */
export function txDetail(e: Expense): string {
  const items = (e.receiptItems ?? []).filter((it) => !it.excluded && it.kind !== 'deposit');
  if (items.length) {
    const sums = new Map<string, number>();
    for (const it of items) {
      const label = it.foodSubcat ? (FOOD_SUBCAT_META[it.foodSubcat]?.label ?? (it.foodSubcat === 'inne' ? 'inne jedzenie' : it.foodSubcat))
        : it.nonFoodCategory ? (EXPENSE_CATEGORY_META[it.nonFoodCategory]?.label ?? it.nonFoodCategory) : null;
      if (label) sums.set(label, (sums.get(label) ?? 0) + (it.price ?? 0));
    }
    const top = [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l.toLowerCase());
    const cats = top.length ? `${top.slice(0, 3).join(', ')}${top.length > 3 ? ` +${top.length - 3}` : ''}` : items.slice(0, 2).map((it) => it.name).join(', ');
    return `${items.length} poz. · ${cats}`;
  }
  const parts: string[] = [];
  const name = (e.storeName || '').trim();
  const note = (e.note || '').trim();
  if (note && note !== name && name) parts.push(note.length > 60 ? `${note.slice(0, 58)}…` : note);
  if (e.foodSubcat && FOOD_SUBCAT_META[e.foodSubcat]) parts.push(FOOD_SUBCAT_META[e.foodSubcat].label);
  else if (e.expenseCategory) parts.push(EXPENSE_CATEGORY_META[e.expenseCategory]?.label ?? e.expenseCategory);
  const tags = (e.tags ?? []).filter((t) => t && t.toLowerCase() !== name.toLowerCase());
  if (tags.length) parts.push(tags.slice(0, 3).map((t) => `#${t}`).join(' '));
  return parts.join(' · ');
}

/** Kolory kubłów — dziś TYLKO w środku (okno Wydatki, karty miesięcy). Na liście i kaflu
 *  Finansów kolor = kierunek pieniędzy, kubeł = biała kropka z podpisem (2026-11-23). */
export const BUCKET_COLOR = { fixed: '#60A5FA', food: '#FBBF24', variable: '#C084FC', income: '#22C55E', own: '#6E6E6E' } as const;

// Kierunek pieniędzy (2026-11-23, user: "kolory na finansach: czerwony i zielony — wychodzi
// i przychodzi, minimalistycznie; rodzaj kategorii to biały pin z podpisem, kolory dopiero w środku").
export const FLOW_COLOR = { out: '#EF4444', in: '#22C55E', own: '#6E6E6E' } as const;

/** Pasek/kropka przy wierszu: wydatek czerwony, przychód zielony, przelew własny szary. */
export function txColor(e: Expense): string {
  if (isOwnTransfer(e)) return FLOW_COLOR.own;
  return e.type === 'income' ? FLOW_COLOR.in : FLOW_COLOR.out;
}

/** Kubeł wydatku słowem (do białej kropki z podpisem); przychód/przelew własny = null. */
export function bucketLabel(e: Expense): string | null {
  if (isOwnTransfer(e) || e.type === 'income') return null;
  const b = bucketOf(e);
  return b === 'food' ? 'Jedzenie' : b === 'fixed' ? 'Stałe' : 'Zmienne';
}

/** Odcienie szarości od jasnego do ciemnego — paski podziału bez kolorów kategorii. */
export function grayRamp(n: number): string[] {
  if (n <= 1) return ['#E6E6E6'];
  return Array.from({ length: n }, (_, i) => {
    const v = Math.round(0xE6 - (0xE6 - 0x4A) * (i / (n - 1)));
    const h = v.toString(16).padStart(2, '0').toUpperCase();
    return `#${h}${h}${h}`;
  });
}
