import { ageOn, nextBirthday, bmi, bmiLabel } from '@/utils/profile';

describe('profil', () => {
  const now = new Date(2026, 10, 17);
  it('wiek', () => {
    expect(ageOn('2000-11-17', now)).toBe(26);
    expect(ageOn('2000-11-18', now)).toBe(25);
    expect(ageOn('zly', now)).toBeNull();
  });
  it('najbliższe urodziny', () => {
    expect(nextBirthday('2000-11-17', now)).toEqual({ date: '2026-11-17', days: 0, turns: 26 });
    expect(nextBirthday('2000-11-20', now)).toEqual({ date: '2026-11-20', days: 3, turns: 26 });
    expect(nextBirthday('2000-01-05', now)).toEqual({ date: '2027-01-05', days: 49, turns: 27 });
    expect(nextBirthday('2000-02-29', new Date(2027, 1, 1))!.date).toBe('2027-02-28');
  });
  it('BMI', () => {
    expect(bmi(80, 180)).toBe(24.7);
    expect(bmiLabel(24.7)).toBe('w normie');
    expect(bmi(80, null)).toBeNull();
  });
});
