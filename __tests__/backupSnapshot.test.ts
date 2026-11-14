import { shouldBackupKey, chunkString, summarizeSnapshot, isBackupDue } from '@/utils/backupSnapshot';

// 2026-11-11 — dane sapp2 żyły tylko w AsyncStorage telefonu; kopia w chmurze.
describe('shouldBackupKey', () => {
  test('dane appki tak, sesja Firebase i własne klucze kopii nie', () => {
    expect(shouldBackupKey('expenses-store-v1')).toBe(true);
    expect(shouldBackupKey('merchant_memory_v1')).toBe(true);
    expect(shouldBackupKey('firebase:authUser:abc:[DEFAULT]')).toBe(false);
    expect(shouldBackupKey('cloud_backup_last_at')).toBe(false);
  });
});

describe('chunkString', () => {
  test('dzieli na kawałki max N znaków i składa się z powrotem 1:1', () => {
    const s = 'ąę'.repeat(5) + 'x';
    const parts = chunkString(s, 4);
    expect(parts.every((p) => p.length <= 4)).toBe(true);
    expect(parts.join('')).toBe(s);
  });
  test('pusty tekst → jeden pusty kawałek (meta zawsze ma ≥1 chunk)', () => {
    expect(chunkString('', 4)).toEqual(['']);
  });
});

describe('summarizeSnapshot', () => {
  test('liczy wpisy ze store\'ów, odporne na brak/zepsuty JSON', () => {
    const entries = {
      'expenses-store-v1': JSON.stringify({ state: { expenses: [{}, {}, {}] } }),
      'mood-store-v1': JSON.stringify({ state: { entries: [{}] } }),
      'calendar-store-v1': '{zepsute',
    };
    expect(summarizeSnapshot(entries)).toEqual({ expenses: 3, mood: 1, tasks: 0, subscriptions: 0, vehicles: 0 });
  });
});

describe('isBackupDue', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  test('nigdy nie było → tak', () => { expect(isBackupDue(null, now, 6)).toBe(true); });
  test('5h temu przy progu 6h → nie, 7h temu → tak', () => {
    expect(isBackupDue('2026-11-11T07:00:00Z', now, 6)).toBe(false);
    expect(isBackupDue('2026-11-11T05:00:00Z', now, 6)).toBe(true);
  });
});

describe('kopia do pliku', () => {
  const { backupFileName, buildBackupFile, parseBackupFile, filesToPrune } = require('@/utils/backupSnapshot');

  it('nazwa pliku sortuje się po dacie', () => {
    expect(backupFileName(new Date(2026, 10, 4, 9, 5))).toBe('sapp2-kopia-2026-11-04-0905.json');
  });

  it('zapis → odczyt, bez kluczy per urządzenie', () => {
    const txt = buildBackupFile({ 'expenses-store-v1': '{"state":{"expenses":[1,2]}}', 'cloud_backup_local_dir': 'x' }, new Date('2026-11-14T10:00:00Z'));
    const r = parseBackupFile(txt);
    expect(r.createdAt).toBe('2026-11-14T10:00:00.000Z');
    expect(Object.keys(r.entries)).toEqual(['expenses-store-v1']);
  });

  it('zły plik = czytelny błąd', () => {
    expect(() => parseBackupFile('nie json')).toThrow('zły JSON');
    expect(() => parseBackupFile('{"a":1}')).toThrow('brak danych');
    expect(() => parseBackupFile('{"entries":{}}')).toThrow('pusty');
  });

  it('zostają 4 najnowsze, cudze pliki nietknięte', () => {
    const names = ['sapp2-kopia-2026-10-01-1200.json', 'sapp2-kopia-2026-10-08-1200.json', 'notatki.txt',
      'sapp2-kopia-2026-10-15-1200.json', 'sapp2-kopia-2026-10-22-1200.json', 'sapp2-kopia-2026-10-29-1200.json'];
    expect(filesToPrune(names)).toEqual(['sapp2-kopia-2026-10-01-1200.json']);
  });
});
