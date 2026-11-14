import { employerShortName, nextEmployerName } from '@/utils/employerName';

describe('nazwy pracodawców w pigułkach', () => {
  it('bez formy prawnej, bez krzyczących wielkich liter', () => {
    expect(employerShortName('ACME POLSKA SP. Z O.O.')).toBe('Acme Polska');
    expect(employerShortName('Żabka Polska sp. z o.o.')).toBe('Żabka Polska');
    expect(employerShortName('ORLEN S.A.')).toBe('ORLEN');
    expect(employerShortName('IKEA')).toBe('IKEA');
  });
  it('długie skracane', () => {
    expect(employerShortName('Przedsiębiorstwo Usługowo Handlowe Kowalski i Synowie')).toMatch(/…$/);
  });
  it('kolejne nazwy bez duplikatów', () => {
    expect(nextEmployerName([])).toBe('Pracodawca');
    expect(nextEmployerName(['Pracodawca', 'Pracodawca 2'])).toBe('Pracodawca 3');
  });
});
