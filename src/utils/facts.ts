import { FACT_LIST, FACT_CATS, type Fact, type FactCat } from './factsData';

// Ciekawostki 2.0 (2026-11-16, user: "każda ciekawostka pokazuje się tylko raz", "znam to —
// nie pokazuj", "ta sama na komp i tel na raz"). Jedna ciekawostka na dzień; wybór jest
// DETERMINISTYCZNY (pierwsza w FACT_ORDER, której nie było i której dziedzina jest
// włączona), więc telefon i komputer z tym samym stanem wybiorą to samo, zanim zdąży
// dojść synchronizacja. Stan: store/factsStore.ts + dokument `facts` w cloudSync.
export interface FactCur { id: string; day: string; at: number }
export interface FactsData {
  cur: FactCur | null;
  seen: string[];   // pokazane (w kolejności) — nigdy więcej się nie wylosują
  known: string[];  // "Znam to"
  off: FactCat[];   // wyłączone dziedziny
  round: number;    // "Od nowa" po przeczytaniu wszystkich — wyższa runda unieważnia `seen` z niższej
  t: number;        // ostatnia zmiana (ms)
}

export const FACT_BY_ID: Record<string, Fact> = Object.fromEntries(FACT_LIST.map((f) => [f.id, f]));
export const CAT_LABEL = Object.fromEntries(FACT_CATS.map((c) => [c.k, c.l])) as Record<FactCat, string>;

// Na przemian z każdej dziedziny (zdrowie, medycyna, materiały, …), żeby dni się różniły.
export const FACT_ORDER: string[] = (() => {
  const by = FACT_CATS.map((c) => FACT_LIST.filter((f) => f.cat === c.k));
  const out: string[] = [];
  for (let i = 0; i < Math.max(...by.map((b) => b.length)); i++) for (const b of by) if (b[i]) out.push(b[i].id);
  return out;
})();

export function nextFact(seen: string[], known: string[], off: FactCat[]): string | null {
  const skip = new Set([...seen, ...known]);
  return FACT_ORDER.find((id) => !skip.has(id) && !off.includes(FACT_BY_ID[id].cat)) ?? null;
}

// Ile zostało do przeczytania we włączonych dziedzinach.
export function factsLeft(d: Pick<FactsData, 'seen' | 'known' | 'off'>): number {
  const skip = new Set([...d.seen, ...d.known]);
  return FACT_LIST.filter((f) => !skip.has(f.id) && !d.off.includes(f.cat)).length;
}

const curOk = (d: FactsData, day: string) => !!d.cur && d.cur.day === day && !!FACT_BY_ID[d.cur.id]
  && !d.known.includes(d.cur.id) && !d.off.includes(FACT_BY_ID[d.cur.id].cat);

// Ciekawostka na `day`: dzisiejsza zostaje; nowy dzień / "Znam to" / wyłączona dziedzina → następna.
export function rollFact(d: FactsData, day: string, now: number): FactsData {
  if (curOk(d, day)) return d;
  const id = nextFact(d.seen, d.known, d.off);
  if (!id) return d.cur ? { ...d, cur: null, t: now } : d;
  return { ...d, cur: { id, day, at: now }, seen: [...d.seen, id], t: now };
}

const union = (a: string[], b: string[]) => { const s = new Set(a); return [...a, ...b.filter((x) => !s.has(x))]; };

// Scalenie z drugim urządzeniem: przeczytane i "znam" sumują się, dziedziny z nowszej zmiany.
// Bieżąca ciekawostka jednej strony jest NIEAKTUALNA, jeśli druga strona widziała ją
// wcześniej (ma w `seen`, ale pokazuje już inną) — np. komputer wylosował po dłuższej
// przerwie, zanim doszły zmiany z telefonu. Wtedy wygrywa druga albo losujemy dalej.
export function mergeFacts(a: FactsData, b: FactsData, day: string, now: number): FactsData {
  // Inna runda: przeczytane i bieżąca tylko z nowszej (inaczej suma `seen` cofnęłaby "Od nowa").
  if (a.round !== b.round) {
    const [hi, lo] = a.round > b.round ? [a, b] : [b, a];
    return rollFact({ ...hi, known: union(hi.known, lo.known), off: (b.t > a.t ? b : a).off, t: Math.max(a.t, b.t) }, day, now);
  }
  const fresh = (x: FactsData, o: FactsData) => (x.cur && (!o.seen.includes(x.cur.id) || o.cur?.id === x.cur.id) ? x.cur : null);
  const ca = fresh(a, b), cb = fresh(b, a);
  const cur = ca && cb ? (cb.at > ca.at ? cb : ca) : ca ?? cb;
  const merged: FactsData = {
    cur,
    seen: union(a.seen, b.seen),
    known: union(a.known, b.known),
    off: (b.t > a.t ? b : a).off,
    round: a.round,
    t: Math.max(a.t, b.t),
  };
  return rollFact(merged, day, now);
}

export function sanitizeFacts(v: any): FactsData {
  const ids = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string') : []);
  const cats = FACT_CATS.map((c) => c.k as string);
  const cur = v?.cur && typeof v.cur.id === 'string' && typeof v.cur.day === 'string'
    ? { id: v.cur.id, day: v.cur.day, at: typeof v.cur.at === 'number' ? v.cur.at : 0 } : null;
  return {
    cur,
    seen: ids(v?.seen),
    known: ids(v?.known),
    off: ids(v?.off).filter((c) => cats.includes(c)) as FactCat[],
    round: typeof v?.round === 'number' ? v.round : 0,
    t: typeof v?.t === 'number' ? v.t : 0,
  };
}
