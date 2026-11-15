import { pickSleepSource } from '@/utils/sleepStats';

const src = (min: number, staged = 0) => ({ min, deep: staged, rem: 0, light: 0, awake: 0 });

describe('pickSleepSource', () => {
  it('brak danych → null', () => {
    expect(pickSleepSource([])).toBeNull();
    expect(pickSleepSource([src(0)])).toBeNull();
  });
  it('zegarek z fazami wygrywa z dłuższą sesją telefonu bez faz', () => {
    const watch = src(480, 90);
    const phone = src(567);
    expect(pickSleepSource([phone, watch])).toBe(watch);
  });
  it('krótka drzemka z fazami nie wypiera całej nocy', () => {
    const nap = src(40, 10);
    const night = src(480);
    expect(pickSleepSource([nap, night])).toBe(night);
  });
  it('bez faz → najdłuższa', () => {
    const a = src(300), b = src(420);
    expect(pickSleepSource([a, b])).toBe(b);
  });
});
