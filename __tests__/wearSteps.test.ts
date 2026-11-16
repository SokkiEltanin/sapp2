import { applyWearSteps } from '@/utils/wearSteps';

const T = (id: string, steps: [string, boolean][], status = 'pending') => ({ id, title: id, status, priority: 'normal', tags: [], createdAt: '', updatedAt: '', subtasks: steps.map(([s, d]) => ({ id: s, title: s, done: d })) } as any);

describe('kroki z zegarka', () => {
  test('zaznacz / odznacz w kolejności, nieznane pomijane', () => {
    const tasks = [T('a', [['s1', false], ['s2', false]]), T('del', [['x', false]], 'deleted')];
    const r = applyWearSteps(tasks, ['a|s1|1', 'a|s2|1', 'a|s2|0', 'a|nope|1', 'b|s1|1', 'del|x|1', 'zle']);
    expect(r.get('a')).toEqual([{ id: 's1', title: 's1', done: true }, { id: 's2', title: 's2', done: false }]);
    expect(r.has('del')).toBe(false);
    expect(r.size).toBe(1);
  });
});
