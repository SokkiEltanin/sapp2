// 2026-11-13 — synchronizacja między urządzeniami na udawanym Firestore (w pamięci):
// scalenie przy starcie, wysyłka zmian lokalnych, odbiór zmian "z drugiego
// urządzenia", usunięcia jako znaczniki, brak echa własnych zapisów.
const mockDb = new Map<string, any>();
const mockListeners = new Map<string, ((snap: any) => void)[]>();
const mockSnap = (col: string, changes: { id: string; type: string; data: any }[]) => ({
  docs: [...mockDb.entries()].filter(([k]) => k.startsWith(`${col}/`)).map(([k, v]) => ({ id: k.slice(col.length + 1), data: () => v })),
  docChanges: () => changes.map((c) => ({ type: c.type, doc: { id: c.id, data: () => c.data, metadata: { hasPendingWrites: false } } })),
});
jest.mock('@/firebase', () => ({ db: {}, auth: {} }));
jest.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...p: string[]) => p.join('/'),
  doc: (_db: unknown, ...p: string[]) => p.join('/'),
  onSnapshot: (col: string, cb: (s: any) => void) => {
    mockListeners.set(col, [...(mockListeners.get(col) ?? []), cb]);
    setTimeout(() => cb(mockSnap(col, [])), 0);
    return () => mockListeners.set(col, (mockListeners.get(col) ?? []).filter((x) => x !== cb));
  },
  // Własne zapisy NIE wracają do słuchaczy (w realnym Firestore wracają z
  // hasPendingWrites: true i są pomijane).
  writeBatch: () => {
    const ops: [string, any][] = [];
    return { set: (ref: string, data: any) => ops.push([ref, data]), commit: async () => { for (const [r, d] of ops) mockDb.set(r, JSON.parse(JSON.stringify(d))); } };
  },
}));

// eslint-disable-next-line import/first
import { startCloudSync, stopCloudSync } from '@/services/cloudSync';
// eslint-disable-next-line import/first
import { useCalendarStore } from '@/store/calendarStore';

const col = 'users/u1/sync_tasks';
const remoteWrite = (id: string, data: any) => {
  mockDb.set(`${col}/${id}`, data);
  for (const cb of mockListeners.get(col) ?? []) cb(mockSnap(col, [{ id, type: 'modified', data }]));
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const task = (id: string, title: string, updatedAt = '2026-11-13T10:00:00Z') => ({ id, title, status: 'pending' as const, priority: 'normal' as const, tags: [], createdAt: updatedAt, updatedAt });

afterEach(() => stopCloudSync());

test('pełna podróż: scalenie, wysyłka, odbiór, usunięcie', async () => {
  useCalendarStore.setState({ tasks: [task('a', 'lokalne')], events: [] });
  mockDb.set(`${col}/b`, { title: 'z chmury', status: 'pending', priority: 'normal', tags: [], createdAt: 'x', updatedAt: '2026-11-13T09:00:00Z', _u: 1 });

  await startCloudSync('u1');
  await wait(200);
  // scalenie: b przyszło z chmury, a poszło do chmury
  expect(useCalendarStore.getState().tasks.map((t) => t.id).sort()).toEqual(['a', 'b']);
  expect(mockDb.get(`${col}/a`)).toMatchObject({ title: 'lokalne' });
  expect(typeof mockDb.get(`${col}/a`)._u).toBe('number');

  // zmiana lokalna → po chwili w chmurze
  useCalendarStore.getState().updateTask('a', { status: 'done' });
  await wait(800);
  expect(mockDb.get(`${col}/a`).status).toBe('done');

  // zmiana z innego urządzenia → w store
  remoteWrite('c', { title: 'z komputera', status: 'pending', priority: 'normal', tags: [], createdAt: 'y', updatedAt: '2026-11-13T11:00:00Z', _u: Date.now() });
  expect(useCalendarStore.getState().tasks.find((t) => t.id === 'c')?.title).toBe('z komputera');

  // usunięcie lokalne → znacznik w chmurze (inne urządzenie go zobaczy)
  useCalendarStore.getState().deleteTask('b');
  await wait(800);
  expect(mockDb.get(`${col}/b`)).toMatchObject({ _deleted: true });

  // usunięcie z innego urządzenia → znika lokalnie
  remoteWrite('c', { _deleted: true, _u: Date.now() });
  expect(useCalendarStore.getState().tasks.map((t) => t.id)).toEqual(['a']);
});
