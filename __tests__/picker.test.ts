import { monthGrid, dayAllowed, openPicker, resolvePicker, usePicker } from '@/services/picker';

describe('picker', () => {
  test('listopad 2026 zaczyna się w niedzielę → 6 pustych pól', () => {
    const g = monthGrid(2026, 10);
    expect(g[0]).toEqual([null, null, null, null, null, null, 1]);
    expect(g.flat().filter(Boolean)).toHaveLength(30);
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
  test('min/max po dniu, nie po godzinie', () => {
    const max = new Date(2026, 10, 15, 8);
    expect(dayAllowed(new Date(2026, 10, 15, 23), undefined, max)).toBe(true);
    expect(dayAllowed(new Date(2026, 10, 16, 0), undefined, max)).toBe(false);
  });
  test('łańcuch: onChange może otworzyć kolejny picker', () => {
    const got: string[] = [];
    openPicker({ value: new Date(), mode: 'date', onChange: (e) => { got.push(e.type); openPicker({ value: new Date(), mode: 'time' }); } });
    resolvePicker(new Date());
    expect(got).toEqual(['set']);
    expect(usePicker.getState().req?.mode).toBe('time');
    resolvePicker(null);
    expect(usePicker.getState().req).toBeNull();
  });
});
