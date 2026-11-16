import { tagColorMap, tagColor } from '@/utils/taskTags';

describe('kolory tagów zadań', () => {
  const events = [
    { title: '[PUR] W - Cięcie', color: '#4C8DF6' },
    { title: '[PUR] Seminarium', color: '#4C8DF6' },
    { title: '[pur] inne', color: '#FF0000' },
    { title: '[JD] 09:00', color: '#EAB308' },
    { title: 'Badania', color: '#DC2626' },
  ];
  test('kolor z kalendarza (większość), wielkość liter bez znaczenia', () => {
    const m = tagColorMap(events);
    expect(tagColor('PUR', m)).toBe('#4C8DF6');
    expect(tagColor('#jd', m)).toBe('#EAB308');
  });
  test('bez dopasowania — stały kolor z palety', () => {
    expect(tagColor('UR')).toBe(tagColor('ur'));
    expect(tagColor('UR')).toMatch(/^#[0-9A-F]{6}$/);
  });
});
