import { buildWidgetSnapshot } from '@/utils/widgetTasks';
import type { Task } from '@/types/calendar';

const t = (o: Partial<Task>): Task => ({
  id: `t${Math.random()}`, title: 'x', status: 'pending', priority: 'normal', tags: [], createdAt: '2026-11-01T10:00:00Z', updatedAt: '', ...o,
});

describe('buildWidgetSnapshot', () => {
  const now = new Date(2026, 10, 13, 12, 0);
  test('kolejność: zaległe → termin rosnąco → bez terminu; zrobione pominięte', () => {
    const snap = buildWidgetSnapshot([
      t({ id: 'none', title: 'Bez terminu' }),
      t({ id: 'later', deadline: '2026-11-20' }),
      t({ id: 'over', deadline: '2026-11-10' }),
      t({ id: 'today', deadline: '2026-11-13' }),
      t({ id: 'done', deadline: '2026-11-12', status: 'done' }),
    ], now);
    expect(snap.rows.map((r) => r.id)).toEqual(['over', 'today', 'later', 'none']);
    expect(snap.header).toBe('ZADANIA · 4 · 1 ZALEGŁE');
  });
  test('etykiety i kolory', () => {
    const snap = buildWidgetSnapshot([t({ id: 'over', deadline: '2026-11-10' }), t({ id: 'today', deadline: '2026-11-13T18:00:00' })], now);
    expect(snap.rows[0]).toMatchObject({ overdue: true, color: '#EF4444' });
    expect(snap.rows[0].sub).not.toMatch(/Zaległe/);
    expect(snap.rows[1]).toMatchObject({ sub: 'Dziś · 18:00', overdue: false, color: '#F2F2F2' });
  });
  test('maks. 6 wierszy, pusty stan', () => {
    expect(buildWidgetSnapshot(Array.from({ length: 9 }, () => t({})), now).rows).toHaveLength(6);
    expect(buildWidgetSnapshot([], now)).toEqual({ header: 'ZADANIA', rows: [] });
  });
});
