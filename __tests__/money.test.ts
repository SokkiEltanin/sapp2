import { money, zl, round2 } from '../src/utils/money';

describe('money', () => {
  it('zawsze dwa miejsca po przecinku', () => {
    expect(money(45.32)).toBe('45,32');
    expect(money(40)).toBe('40,00');
    expect(money(0.385)).toBe('0,39');
    expect(zl(1.1)).toBe('1,10 zł');
  });
  it('odstęp tysięcy dopiero od 10 000', () => {
    expect(money(1441.37)).toBe('1441,37');
    expect(money(12345.678)).toBe('12 345,68');
    expect(money(1234567)).toBe('1 234 567,00');
  });
  it('minus i śmieci', () => {
    expect(money(-3.5)).toBe('−3,50');
    expect(money(NaN)).toBe('0,00');
    expect(money(-0.001)).toBe('0,00');
  });
  it('round2', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(36.4749)).toBe(36.47);
  });
});
