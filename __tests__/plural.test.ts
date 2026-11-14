import { plural, nWydatkow } from '@/utils/plural';

it('odmiana', () => {
  expect([1, 2, 4, 5, 12, 13, 22, 25, 101, 0].map(nWydatkow)).toEqual([
    '1 wydatek', '2 wydatki', '4 wydatki', '5 wydatków', '12 wydatków', '13 wydatków', '22 wydatki', '25 wydatków', '101 wydatków', '0 wydatków',
  ]);
  expect(plural(3, 'reguła', 'reguły', 'reguł')).toBe('reguły');
});
