import { FACT_LIST, FACT_CATS } from '@/utils/factsData';
import { FACT_ORDER, nextFact, rollFact, mergeFacts, factsLeft, type FactsData } from '@/utils/facts';

const empty: FactsData = { cur: null, seen: [], known: [], off: [], round: 0, t: 0 };
const D1 = '2026-11-16', D2 = '2026-11-17';

describe('treść ciekawostek', () => {
  it('unikalne id, temat max 3 słowa, liczby i akapity', () => {
    expect(new Set(FACT_LIST.map((f) => f.id)).size).toBe(FACT_LIST.length);
    for (const f of FACT_LIST) {
      expect(f.topic.trim().split(/\s+/).length).toBeLessThanOrEqual(3);
      expect(f.teaser.length).toBeGreaterThan(20);
      expect(f.nums.length).toBeGreaterThanOrEqual(2);
      expect(f.body.length).toBeGreaterThanOrEqual(2);
      expect(f.src.length).toBeGreaterThan(3);
    }
    for (const c of FACT_CATS) expect(FACT_LIST.filter((f) => f.cat === c.k).length).toBeGreaterThanOrEqual(8);
  });
  it('kolejność przeplata dziedziny i zawiera wszystkie', () => {
    expect(FACT_ORDER.length).toBe(FACT_LIST.length);
    const cats = FACT_ORDER.slice(0, FACT_CATS.length).map((id) => FACT_LIST.find((f) => f.id === id)!.cat);
    expect(new Set(cats).size).toBe(FACT_CATS.length);
  });
});

describe('losowanie bez powtórek', () => {
  it('ten sam dzień = ta sama; nowy dzień = następna, nigdy powtórka', () => {
    let d = rollFact(empty, D1, 1);
    const first = d.cur!.id;
    expect(rollFact(d, D1, 2)).toBe(d);
    d = rollFact(d, D2, 3);
    expect(d.cur!.id).not.toBe(first);
    expect(d.seen).toEqual([first, d.cur!.id]);
  });
  it('znam to i wyłączone dziedziny pomijane', () => {
    const d = rollFact(empty, D1, 1);
    const k = rollFact({ ...d, known: [d.cur!.id] }, D1, 2);
    expect(k.cur!.id).not.toBe(d.cur!.id);
    const off = rollFact({ ...empty, off: ['zdrowie'] }, D1, 1);
    expect(FACT_LIST.find((f) => f.id === off.cur!.id)!.cat).not.toBe('zdrowie');
  });
  it('wszystko przeczytane → brak', () => {
    expect(nextFact(FACT_ORDER, [], [])).toBeNull();
    expect(factsLeft({ seen: FACT_ORDER, known: [], off: [] })).toBe(0);
  });
});

describe('scalenie telefon ↔ komputer', () => {
  it('stara ciekawostka drugiego urządzenia ustępuje', () => {
    // telefon: wczoraj A, dziś B. Komputer (bez synchronizacji od przedwczoraj) wylosował dziś A.
    const a0 = rollFact(empty, D1, 1);
    const phone = rollFact(a0, D2, 10);
    const pc = rollFact(empty, D2, 20);
    expect(pc.cur!.id).toBe(a0.cur!.id);
    const m = mergeFacts(pc, phone, D2, 30);
    expect(m.cur!.id).toBe(phone.cur!.id);
    expect(m.seen).toEqual(expect.arrayContaining([a0.cur!.id, phone.cur!.id]));
  });
  it('"znam" z drugiego urządzenia zmienia bieżącą', () => {
    const d = rollFact(empty, D1, 1);
    const other = { ...d, known: [d.cur!.id], t: 5 };
    const m = mergeFacts(d, rollFact(other, D1, 5), D1, 6);
    expect(m.known).toContain(d.cur!.id);
    expect(m.cur!.id).not.toBe(d.cur!.id);
  });
  it('"Od nowa" (wyższa runda) nie jest cofane przez starsze przeczytane', () => {
    const old = { ...empty, seen: FACT_ORDER, t: 1 };
    const fresh = rollFact({ ...empty, round: 1, t: 2 }, D1, 2);
    const m = mergeFacts(old, fresh, D1, 3);
    expect(m.round).toBe(1);
    expect(m.seen).toEqual([fresh.cur!.id]);
  });
});
