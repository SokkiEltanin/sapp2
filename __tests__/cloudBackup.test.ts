import AsyncStorage from '@react-native-async-storage/async-storage';

// 2026-11-11 — kopia w chmurze: pełna podróż kopia → zmiana danych → przywrócenie,
// na udawanym Firestore (w pamięci). Sprawdza kawałkowanie dużych danych,
// sprzątanie starych kawałków, nietykanie sesji Firebase i przeładowanie store'u.
const mockDb = new Map<string, any>();
jest.mock('@/utils/userData', () => ({ userDoc: (col: string, id: string) => `${col}/${id}`, userCol: (c: string) => c }));
jest.mock('@/firebase', () => ({ withTimeout: (p: Promise<unknown>) => p, db: {}, auth: {} }));
jest.mock('firebase/firestore', () => ({
  getDoc: async (ref: string) => ({ exists: () => mockDb.has(ref), data: () => mockDb.get(ref) }),
  setDoc: async (ref: string, data: unknown) => { mockDb.set(ref, JSON.parse(JSON.stringify(data))); },
  deleteDoc: async (ref: string) => { mockDb.delete(ref); },
}));
const mockFiles = new Map<string, string>();
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  writeAsStringAsync: async (path: string, data: string) => { mockFiles.set(path, data); },
}));

// eslint-disable-next-line import/first
import { uploadBackup, restoreBackup, fetchBackupMeta } from '@/services/cloudBackup';
// eslint-disable-next-line import/first
import { useExpensesStore } from '@/store/expensesStore';

const exp = (id: string, note = '') => ({ id, type: 'expense', amount: 10, date: '2026-11-01', note, tags: [], source: 'manual', createdAt: '', updatedAt: '' });

beforeEach(async () => {
  mockDb.clear();
  mockFiles.clear();
  await AsyncStorage.clear();
});

test('kopia → zmiana lokalnie → przywrócenie oddaje stan z kopii i przeładowuje store', async () => {
  // Duża notatka → JSON > 300k znaków → kilka kawałków.
  const big = 'x'.repeat(700_000);
  await AsyncStorage.setItem('expenses-store-v1', JSON.stringify({ state: { expenses: [exp('a', big), exp('b')] }, version: 0 }));
  await AsyncStorage.setItem('merchant_memory_v1', '{"lidl":{"tags":["spożywcze"]}}');
  await AsyncStorage.setItem('firebase:authUser:k:[DEFAULT]', 'SESJA-TELEFONU');

  const meta = await uploadBackup();
  expect(meta.chunkCount).toBeGreaterThanOrEqual(3);
  expect(meta.summary.expenses).toBe(2);
  expect((await fetchBackupMeta())?.backupId).toBe(meta.backupId);

  // Zmiany po kopii: usunięty wydatek, inna sesja Firebase.
  await AsyncStorage.setItem('expenses-store-v1', JSON.stringify({ state: { expenses: [exp('c')] }, version: 0 }));
  await AsyncStorage.setItem('firebase:authUser:k:[DEFAULT]', 'NOWA-SESJA');

  await restoreBackup();
  expect(useExpensesStore.getState().expenses.map((e) => e.id)).toEqual(['a', 'b']);
  expect(await AsyncStorage.getItem('merchant_memory_v1')).toContain('lidl');
  // Sesja logowania NIE nadpisana starą z kopii.
  expect(await AsyncStorage.getItem('firebase:authUser:k:[DEFAULT]')).toBe('NOWA-SESJA');
  // Stan sprzed przywrócenia zapisany do pliku.
  const saved = JSON.parse(mockFiles.get('file:///docs/sapp2-przed-przywroceniem.json') ?? '{}');
  expect(JSON.parse(saved.entries['expenses-store-v1']).state.expenses.map((e: { id: string }) => e.id)).toEqual(['c']);
});

test('kolejna kopia sprząta kawałki poprzedniej', async () => {
  await AsyncStorage.setItem('expenses-store-v1', JSON.stringify({ state: { expenses: [exp('a')] }, version: 0 }));
  const first = await uploadBackup();
  await new Promise((r) => setTimeout(r, 5));
  const second = await uploadBackup();
  expect(second.backupId).not.toBe(first.backupId);
  expect([...mockDb.keys()].some((k) => k.includes(first.backupId))).toBe(false);
  expect(mockDb.has(`backup/${second.backupId}_0`)).toBe(true);
});

test('brak kopii → przywrócenie rzuca błąd i niczego nie zmienia', async () => {
  await AsyncStorage.setItem('expenses-store-v1', 'LOKALNE');
  await expect(restoreBackup()).rejects.toThrow('Brak kopii');
  expect(await AsyncStorage.getItem('expenses-store-v1')).toBe('LOKALNE');
});
