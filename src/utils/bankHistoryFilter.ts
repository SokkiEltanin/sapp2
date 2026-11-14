import type { BankIngestHistoryEntry } from '@/store/bankQueueStore';
import { normText } from './categoryRules';

// Szukanie i filtr w historii płatności z banku (2026-11-14, z listy "czego brakuje").
export type BankHistStatus = 'all' | 'auto' | 'manual' | 'flagged' | 'undone' | 'in';
export const BANK_HIST_STATUSES: [BankHistStatus, string][] = [
  ['all', 'Wszystkie'], ['auto', 'Automat'], ['manual', 'Zatwierdzone ręcznie'], ['flagged', 'Do sprawdzenia'], ['in', 'Wpływy'], ['undone', 'Cofnięte'],
];

export function filterBankHistory(rows: BankIngestHistoryEntry[], q: string, status: BankHistStatus): BankIngestHistoryEntry[] {
  const ws = normText(q).split(' ').filter(Boolean);
  const amt = /^\d+([.,]\d{1,2})?$/.test(q.trim()) ? Number(q.trim().replace(',', '.')) : null;
  return rows.filter((h) => {
    if (status === 'auto' && (!h.auto || h.undone)) return false;
    if (status === 'manual' && (h.auto || h.undone)) return false;
    if (status === 'flagged' && !h.flagReason) return false;
    if (status === 'undone' && !h.undone) return false;
    if (status === 'in' && h.direction !== 'in') return false;
    if (!ws.length) return true;
    if (amt != null && Math.abs(h.amount - amt) < 0.005) return true;
    const hay = normText(`${h.store} ${h.tags.join(' ')} ${h.flagReason ?? ''}`);
    return ws.every((w) => hay.includes(w));
  });
}
