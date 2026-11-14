import { filterBankHistory } from '@/utils/bankHistoryFilter';

const H = (id: string, x: any) => ({ id, at: 0, store: id, storeKey: id, amount: 10, currency: 'PLN', direction: 'out', tags: [], auto: false, ...x });
const rows: any[] = [
  H('Biedronka', { auto: true, tags: ['jedzenie'] }),
  H('Orlen', { amount: 250.5 }),
  H('Żabka', { flagReason: 'duża kwota' }),
  H('Pracodawca', { direction: 'in', amount: 5000 }),
  H('Lidl', { auto: true, undone: true }),
];
const ids = (q: string, st: any = 'all') => filterBankHistory(rows, q, st).map((h) => h.id);

describe('historia płatności z banku', () => {
  it('statusy', () => {
    expect(ids('', 'auto')).toEqual(['Biedronka']);
    expect(ids('', 'manual')).toEqual(['Orlen', 'Żabka', 'Pracodawca']);
    expect(ids('', 'flagged')).toEqual(['Żabka']);
    expect(ids('', 'undone')).toEqual(['Lidl']);
    expect(ids('', 'in')).toEqual(['Pracodawca']);
  });
  it('tekst, tag, kwota', () => {
    expect(ids('zabka')).toEqual(['Żabka']);
    expect(ids('jedzenie')).toEqual(['Biedronka']);
    expect(ids('250,50')).toEqual(['Orlen']);
  });
});
