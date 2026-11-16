import { billTagFor, looksLikeBill } from '@/utils/recurringBills';

const tag = (e: { note?: string; storeName?: string; tags?: string[] }) => billTagFor(e)?.tag ?? null;

describe('rozpoznawanie rachunków (prąd, internet)', () => {
  it('prąd po tagach i nazwie, nawet z tagiem "mieszkanie" z importu', () => {
    expect(tag({ tags: ['pge'] })).toBe('prąd');
    expect(tag({ tags: ['PGE'] })).toBe('prąd');
    expect(tag({ tags: ['Prąd'] })).toBe('prąd');
    expect(tag({ tags: ['prad'] })).toBe('prąd');
    expect(tag({ tags: ['PGE', 'mieszkanie'] })).toBe('prąd');
    expect(tag({ storeName: 'PGE Obrót S.A.' })).toBe('prąd');
    expect(tag({ note: 'Pge, faktura' })).toBe('prąd');
  });
  it('internet: play / PLAY / internet, ale nie Google Play ani PlayStation', () => {
    expect(tag({ tags: ['play'] })).toBe('internet');
    expect(tag({ tags: ['PLAY', 'mieszkanie'] })).toBe('internet');
    expect(tag({ storeName: 'P4 Sp. z o.o. Play' })).toBe('internet');
    expect(tag({ tags: ['Internet'] })).toBe('internet');
    expect(tag({ storeName: 'Google Play' })).toBeNull();
    expect(tag({ storeName: 'PlayStation Store' })).toBeNull();
  });
  it('czynsz dalej działa, krótkie słowa tylko jako całe słowo', () => {
    expect(tag({ tags: ['mieszkanie'] })).toBe('czynsz');
    expect(tag({ note: 'czynsz listopad' })).toBe('czynsz');
    expect(looksLikeBill('gazeta wyborcza')).toBe(false);
    expect(tag({ note: 'rachunek gaz luty' })).toBe('gaz');
  });
});
