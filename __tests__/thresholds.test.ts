import { applyThresholds, DEFAULT_THRESHOLDS } from '@/utils/thresholds';
import { looksLikeFuel } from '@/utils/vehicleMatch';
import { budgetStatus } from '@/utils/budgets';
import { planBillReminders } from '@/utils/billReminders';

describe('progi z Ustawień', () => {
  afterEach(() => applyThresholds(DEFAULT_THRESHOLDS));

  it('przycinanie do rozsądnych zakresów', () => {
    expect(applyThresholds({ fuelMin: -5, budgetWarnPct: 120, reminderHour: 3, watchBatteryPct: 90 })).toEqual({ fuelMin: 0, budgetWarnPct: 99, reminderHour: 5, watchBatteryPct: 50 });
    expect(applyThresholds({ fuelMin: 'x' as any })).toEqual(DEFAULT_THRESHOLDS);
  });

  it('próg paliwa: batonik na stacji', () => {
    const e: any = { id: 'a', type: 'expense', amount: 40, storeName: 'ORLEN Stacja', note: '', tags: [], date: '2026-11-10' };
    expect(looksLikeFuel(e)).toBe(true);
    applyThresholds({ fuelMin: 50 });
    expect(looksLikeFuel(e)).toBe(false);
  });

  it('próg ostrzeżenia budżetu', () => {
    const b: any = { id: 'b', scope: 'all', limit: 100, createdAt: '', updatedAt: '' };
    const ex: any[] = [{ id: 'x', type: 'expense', amount: 75, date: '2026-11-03', note: '', tags: [], fvOverride: 'variable' }];
    const now = new Date(2026, 10, 14);
    expect(budgetStatus(b, ex, now).level).not.toBe('warn');
    applyThresholds({ budgetWarnPct: 70 });
    expect(budgetStatus(b, ex, now).level).toBe('warn');
  });

  it('godzina przypomnień', () => {
    applyThresholds({ reminderHour: 18 });
    const subs: any[] = [{ id: 's', name: 'Internet', amount: 60, nextBillingDate: '2026-11-20', reminderDaysBefore: 2, active: true, billingCycle: 'monthly' }];
    const plan = planBillReminders(subs, new Date(2026, 10, 14));
    expect(plan.length).toBeGreaterThan(0);
    expect(new Date(plan[0].fireAt).getHours()).toBe(18);
  });
});
