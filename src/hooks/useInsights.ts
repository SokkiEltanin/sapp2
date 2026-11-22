import { useMemo } from 'react';
import { useMoodStore } from '@/store/moodStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useWorkStore } from '@/store/workStore';
import { useScreenTimeStore } from '@/store/screenTimeStore';
import { useAppCategoryStore } from '@/store/appCategoryStore';
import { useGoodThingsStore } from '@/store/goodThingsStore';
import { dailyMood } from '@/utils/moodStats';
import { fvSplitOf } from '@/utils/fixedVariable';
import { foodSplitOf } from '@/utils/foodStats';
import { isWorkEvent, shiftMinutes } from '@/utils/workEvents';
import { funMinutes, nightMinutes, dayStarts, ymd } from '@/utils/screenTime';
import { buildDays, computeInsights, coverage, type FeatInput } from '@/utils/insights';
import { todayISO } from '@/utils/date';

// Wzorce zachowań (2026-11-22) — dane z całej appki → utils/insights.ts. Ostatnie 90 dni bez
// dzisiejszego (niepełny dzień zaniżałby wydatki/pracę/telefon).
export function useInsights() {
  const mood = useMoodStore((st) => st.entries);
  const healthLog = useCollectionStore((st) => st.healthLog);
  const expenses = useExpensesStore((st) => st.expenses);
  const events = useCalendarStore((st) => st.events);
  const gcal = useCalendarStore((st) => st.gcalEvents);
  const employers = useWorkStore((st) => st.employers);
  const screenDays = useScreenTimeStore((st) => st.days);
  const cats = useAppCategoryStore((st) => st.cats);
  const fun = useAppCategoryStore((st) => st.fun);
  const good = useGoodThingsStore((st) => st.items);
  const today = todayISO();

  return useMemo(() => {
    const now = new Date(`${today}T12:00:00`);
    const days = dayStarts(now, 91).slice(0, -1).map((s) => ymd(new Date(s)));

    const spendBy = new Map<string, { total: number; sweets: number; fastfood: number; shop: number }>();
    let spendFrom: string | null = null;
    for (const e of expenses) {
      if (e.type !== 'expense' || !e.date) continue;
      const d = e.date.slice(0, 10);
      const fv = fvSplitOf(e);
      if (fv.food + fv.variable <= 0) continue;
      if (!spendFrom || d < spendFrom) spendFrom = d;
      const f = foodSplitOf(e);
      const a = spendBy.get(d) ?? { total: 0, sweets: 0, fastfood: 0, shop: 0 };
      a.total += fv.food + fv.variable;
      a.sweets += (f.get('słodycze') ?? 0) + (f.get('przekąski') ?? 0);
      a.fastfood += f.get('fast food') ?? 0;
      a.shop += fv.variable;
      spendBy.set(d, a);
    }

    const workBy = new Map<string, number>();
    let workFrom: string | null = null;
    const emps = employers.filter((x) => !x.hidden && x.workMode !== 'manual' && (x.workColor || x.workPrefix));
    if (emps.length) {
      for (const ev of [...events, ...gcal]) {
        if (!ev.date || !emps.some((emp) => isWorkEvent(ev, emp))) continue;
        const d = ev.date.slice(0, 10);
        if (!workFrom || d < workFrom) workFrom = d;
        workBy.set(d, (workBy.get(d) ?? 0) + shiftMinutes(ev));
      }
    }

    const prefs = { cats, fun };
    const screen: FeatInput['screen'] = {};
    for (const [d, x] of Object.entries(screenDays)) screen[d] = { total: x.total, fun: funMinutes(x, prefs), unlocks: x.unlocks, night: nightMinutes(x) };

    const goodDates = new Set(good.filter((g) => g.text.trim()).map((g) => g.date));
    const goodFrom = [...goodDates].sort()[0] ?? null;

    const feats = buildDays({
      days,
      mood: dailyMood(mood),
      health: healthLog,
      spend: { from: spendFrom, byDay: spendBy },
      workMin: { from: workFrom, byDay: workBy },
      screen,
      good: { from: goodFrom, dates: goodDates },
    });
    return { insights: computeInsights(feats), coverage: coverage(feats), days: feats.length };
  }, [mood, healthLog, expenses, events, gcal, employers, screenDays, cats, fun, good, today]);
}
