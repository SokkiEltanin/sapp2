import { normalizeOrder, moveSection, visibleSections, migrateLayoutV1, DEFAULT_ORDER, DEFAULT_HIDDEN } from '@/utils/dashboardLayout';

describe('układ Dashboardu', () => {
  it('naprawia kolejność: duplikaty, nieznane, brakujące na końcu', () => {
    expect(normalizeOrder(['note', 'note', 'xyz', 'top'])).toEqual(['note', 'top', 'factWeather', 'screen', 'upcoming', 'food']);
    expect(normalizeOrder(null)).toEqual(DEFAULT_ORDER);
  });
  it('przesuwanie w górę/dół z granicami', () => {
    expect(moveSection(DEFAULT_ORDER, 'screen', -1)).toEqual(['top', 'screen', 'factWeather', 'note', 'upcoming', 'food']);
    expect(moveSection(DEFAULT_ORDER, 'top', -1)).toBe(DEFAULT_ORDER);
    expect(moveSection(DEFAULT_ORDER, 'food', 1)).toBe(DEFAULT_ORDER);
  });
  it('widoczne bez ukrytych; jedzenie domyślnie ukryte', () => {
    expect(visibleSections(DEFAULT_ORDER, ['screen', 'factWeather'])).toEqual(['top', 'note', 'upcoming', 'food']);
    expect(visibleSections(DEFAULT_ORDER, DEFAULT_HIDDEN)).toEqual(['top', 'factWeather', 'screen', 'note', 'upcoming']);
  });
  it('stary układ: czas z telefonem na miejsce jedzenia, jedzenie ukryte, reszta jak u usera', () => {
    expect(migrateLayoutV1({ order: ['note', 'food', 'top', 'factWeather', 'upcoming'], hidden: ['upcoming'] }))
      .toEqual({ order: ['note', 'screen', 'food', 'top', 'factWeather', 'upcoming'], hidden: ['upcoming', 'food'] });
    expect(migrateLayoutV1({})).toEqual({ order: DEFAULT_ORDER, hidden: ['food'] });
  });
});
