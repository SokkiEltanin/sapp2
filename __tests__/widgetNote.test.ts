import { buildNoteWidgetSnapshot } from '@/utils/widgetNote';

const N = (x: any) => ({ id: 'n', kind: 'text', title: '', text: '', items: [], strokes: [], pinned: true, createdAt: '', updatedAt: '', ...x });

describe('widget notatki', () => {
  it('brak przypiętej', () => {
    expect(buildNoteWidgetSnapshot(null)).toMatchObject({ id: null, kind: 'none' });
  });
  it('lista: nieodhaczone pierwsze, licznik, limit wierszy', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: String(i), text: `p${i}`, done: i < 3 }));
    const s = buildNoteWidgetSnapshot(N({ kind: 'list', title: 'Zakupy', items }));
    expect(s.title).toBe('ZAKUPY · 7/10');
    expect(s.rows).toHaveLength(8);
    expect(s.rows[0]).toEqual({ text: 'p3', done: false });
    expect(s.rows[7].done).toBe(true);
    expect(s.more).toBe(2);
  });
  it('tekst skrócony, tytuł z pierwszej linii', () => {
    const s = buildNoteWidgetSnapshot(N({ text: 'Pierwsza linia\n\n\n\nDruga' }));
    expect(s.title).toBe('PIERWSZA LINIA');
    expect(s.text).toBe('Pierwsza linia\n\nDruga');
  });
});
