import { appHealth, healthSummary, type HealthInput } from '@/utils/appHealth';

const now = Date.parse('2026-11-14T12:00:00Z');
const base: HealthInput = {
  sync: { state: 'ok', lastAt: now - 60_000, error: null },
  cloudBackup: { auto: true, lastAt: '2026-11-14T06:00:00Z' },
  fileBackup: { dir: 'content://x', lastAt: '2026-11-10T06:00:00Z' },
  errorTimes: [],
  update: { otaReady: false, apkBuild: null, lastError: null },
  bankPending: 0,
  web: false,
};

describe('stan appki', () => {
  it('wszystko OK', () => {
    const r = appHealth(base, now);
    expect(r.every((x) => x.level === 'ok')).toBe(true);
    expect(healthSummary(r)).toBe('wszystko działa');
  });

  it('problemy z podpowiedzią, co zrobić', () => {
    const r = appHealth({
      ...base,
      sync: { state: 'error', lastAt: null, error: 'permission-denied' },
      cloudBackup: { auto: true, lastAt: null },
      fileBackup: { dir: null, lastAt: null },
      errorTimes: [now - 1000, now - 2000, now - 2 * 86_400_000],
      update: { otaReady: false, apkBuild: 210, lastError: null },
      bankPending: 3,
    }, now);
    const by = Object.fromEntries(r.map((x) => [x.key, x]));
    expect(by.sync.level).toBe('bad');
    expect(by.cloud).toMatchObject({ level: 'bad', fix: 'Dane → Zrób kopię teraz' });
    expect(by.file.level).toBe('warn');
    expect(by.errors).toMatchObject({ level: 'warn', detail: '2' });
    expect(by.update.detail).toBe('nowy APK #210');
    expect(by.bank.detail).toBe('3 czeka');
    expect(healthSummary(r)).toBe('2 do naprawy · 4 do uwagi');
  });

  it('web: bez kopii do pliku', () => {
    expect(appHealth({ ...base, web: true }, now).some((x) => x.key === 'file')).toBe(false);
  });
});
