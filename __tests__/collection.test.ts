import { buildMonthCards } from '@/utils/monthCards';
import { computeRecords, bestRecord, RECORD_DEFS } from '@/utils/records';
import type { Expense } from '@/types/finances';

const E = (date: string, amount: number, extra: Partial<Expense> = {}): Expense => ({ id: date + amount + Math.random(), type: 'expense', amount, date, note: '', tags: [], source: 'manual', createdAt: '', updatedAt: '', ...extra } as unknown as Expense);
const NOW = new Date(2026, 10, 17);

describe('karty miesięcy', () => {
  const ex = [
    E('2026-08-05', 1000), E('2026-09-05', 800), E('2026-10-05', 600), E('2026-10-20', 2000, { storeName: 'PGE', note: 'prąd' } as any),
    E('2026-10-01', 5000, { type: 'income' } as any), E('2026-11-03', 99),
    E('2026-10-15', 500, { fvOverride: 'transfer' } as any),
  ];
  const log = { '2026-10-01': [10000, 420], '2026-10-02': [20000, 480] } as any;
  const cards = buildMonthCards(ex, log, NOW);
  it('tylko zakończone miesiące, najnowsza pierwsza, bez przelewów własnych', () => {
    expect(cards.map((c) => c.key)).toEqual(['2026-10', '2026-09', '2026-08']);
    const oct = cards[0];
    expect(oct.spent).toBe(2600);
    expect(oct.prad).toBe(2000);
    expect(oct.balance).toBe(2400);
    expect(oct.steps).toBe(15000);
    expect(oct.sleepMin).toBe(450);
    expect(oct.biggest?.name).toBe('PGE');
  });
  it('odznaki przy ≥3 kartach', () => {
    expect(cards.find((c) => c.key === '2026-09')!.badges).toContain('Najtańszy miesiąc');
    expect(cards[0].badges).toContain('Najdroższy miesiąc');
  });
  it('rekordy: kroki z dziennika, ręczny wpis wygrywa dopóki dane go nie pobiją', () => {
    const r = computeRecords(ex, log, [], cards, NOW);
    expect(r.steps).toEqual({ value: 20000, date: '2026-10-02' });
    expect(r.bigExpense!.value).toBe(2000);
    expect(r.cheapMonth!.value).toBe(800);
    const def = RECORD_DEFS.find((d) => d.key === 'steps')!;
    expect(bestRecord(def, r.steps, { value: 43000, date: '2025-06-01' })!.source).toBe('manual');
    expect(bestRecord(def, { value: 50000, date: '2026-11-01' }, { value: 43000, date: '2025-06-01' })!.source).toBe('data');
  });
});
