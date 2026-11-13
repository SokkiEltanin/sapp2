// 2026-11-13 — synchronizacja między urządzeniami na udawanym Firestore (w pamięci):
// scalenie przy starcie, wysyłka zmian lokalnych, odbiór zmian "z drugiego
// urządzenia", usunięcia jako znaczniki, brak echa własnych zapisów, restart
// przyrostowy (zmiany offline), dokumenty pojedyncze (zdrowie: pusty nie kasuje).
const mockDb = new Map<string, any>();
const mockListeners = new Map<string, ((snap: any) => void)[]>();
const mockWrites: string[] = [];
let mockNow = 1000;
const isDocPath = (p: string) => p.includes('/sync_docs/');
const mockColSnap = (col: string, changes: { id: string; type: string; data: any }[]) => ({
  docs: [...mockDb.entries()].filter(([k]) => k.startsWith(`${col}/`)).map(([k, v]) => ({ id: k.slice(col.length + 1), data: () => v })),
  docChanges: () => changes.map((c) => ({ type: c.type, doc: { id: c.id, data: () => c.data, metadata: { hasPendingWrites: false } } })),
});
const mockDocSnap = (path: string) => ({ exists: () => mockDb.has(path), data: () => mockDb.get(path), metadata: { hasPendingWrites: false } });
const mockStore = (ref: string, d: any) => {
  const v = JSON.parse(JSON.stringify(d));
  if (d._s) { const at = ++mockNow; v._s = { toMillis: () => at }; }
  mockWrites.push(ref);
  mockDb.set(ref, v);
};
jest.mock('@/firebase', () => ({ db: {}, auth: {} }));
jest.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...p: string[]) => p.join('/'),
  doc: (_db: unknown, ...p: string[]) => p.join('/'),
  query: (c: string) => c,
  where: () => null,
  Timestamp: { fromMillis: (ms: number) => ({ ms }) },
  serverTimestamp: () => ({ sentinel: true }),
  onSnapshot: (path: string, cb: (s: any) => void) => {
    mockListeners.set(path, [...(mockListeners.get(path) ?? []), cb]);
    setTimeout(() => {
      if (isDocPath(path)) cb(mockDocSnap(path));
      else {
        // Realny Firestore: pierwszy snapshot zapytania = wszystkie pasujące jako 'added'.
        const all = [...mockDb.entries()].filter(([k]) => k.startsWith(`${path}/`)).map(([k, v]) => ({ id: k.slice(path.length + 1), type: 'added', data: v }));
        cb(mockColSnap(path, all));
      }
    }, 0);
    return () => mockListeners.set(path, (mockListeners.get(path) ?? []).filter((x) => x !== cb));
  },
  setDoc: async (ref: string, data: any) => mockStore(ref, data),
  // Własne zapisy: w realnym Firestore wracają najpierw z hasPendingWrites: true
  // (pomijane), potem jako potwierdzone — to drugie odtwarzamy niżej.
  writeBatch: () => {
    const ops: [string, any][] = [];
    return {
      set: (ref: string, data: any) => ops.push([ref, data]),
      commit: async () => {
        for (const [r, d] of ops) mockStore(r, d);
        // Potwierdzony zapis wraca do słuchaczy kolekcji (hasPendingWrites: false).
        setTimeout(() => {
          for (const [r] of ops) {
            const i = r.lastIndexOf('/'); const path = r.slice(0, i); const id = r.slice(i + 1);
            for (const cb of mockListeners.get(path) ?? []) cb(mockColSnap(path, [{ id, type: 'modified', data: mockDb.get(r) }]));
          }
        }, 0);
      },
    };
  },
}));

// eslint-disable-next-line import/first
import AsyncStorage from '@react-native-async-storage/async-storage';
// eslint-disable-next-line import/first
import { startCloudSync, stopCloudSync } from '@/services/cloudSync';
// eslint-disable-next-line import/first
import { useCalendarStore } from '@/store/calendarStore';
// eslint-disable-next-line import/first
import { useExpensesStore } from '@/store/expensesStore';
// eslint-disable-next-line import/first
import { useHealthStore } from '@/store/healthStore';

const col = 'users/u1/sync_tasks';
const remoteWrite = (path: string, id: string, data: any) => {
  mockDb.set(`${path}/${id}`, data);
  for (const cb of mockListeners.get(path) ?? []) cb(mockColSnap(path, [{ id, type: 'modified', data }]));
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const task = (id: string, title: string, updatedAt = '2026-11-13T10:00:00Z') => ({ id, title, status: 'pending' as const, priority: 'normal' as const, tags: [], createdAt: updatedAt, updatedAt });

beforeEach(async () => {
  mockDb.clear(); mockListeners.clear(); mockWrites.length = 0;
  await AsyncStorage.clear();
  useCalendarStore.setState({ tasks: [], events: [] });
  useExpensesStore.setState({ expenses: [] });
  useHealthStore.setState({ today: null, history: {}, manualWeights: [], lastSyncedAt: null });
});
afterEach(() => stopCloudSync());

test('pełna podróż: scalenie, wysyłka, odbiór, usunięcie', async () => {
  useCalendarStore.setState({ tasks: [task('a', 'lokalne')], events: [] });
  mockDb.set(`${col}/b`, { title: 'z chmury', status: 'pending', priority: 'normal', tags: [], createdAt: 'x', updatedAt: '2026-11-13T09:00:00Z', _u: 1 });

  await startCloudSync('u1');
  await wait(200);
  expect(useCalendarStore.getState().tasks.map((t) => t.id).sort()).toEqual(['a', 'b']);
  expect(mockDb.get(`${col}/a`)).toMatchObject({ title: 'lokalne' });
  expect(typeof mockDb.get(`${col}/a`)._u).toBe('number');

  useCalendarStore.getState().updateTask('a', { status: 'done' });
  await wait(800);
  expect(mockDb.get(`${col}/a`).status).toBe('done');

  remoteWrite(col, 'c', { title: 'z komputera', status: 'pending', priority: 'normal', tags: [], createdAt: 'y', updatedAt: '2026-11-13T11:00:00Z', _u: Date.now() });
  expect(useCalendarStore.getState().tasks.find((t) => t.id === 'c')?.title).toBe('z komputera');

  useCalendarStore.getState().deleteTask('b');
  await wait(800);
  expect(mockDb.get(`${col}/b`)).toMatchObject({ _deleted: true });

  remoteWrite(col, 'c', { _deleted: true, _u: Date.now() });
  expect(useCalendarStore.getState().tasks.map((t) => t.id)).toEqual(['a']);
});

test('wydatki: restart przyrostowy wysyła tylko zmiany zrobione offline', async () => {
  const ecol = 'users/u1/sync_expenses';
  const e = (id: string, amount: number) => ({ id, type: 'expense', amount, date: '2026-11-13', note: id, tags: [], source: 'manual', createdAt: 'x', updatedAt: '2026-11-13T10:00:00Z' });
  useExpensesStore.setState({ expenses: [e('e1', 10), e('e2', 20)] as any });
  await startCloudSync('u1');
  await wait(300);
  expect(mockDb.get(`${ecol}/e1`)).toMatchObject({ amount: 10 });
  await wait(1700); // zapis stanu (skróty + znacznik)
  stopCloudSync();

  // offline: edycja e1, usunięcie e2, nowy e3
  useExpensesStore.getState().updateExpense('e1', { amount: 11 });
  useExpensesStore.setState({ expenses: [...useExpensesStore.getState().expenses.filter((x) => x.id !== 'e2'), e('e3', 30)] as any });
  mockWrites.length = 0;

  await startCloudSync('u1');
  await wait(400);
  expect(mockDb.get(`${ecol}/e1`).amount).toBe(11);
  expect(mockDb.get(`${ecol}/e2`)).toMatchObject({ _deleted: true });
  expect(mockDb.get(`${ecol}/e3`).amount).toBe(30);
  expect(mockWrites.filter((w) => w.startsWith(ecol)).sort()).toEqual([`${ecol}/e1`, `${ecol}/e2`, `${ecol}/e3`]); // nic poza zmianami
});

test('zdrowie: telefon wysyła, pusty komputer nie kasuje, a pobiera', async () => {
  const hpath = 'users/u1/sync_docs/health';
  const day = { date: '2026-11-13', steps: 5000, sleepMinutes: 420 } as any;
  useHealthStore.setState({ today: day, history: {}, manualWeights: [], lastSyncedAt: '2026-11-13T08:00:00Z' });
  await startCloudSync('u1');
  await wait(100);
  expect(mockDb.get(hpath)).toMatchObject({ today: { steps: 5000 } });
  stopCloudSync();

  // "Komputer": pusty stan, brak lokalnej historii synchronizacji
  await AsyncStorage.clear();
  useHealthStore.setState({ today: null, history: {}, manualWeights: [], lastSyncedAt: null });
  await startCloudSync('u1');
  await wait(100);
  expect(useHealthStore.getState().today?.steps).toBe(5000);
  expect(mockDb.get(hpath).today.steps).toBe(5000);
});
