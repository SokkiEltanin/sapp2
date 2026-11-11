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
