import { addDoc, updateDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { userCol, userDoc } from '@/utils/userData';
import { withTimeout } from '@/firebase';
import type { Expense } from '@/types/finances';

// Finanse — Faza 2.1, ten sam wzorzec co `calendarService.ts` (Firestore CRUD,
// `userCol`/`userDoc` synchroniczne — sapp2 nie czeka na anonimowe logowanie jak
// sapp). Wołane RĘCZNIE (np. diagnostyka w Ustawieniach, tak jak "Sync kalendarza"),
// NIE automatycznie przy każdym CRUD w `expensesStore` — offline-first jest
// domyślnym trybem, zgodnie z ustaleniem z userem (2026-10-31).
const EXPENSES_COL = 'expenses';

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const expensesService = {
  async getAllExpenses(): Promise<Expense[]> {
    const q = query(userCol(EXPENSES_COL), orderBy('date', 'desc'));
    const snap = await withTimeout(getDocs(q));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
  },

  async addExpense(expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> {
    const now = new Date().toISOString();
    const ref = await withTimeout(addDoc(userCol(EXPENSES_COL), strip({ ...expense, createdAt: now, updatedAt: now })));
    return { ...expense, id: ref.id, createdAt: now, updatedAt: now };
  },

  async updateExpense(id: string, updates: Partial<Expense>): Promise<void> {
    await withTimeout(updateDoc(userDoc(EXPENSES_COL, id), strip({ ...updates, updatedAt: new Date().toISOString() })));
  },

  async deleteExpense(id: string): Promise<void> {
    await withTimeout(deleteDoc(userDoc(EXPENSES_COL, id)));
  },
};
