import type { Expense } from '@/types/finances';
import type { Note } from '@/types/notes';
import type { Task } from '@/types/calendar';
import type { Subscription } from '@/types/subscriptions';
import type { ReplaceItem } from '@/types/replacements';
import type { Vehicle } from '@/types/vehicles';
import { normText } from './categoryRules';
import { noteTitle } from './notes';

// Wyszukiwanie w całej appce (2026-11-14, z listy "czego brakuje"): jedno pole —
// wydatki (sklep, opis, pozycje paragonu, kwota), notatki, zadania, stałe opłaty,
// wymiany, pojazdy. Czysta funkcja (__tests__/globalSearch.test.ts), ekran app/search.tsx.
export type HitKind = 'expense' | 'note' | 'task' | 'subscription' | 'replacement' | 'vehicle';
export interface SearchHit { kind: HitKind; id: string; title: string; sub: string; date?: string; amount?: number }
export interface SearchData {
  expenses: Expense[]; notes: Note[]; tasks: Task[]; subscriptions: Subscription[]; replacements: ReplaceItem[]; vehicles: Vehicle[];
}

const words = (q: string) => normText(q).split(' ').filter(Boolean);
const matches = (hay: string, ws: string[]) => { const h = normText(hay); return ws.every((w) => h.includes(w)); };
const amountQuery = (q: string) => { const m = /^(\d+(?:[.,]\d{1,2})?)\s*(zł|zl)?$/i.exec(q.trim()); return m ? Number(m[1].replace(',', '.')) : null; };

export function globalSearch(d: SearchData, q: string, perKind = 30): Record<HitKind, SearchHit[]> & { total: number } {
  const ws = words(q);
  const out = { expense: [], note: [], task: [], subscription: [], replacement: [], vehicle: [], total: 0 } as Record<HitKind, SearchHit[]> & { total: number };
  if (!ws.length || normText(q).length < 2) return out;
  const amt = amountQuery(q);

  const exp = d.expenses
    .filter((e) => {
      if (amt != null && Math.abs(e.amount - amt) < 0.005) return true;
      const items = (e.receiptItems ?? []).map((i) => i.name).join(' ');
      return matches(`${e.storeName ?? ''} ${e.note} ${e.tags.join(' ')} ${items}`, ws);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  out.expense = exp.slice(0, perKind).map((e) => {
    const item = (e.receiptItems ?? []).find((i) => matches(i.name, ws));
    return {
      kind: 'expense', id: e.id, date: e.date, amount: e.type === 'income' ? e.amount : -e.amount,
      title: e.storeName || e.note || (e.type === 'income' ? 'Przychód' : 'Wydatek'),
      sub: item ? `pozycja: ${item.name}` : e.storeName && e.note ? e.note : '',
    };
  });

  out.note = d.notes.filter((n) => matches(`${n.title} ${n.text} ${n.items.map((i) => i.text).join(' ')}`, ws))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, perKind)
    .map((n) => ({ kind: 'note', id: n.id, title: noteTitle(n), sub: n.kind === 'list' ? 'lista' : n.kind === 'drawing' ? 'rysunek' : n.text.replace(/\s+/g, ' ').slice(0, 80) }));

  out.task = d.tasks.filter((t) => t.status !== 'deleted' && matches(`${t.title} ${t.description ?? ''} ${t.tags.join(' ')} ${(t.subtasks ?? []).map((x) => x.title).join(' ')}`, ws))
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || b.updatedAt.localeCompare(a.updatedAt)).slice(0, perKind)
    .map((t) => ({ kind: 'task', id: t.id, title: t.title, sub: [t.status === 'done' ? 'zrobione' : t.deadline ? `termin ${t.deadline.slice(0, 10)}` : 'bez terminu', ...(t.subtasks?.length ? [`kroki ${t.subtasks.filter((x) => x.done).length}/${t.subtasks.length}`] : []), ...t.tags.map((x) => `#${x}`)].join(' · ') }));

  out.subscription = d.subscriptions.filter((s) => matches(`${s.name} ${(s.tags ?? []).join(' ')}`, ws) || (amt != null && Math.abs(s.amount - amt) < 0.005)).slice(0, perKind)
    .map((s) => ({ kind: 'subscription', id: s.id, title: s.name, sub: `${s.active ? 'następna' : 'wstrzymana'} · ${s.nextBillingDate}`, amount: -s.amount }));

  out.replacement = d.replacements.filter((r) => matches(r.name, ws)).slice(0, perKind)
    .map((r) => ({ kind: 'replacement', id: r.id, title: r.name, sub: `ostatnio ${r.lastDate}` }));

  out.vehicle = d.vehicles.filter((v) => matches(`${v.name} ${v.tag}`, ws)).slice(0, perKind)
    .map((v) => ({ kind: 'vehicle', id: v.id, title: v.name, sub: 'pojazd' }));

  out.total = out.expense.length + out.note.length + out.task.length + out.subscription.length + out.replacement.length + out.vehicle.length;
  return out;
}
