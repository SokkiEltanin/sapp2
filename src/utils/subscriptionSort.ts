import type { Subscription } from '@/types/subscriptions';

// Stałe opłaty — sortowanie i koszt w przeliczeniu (2026-11-14, z listy "czego brakuje").
export type SubSort = 'date' | 'price' | 'name';
export const SUB_SORTS: [SubSort, string][] = [['date', 'Termin'], ['price', 'Koszt / mies.'], ['name', 'Nazwa']];

/** Koszt miesięczny (tydzień ×4,33, kwartał /3, rok /12). */
export function monthlyCost(s: Pick<Subscription, 'amount' | 'billingCycle'>): number {
  const f = s.billingCycle === 'weekly' ? 4.33 : s.billingCycle === 'quarterly' ? 1 / 3 : s.billingCycle === 'yearly' ? 1 / 12 : 1;
  return s.amount * f;
}

export function sortSubscriptions(subs: Subscription[], mode: SubSort): Subscription[] {
  const out = [...subs];
  if (mode === 'price') return out.sort((a, b) => monthlyCost(b) - monthlyCost(a) || a.name.localeCompare(b.name, 'pl'));
  if (mode === 'name') return out.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  return out.sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));
}
