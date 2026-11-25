const mockMem = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockMem.get(k) ?? null,
    setItem: async (k: string, v: string) => { mockMem.set(k, v); },
    removeItem: async (k: string) => { mockMem.delete(k); },
    multiGet: async (ks: string[]) => ks.map((k) => [k, mockMem.get(k) ?? null]),
    multiSet: async (ps: [string, string][]) => { for (const [k, v] of ps) mockMem.set(k, v); },
    multiRemove: async (ks: string[]) => { for (const k of ks) mockMem.delete(k); },
    getAllKeys: async () => [...mockMem.keys()],
  },
}));
import { safeStorage, readLogical, writeLogical, storageUsage } from '@/services/safeStorage';
import { CHUNK_CHARS } from '@/utils/storageChunks';

describe('pamięć odporna na duże wartości', () => {
  beforeEach(() => mockMem.clear());
  it('mała wartość bez zmian, duża w kawałkach, odczyt skleja', async () => {
    await safeStorage.setItem('a', 'x');
    expect(mockMem.get('a')).toBe('x');
    const big = 'ą'.repeat(CHUNK_CHARS * 2 + 5);
    await safeStorage.setItem('notes', big);
    expect(mockMem.get('notes')).toBe('__chunks__:3');
    expect(mockMem.get('notes__c2')!.length).toBe(5);
    expect(await safeStorage.getItem('notes')).toBe(big);
  });
  it('zmniejszenie usuwa stare kawałki; usunięcie czyści wszystko', async () => {
    await safeStorage.setItem('n', 'y'.repeat(CHUNK_CHARS * 3));
    await safeStorage.setItem('n', 'y'.repeat(CHUNK_CHARS + 1));
    expect(mockMem.has('n__c2')).toBe(false);
    await safeStorage.setItem('n', 'małe');
    expect([...mockMem.keys()]).toEqual(['n']);
    await safeStorage.removeItem('n');
    expect(mockMem.size).toBe(0);
  });
  it('brak kawałka = błąd (nie pusty stan, który nadpisałby dane)', async () => {
    mockMem.set('k', '__chunks__:2'); mockMem.set('k__c0', 'a');
    await expect(safeStorage.getItem('k')).rejects.toThrow();
  });
  it('kopie: odczyt logiczny skleja i pomija kawałki; zapis dzieli', async () => {
    await writeLogical([['big', 'z'.repeat(CHUNK_CHARS + 10)], ['s', '1']]);
    const all = await readLogical(() => true);
    expect(Object.keys(all).sort()).toEqual(['big', 's']);
    expect(all.big.length).toBe(CHUNK_CHARS + 10);
    const u = await storageUsage();
    expect(u.biggest[0]).toEqual({ key: 'big', size: CHUNK_CHARS + 10 + '__chunks__:2'.length });
  });
});
