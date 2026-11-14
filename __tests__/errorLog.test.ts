import { pushEntry, formatErrorLog, errorText, ERROR_LOG_MAX } from '@/utils/errorLog';

describe('dziennik błędów', () => {
  it('ten sam błąd zaraz po poprzednim = licznik', () => {
    let l = pushEntry([], { t: 1000, where: 'sync', msg: 'offline' });
    l = pushEntry(l, { t: 2000, where: 'sync', msg: 'offline' });
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ n: 2, t: 2000 });
    l = pushEntry(l, { t: 3000, where: 'widget', msg: 'x' });
    expect(l.map((e) => e.where)).toEqual(['widget', 'sync']);
  });

  it('limit wpisów', () => {
    let l: any[] = [];
    for (let i = 0; i < ERROR_LOG_MAX + 20; i++) l = pushEntry(l, { t: i * 1e9, where: 'a', msg: String(i) });
    expect(l).toHaveLength(ERROR_LOG_MAX);
    expect(l[0].msg).toBe(String(ERROR_LOG_MAX + 19));
  });

  it('tekst błędu i eksport', () => {
    expect(errorText(new TypeError('boom')).msg).toBe('TypeError: boom');
    expect(errorText({ code: 1 }).msg).toBe('{"code":1}');
    const txt = formatErrorLog([{ t: Date.UTC(2026, 10, 14, 12), where: 'sync', msg: 'offline', n: 3 }], 'sapp2 build 200');
    expect(txt).toContain('sapp2 build 200');
    expect(txt).toContain('sync ×3: offline');
  });
});
