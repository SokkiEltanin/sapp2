import { normalizeOrder, moveSection, visibleSections, DEFAULT_ORDER } from '@/utils/dashboardLayout';

describe('układ Dashboardu', () => {
  it('naprawia kolejność: duplikaty, nieznane, brakujące na końcu', () => {
    expect(normalizeOrder(['note', 'note', 'xyz', 'top'])).toEqual(['note', 'top', 'factWeather', 'food', 'upcoming']);
    expect(normalizeOrder(null)).toEqual(DEFAULT_ORDER);
  });
  it('przesuwanie w górę/dół z granicami', () => {
    expect(moveSection(DEFAULT_ORDER, 'food', -1)).toEqual(['top', 'food', 'factWeather', 'note', 'upcoming']);
    expect(moveSection(DEFAULT_ORDER, 'top', -1)).toBe(DEFAULT_ORDER);
    expect(moveSection(DEFAULT_ORDER, 'upcoming', 1)).toBe(DEFAULT_ORDER);
  });
  it('widoczne bez ukrytych', () => {
    expect(visibleSections(DEFAULT_ORDER, ['food', 'factWeather'])).toEqual(['top', 'note', 'upcoming']);
  });
});
