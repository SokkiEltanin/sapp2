import { stableStringify, planInitialMerge, diffLocal, applyRemote } from '@/utils/syncMerge';

type T = { id: string; title: string; updatedAt?: string; createdAt?: string };
const it = (id: string, title: string, updatedAt = '2026-11-13T10:00:00Z'): T => ({ id, title, updatedAt });
const ms = (iso: string) => Date.parse(iso);

describe('stableStringify', () => {
  test('kolejność kluczy i undefined nie mają znaczenia', () => {
    expect(stableStringify({ b: 1, a: [1, { y: 2, x: 1 }], c: undefined })).toBe(stableStringify({ a: [1, { x: 1, y: 2 }], b: 1 }));
  });
});

describe('planInitialMerge', () => {
  test('nowe zdalne → do lokalnych; lokalne nigdy niewysłane → do wysłania', () => {
    const p = planInitialMerge([it('a', 'lok')], [{ id: 'b', data: { title: 'zdal', updatedAt: '2026-11-13T10:00:00Z', _u: 1 } }], {});
    expect(p.items.map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(p.push.map((x) => x.id)).toEqual(['a']);
    expect(p.changedLocal).toBe(true);
  });
  test('konflikt: wygrywa nowsza strona', () => {
    const local = [it('a', 'nowsze lokalnie', '2026-11-13T12:00:00Z'), it('b', 'starsze lokalnie', '2026-11-13T08:00:00Z')];
    const remote = [
      { id: 'a', data: { title: 'stare zdalnie', _u: ms('2026-11-13T11:00:00Z') } },
      { id: 'b', data: { title: 'nowe zdalnie', updatedAt: '2026-11-13T09:00:00Z', _u: ms('2026-11-13T09:00:00Z') } },
    ];
    const p = planInitialMerge(local, remote, {});
    expect(p.push.map((x) => x.id)).toEqual(['a']);
    expect(p.items.find((x) => x.id === 'b')!.title).toBe('nowe zdalnie');
  });
  test('usunięte zdalnie znika lokalnie; usunięte lokalnie offline → znacznik do wysłania', () => {
    const p = planInitialMerge(
      [it('a', 'x', '2026-11-13T08:00:00Z')],
      [{ id: 'a', data: { _deleted: true, _u: ms('2026-11-13T09:00:00Z') } }, { id: 'c', data: { title: 'c', _u: 1 } }],
      { c: ms('2026-11-13T10:00:00Z'), d: 5 },
    );
    expect(p.items.map((x) => x.id)).toEqual([]);
    expect(p.pushDeletes.sort()).toEqual(['c', 'd']);
  });
});

describe('diffLocal / applyRemote', () => {
  test('diff: zmienione, nowe i usunięte', () => {
    const sent = new Map([['a', stableStringify(it('a', 'x'))], ['b', stableStringify(it('b', 'y'))]]);
    const d = diffLocal([it('a', 'x'), it('b', 'zmiana'), it('c', 'nowe')], sent);
    expect(d.upserts.map((x) => x.id)).toEqual(['b', 'c']);
    expect(diffLocal([it('a', 'x')], sent).deletes).toEqual(['b']);
  });
  test('zdalne zmiany: pomija elementy z niewysłaną lokalną edycją', () => {
    const r = applyRemote([it('a', 'x'), it('b', 'y')], [
      { id: 'a', data: { title: 'zdalnie', updatedAt: '2026-11-13T10:00:00Z' } },
      { id: 'b', data: { _deleted: true } },
      { id: 'c', data: { title: 'nowy' } },
    ], new Set(['a']));
    expect(r.items.map((x) => `${x.id}:${x.title}`).sort()).toEqual(['a:x', 'c:nowy']);
    expect(r.applied.map((x) => x.id)).toEqual(['b', 'c']);
  });
});
