import { guardianDecide, guardianText } from '@/utils/guardian';
import { appHealth, usualGapDays } from '@/utils/appHealth';

const DAY = 86_400_000;
const T = Date.parse('2026-11-25T12:00:00Z');
const row = (key: string, level: 'ok' | 'warn' | 'bad', detail = 'x') => ({ key, label: key, level, detail });

describe('strażnik', () => {
  it('zgłasza dopiero po 2 dniach trwania i nie częściej niż co 3 dni', () => {
    let st = { since: {}, notified: {} };
    let r = guardianDecide([row('bankCapture', 'warn')], st, T);
    expect(r.notify).toEqual([]);
    r = guardianDecide([row('bankCapture', 'warn')], r.next, T + 2 * DAY);
    expect(r.notify.map((x) => x.key)).toEqual(['bankCapture']);
    r = guardianDecide([row('bankCapture', 'warn')], r.next, T + 3 * DAY);
    expect(r.notify).toEqual([]);
    r = guardianDecide([row('bankCapture', 'warn')], r.next, T + 5 * DAY);
    expect(r.notify.length).toBe(1);
    r = guardianDecide([row('bankCapture', 'ok')], r.next, T + 6 * DAY);
    expect(r.next).toEqual({ since: {}, notified: {} });
  });
  it('pomija rzeczy spoza listy i świadome wyłączenia', () => {
    const r = guardianDecide([row('update', 'warn'), row('sync', 'warn', 'wyłączona'), row('errors', 'bad')], { since: { update: 0 }, notified: {} }, T);
    expect(r.notify).toEqual([]);
  });
  it('treść: jedno zdanie na problem', () => {
    expect(guardianText([{ key: 'b', label: 'Bank łapie płatności', level: 'warn', detail: 'nic od 5 dni', fix: 'sprawdź' }])).toEqual({ title: 'SOEN: coś wymaga uwagi', body: 'Bank łapie płatności: nic od 5 dni — sprawdź' });
  });
});

describe('stan appki: nowe kontrole', () => {
  const base = { sync: { state: 'ok' as const, lastAt: T, error: null }, cloudBackup: { auto: true, lastAt: new Date(T).toISOString() }, fileBackup: { dir: 'x', lastAt: new Date(T).toISOString() }, errorTimes: [], update: { otaReady: false, apkBuild: null, lastError: null }, bankPending: 0, web: false };
  it('bank milczy dłużej niż zwykle → uwaga', () => {
    const times = Array.from({ length: 10 }, (_, i) => T - 10 * DAY + i * DAY / 2);
    expect(usualGapDays(times)).toBeCloseTo(0.5);
    const ok = appHealth({ ...base, bank: { enabled: true, times } }, T).find((r) => r.key === 'bankCapture')!;
    expect(ok.level).toBe('warn'); // ostatni 5,5 dnia temu, limit max(4, 0,5×4)=4 dni
    const fresh = appHealth({ ...base, bank: { enabled: true, times: [...times, T - DAY] } }, T).find((r) => r.key === 'bankCapture')!;
    expect(fresh.level).toBe('ok');
  });
  it('tło stoi, pamięć na komputerze się kończy', () => {
    const rows = appHealth({ ...base, background: { interval: 60, lastRun: T - 3 * DAY }, storage: { total: 4_000_000, biggest: [{ key: 'notes-v1', size: 2_500_000 }] }, web: false }, T);
    expect(rows.find((r) => r.key === 'background')!.level).toBe('warn');
    expect(rows.find((r) => r.key === 'storage')!.detail).toBe('4,0 MB · najwięcej: notatki 2,5 MB');
    const web = appHealth({ ...base, storage: { total: 4_000_000, biggest: [] }, web: true }, T);
    expect(web.find((r) => r.key === 'storage')!.level).toBe('warn');
  });
});
