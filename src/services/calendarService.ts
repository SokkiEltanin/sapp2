import { addDoc, updateDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { userCol, userDoc } from '@/utils/userData';
import { withTimeout } from '@/firebase';
import type { CalendarEvent, Task } from '@/types/calendar';

// Port z sapp (src/services/calendarService.ts), 1:1 logika — jedyna różnica:
// `userCol`/`userDoc` tutaj są SYNCHRONICZNE (sapp2 nie ma anonimowego
// auto-logowania do wyczekania, patrz src/utils/userData.ts), więc bez `await`
// przed nimi (w sapp były `async` bo czekały na `whenAuthReady()`).
const EVENTS_COL = 'events';
const TASKS_COL = 'tasks';

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const calendarService = {
  async getAllEvents(): Promise<CalendarEvent[]> {
    const q = query(userCol(EVENTS_COL), orderBy('date', 'asc'));
    const snap = await withTimeout(getDocs(q));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CalendarEvent));
  },

  async addEvent(event: Omit<CalendarEvent, 'id' | 'createdAt'>): Promise<CalendarEvent> {
    const now = new Date().toISOString();
    const ref = await withTimeout(addDoc(userCol(EVENTS_COL), strip({ ...event, createdAt: now })));
    return { ...event, id: ref.id, createdAt: now };
  },

  async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<void> {
    await withTimeout(updateDoc(userDoc(EVENTS_COL, id), strip(updates)));
  },

  async deleteEvent(id: string): Promise<void> {
    await withTimeout(deleteDoc(userDoc(EVENTS_COL, id)));
  },
};

export const tasksService = {
  async getAllTasks(): Promise<Task[]> {
    const q = query(userCol(TASKS_COL), orderBy('createdAt', 'desc'));
    const snap = await withTimeout(getDocs(q));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
  },

  async addTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const now = new Date().toISOString();
    const ref = await withTimeout(addDoc(userCol(TASKS_COL), strip({ ...task, createdAt: now, updatedAt: now })));
    return { ...task, id: ref.id, createdAt: now, updatedAt: now };
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    await withTimeout(updateDoc(userDoc(TASKS_COL, id), strip({ ...updates, updatedAt: new Date().toISOString() })));
  },

  async deleteTask(id: string): Promise<void> {
    await withTimeout(deleteDoc(userDoc(TASKS_COL, id)));
  },
};
