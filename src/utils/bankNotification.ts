// Port z sapp (src/utils/bankNotification.ts) 1:1, logika bez zmian — parsuje push
// z banku na strukturalną transakcję i dopasowuje ją do już dodanego wydatku (ta sama
// kwota, blisko w czasie, pasujący sklep), żeby nie zdublować. Dostrojony pod Bank
// Pekao S.A. (PeoPay/Pekao24) + PKO BP (IKO) — te same banki co w sapp, ten sam user.
//
// Przykładowa treść Pekao:
//   "Zapłacono kwotę 10,18 PLN karta *8743 dnia 03-07-2026 godz. 06:37:30
//    w LIDL HETMANSKA LIDL HETMANSKA Rzeszow POL. Bank Pekao S.A."

import { localISO } from '@/utils/date';

export interface ParsedBankTx {
  amount: number;        // 10.18
  currency: string;      // 'PLN' | 'EUR' | 'USD' … (płatności kartą za granicą)
  dateISO: string;       // 2026-07-03T06:37:30 (lokalny czas)
  store: string;         // wychodzące: sprzedawca ("LIDL HETMANSKA"); przychodzące: nadawca/tytuł
  storeKey: string;      // pierwsze słowo, małe litery — do fuzzy-matchingu / pamięci sprzedawcy
  method: 'card' | 'blik' | 'transfer' | 'cash';
  direction: 'out' | 'in'; // out = wydatek (płatność), in = przychód (przelew przychodzący)
  isSalary?: boolean;    // przychodzący wygląda jak wypłata (wynagrodzenie/wypłata)
  selfTransfer?: boolean; // wychodzący przelew na WŁASNE inne konto (Revolut/oszczędności)
  raw: string;
}

// Pakiety apek bankowych, których powiadomień słuchamy (Pekao PeoPay/Pekao24 + PKO IKO).
export const BANK_PACKAGES = ['pl.pekao24.peopay', 'eu.eleader.mobilebanking.pekao', 'pl.pkobp.iko'];

const num = (s: string) => parseFloat(s.replace(/\s/g, '').replace(',', '.'));

// Przelew własny po imieniu USUNIĘTY (2026-11-14, user: "jak robię sam odznaczę, ale
// stworzę szablon pod to") — zostaje rozpoznanie po słowach (Revolut, oszczędności…).
export function parseBankNotification(title: string, text: string): ParsedBankTx | null {
  const body = `${title ?? ''} ${text ?? ''}`.replace(/\s+/g, ' ').trim();
  if (!body) return null;

  // Kwota + waluta: "kwotę 10,18 PLN" / "22,14 EUR" (płatności za granicą nie są w PLN).
  const CUR = 'PLN|zł|z\\u0142|EUR|USD|GBP|CHF|CZK|SEK|NOK|DKK|HUF';
  const amtM = body.match(new RegExp(`kwot[ęe]\\s+([\\d\\s]+[.,]\\d{2})\\s*(${CUR})`, 'i'))
    ?? body.match(new RegExp(`([\\d\\s]+[.,]\\d{2})\\s*(${CUR})`, 'i'));
  if (!amtM) return null;
  const amount = num(amtM[1]);
  if (!(amount > 0)) return null;
  const currency = /z[łl]/i.test(amtM[2]) ? 'PLN' : amtM[2].toUpperCase();

  // Przychodzące (pieniądze WCHODZĄ) vs wychodzące (płatność kartą/zakup). Jeśli żadne
  // nie zostanie rozpoznane, pomiń push.
  const inTrig = /przelew\s+przychodz|uznanie\s+rachunku|wp[łl]y[wn]|wynagrodzen|zasilenie|otrzyma[łl]e[śs]|zaksi[ęe]gowano\s+wp[łl]at|\bwp[łl]ata\b|na\s+(?:konto|rachunek)/i.test(body);
  // "Wykonano przelew … z konta … na konto …" to pieniądze, które WYSŁAŁEŚ — wychodzące.
  const paidOut = /zap[łl]acono|wykonano\s+przelew|zlecono\s+przelew|z\s+konta\s+\*?\d/i.test(body);
  const outTrig = /zap[łl]acono|transakcj|p[łl]atno[śs][cć]|platnosc|blik|zakup|wykonano\s+przelew|zlecono\s+przelew/i.test(body);
  if (!inTrig && !outTrig) return null;
  const direction: 'in' | 'out' = (inTrig && !paidOut) ? 'in' : 'out';

  // Data + czas: "dnia 03-07-2026 godz. 06:37:30" (fallback: teraz, LOKALNIE nie UTC).
  let dateISO = localISO();
  const dtM = body.match(/(\d{2})-(\d{2})-(\d{4}).*?(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (dtM) {
    const [, dd, mm, yyyy, hh, mi, ss] = dtM;
    dateISO = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss ?? '00'}`;
  }

  // ── Przelew przychodzący → przychód ─────────────────────────────────────────
  if (direction === 'in') {
    const isSalary = /wynagrodzen|wyp[łl]at|pensj|sal(?:ary|ariu)/i.test(body);
    const senderM = body.match(/(?:nadawca:?|\bod\s+nadawcy:?|\bod:)\s*(.+?)(?:\s*(?:tytu[łl]|tyt\.?|kwot|dnia|nr\b|rachun|\.\s*Bank|$))/i)
      ?? body.match(/\bod\s+([A-ZŁŚŻĆŃÓĄĘ][^.,;]+?)(?:\s*(?:tytu[łl]|tyt\.?|kwot|dnia|nr\b|rachun|\.\s*Bank|$))/);
    const titleM = body.match(/tytu[łl][:\s]+(.+?)(?:\s*(?:dnia|nr\b|kwot|rachun|\.\s*Bank|$))/i);
    let store = (senderM?.[1] ?? titleM?.[1] ?? (isSalary ? 'Wynagrodzenie' : 'Przelew')).replace(/\s+/g, ' ').trim();
    if (store.length > 40) store = store.slice(0, 40).trim();
    const storeKey = (store.split(/\s+/)[0] ?? 'przelew').toLowerCase();
    return { amount, currency, dateISO, store, storeKey, method: 'transfer', direction, isSalary, raw: body };
  }

  // ── Przelew WYCHODZĄCY (nie płatność kartą) → odbiorca + sprawdzenie self-transfer ──
  const isTransferOut = /wykonano\s+przelew|zlecono\s+przelew/i.test(body);
  if (isTransferOut) {
    const rcpM = body.match(/odbiorca:?\s*(.+?)(?:\s*(?:tytu[łl]|tyt\.?|nr\b|rachun|kwot|dnia|\.\s*Bank|$))/i);
    let store = (rcpM?.[1] ?? 'Przelew wychodzący').replace(/\s+/g, ' ').trim();
    if (store.length > 40) store = store.slice(0, 40).trim();
    const selfTransfer = /revolut|oszcz[ęe]dno|w[łl]asne|savings|konto\s+oszcz/i.test(body);
    const storeKey = (store.split(/\s+/)[0] ?? 'przelew').toLowerCase();
    return { amount, currency, dateISO, store, storeKey, method: 'transfer', direction: 'out', selfTransfer, raw: body };
  }

  // ── Płatność kartą/BLIK wychodząca → wydatek ────────────────────────────────
  let store = '';
  const stM = body.match(/\bw\s+(.+?)(?:\s+POL\b|\.\s*Bank|\.\s*$|$)/i);
  if (stM) {
    const seen = new Set<string>();
    store = stM[1].split(/\s+/)
      .filter((w) => { const k = w.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return w.length > 1; })
      .join(' ')
      .replace(/\s*(POL|POLSKA)\s*$/i, '')
      .replace(/[\s\-–—.,;:*]+$/, '')
      .replace(/^[\s\-–—.,;:*]+/, '')
      .trim();
  }
  const storeKey = (store.split(/\s+/)[0] ?? '').toLowerCase();

  const method: ParsedBankTx['method'] = /blik/i.test(body) ? 'blik'
    : /przelew/i.test(body) ? 'transfer'
    : /karta|kart[aąy]/i.test(body) ? 'card' : 'card';

  return { amount, currency, dateISO, store, storeKey, method, direction: 'out', raw: body };
}

// Dopasowuje przelew przychodzący do już zalogowanego przychodu (ta sama kwota, ten sam
// dzień) — żeby ręcznie wpisana wypłata nie zdublowała się przez auto-capture.
export function findMatchingIncome(tx: ParsedBankTx, expenses: MatchExpense[], windowMin = 1440): MatchExpense | null {
  const txTime = new Date(tx.dateISO).getTime();
  for (const e of expenses) {
    if (e.type !== 'income' || e.bankMatched) continue;
    if (!amountMatches(e, tx.amount)) continue;
    const et = new Date(e.date ?? '').getTime();
    if (!et) continue;
    if (sameLocalDay(et, txTime) || Math.abs(et - txTime) / 60000 <= windowMin) return e;
  }
  return null;
}

// ── Dopasowanie sparsowanej transakcji do już istniejącego wydatku ───────────
export interface MatchExpense { id: string; type?: string; amount: number; originalAmount?: number; date?: string; storeName?: string; note?: string; bankMatched?: boolean; receiptItems?: { price: number }[] }

// Gdy `e.amount` jest skonwertowaną wartością PLN (`plnOverride` przy potwierdzaniu
// walutowej płatności), oryginalna, walutowa kwota zostaje na `e.originalAmount`.
// Redostarczone powiadomienie wciąż niesie SUROWĄ, walutową kwotę — porównanie
// WYŁĄCZNIE do `e.amount` nigdy nie wykrywało takiego duplikatu. Sprawdź obie wartości.
//
// Paragon (2026-11-12, user: paragon z Lidla + powiadomienie = dubel): `amount`
// paragonu to suma pozycji NIEWYKLUCZONYCH — po wykluczeniu np. kaucji/rzeczy
// współlokatora różni się od kwoty z karty. Pełna suma WSZYSTKICH pozycji to
// realnie zapłacona kwota, więc też się liczy.
export function amountMatches(e: { amount: number; originalAmount?: number; receiptItems?: { price: number }[] }, txAmount: number): boolean {
  if (Math.abs(e.amount - txAmount) <= 0.011) return true;
  if (e.originalAmount != null && Math.abs(e.originalAmount - txAmount) <= 0.011) return true;
  if (e.receiptItems?.length) {
    const gross = e.receiptItems.reduce((sum, it) => sum + (it.price || 0), 0);
    if (Math.abs(gross - txAmount) <= 0.011) return true;
  }
  return false;
}

export function sameLocalDay(a: number, b: number): boolean {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

// 'YYYY-MM-DD' lokalny klucz dnia — część klucza blokady, patrz asyncLock.ts.
export function localDayKey(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function findMatchingExpense(tx: ParsedBankTx, expenses: MatchExpense[], windowMin = 150): MatchExpense | null {
  const txTime = new Date(tx.dateISO).getTime();
  let best: { e: MatchExpense; score: number } | null = null;
  for (const e of expenses) {
    if (e.type === 'income' || e.bankMatched) continue;
    if (!amountMatches(e, tx.amount)) continue;
    const et = new Date(e.date ?? '').getTime();
    if (!et) continue;
    const diffMin = Math.abs(et - txTime) / 60000;
    const hay = `${e.storeName ?? ''} ${e.note ?? ''}`.toLowerCase();
    const storeOk = !tx.storeKey || hay.includes(tx.storeKey) || tx.storeKey.includes((e.storeName ?? '').toLowerCase().split(/\s+/)[0] ?? '');
    const sameDay = sameLocalDay(et, txTime);
    if (diffMin > windowMin && !(storeOk && sameDay)) continue;
    const score = (storeOk ? 100 : 0) + (sameDay ? 50 : 0) - diffMin;
    if (!best || score > best.score) best = { e, score };
  }
  return best ? best.e : null;
}

// Istniejący wydatek, z którym zatwierdzenie płatności z banku się POŁĄCZY
// zamiast dodać nowy — dokładnie ta sama logika co `commitBankTx` (bankCommit.ts
// woła to samo), wydzielona żeby bank-review mógł to POKAZAĆ przed tapnięciem
// ("to już jest: paragon Lidl — połączę"). Najpierw ten sam dzień + sklep
// (też już podpięty — redostarczone powiadomienie), potem `findMatchingExpense`.
export function findExpenseForBankTx(tx: ParsedBankTx, expenses: MatchExpense[]): MatchExpense | null {
  const txTime = new Date(tx.dateISO).getTime();
  const storeMatches = (e: MatchExpense) => {
    const hay = `${e.storeName ?? ''} ${e.note ?? ''}`.toLowerCase();
    return !tx.storeKey || hay.includes(tx.storeKey) || tx.storeKey.includes((e.storeName ?? '').toLowerCase().split(/\s+/)[0] ?? '');
  };
  const already = expenses.find((e) =>
    e.type === 'expense'
    && amountMatches(e, tx.amount)
    && !!e.date && sameLocalDay(new Date(e.date).getTime(), txTime)
    && storeMatches(e));
  return already ?? findMatchingExpense(tx, expenses);
}
