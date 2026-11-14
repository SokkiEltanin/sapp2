import { removeWithUndo, runUndo, useUndoStore, dismissUndo } from '@/services/undo';

const store = (items: any[]) => {
  let st: any = { items };
  return { getState: () => st, setState: (p: any) => { st = { ...st, ...p }; } };
};

describe('Cofnij', () => {
  afterEach(() => dismissUndo());

  it('usuwa i przywraca ten sam element z nowszym updatedAt', () => {
    const s = store([{ id: 'a', updatedAt: '2020' }, { id: 'b', updatedAt: 5 }]);
    removeWithUndo(s, 'items', s.getState().items[0], 'Usunięto a');
    expect(s.getState().items.map((x: any) => x.id)).toEqual(['b']);
    expect(useUndoStore.getState().label).toBe('Usunięto a');
    runUndo();
    const a = s.getState().items.find((x: any) => x.id === 'a');
    expect(a.updatedAt > '2020').toBe(true);
    expect(useUndoStore.getState().label).toBeNull();
  });

  it('liczbowy updatedAt zostaje liczbą; podwójne przywrócenie bez duplikatu', () => {
    const s = store([{ id: 'b', updatedAt: 5 }]);
    removeWithUndo(s, 'items', s.getState().items[0], 'x');
    const action = useUndoStore.getState().action!;
    runUndo(); action();
    expect(s.getState().items).toHaveLength(1);
    expect(typeof s.getState().items[0].updatedAt).toBe('number');
  });
});
