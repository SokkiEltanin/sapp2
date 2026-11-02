import { useEffect, useMemo, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { DashboardScreen, type DashData } from '@/ui/DashboardScreen';
import { Cap, Tag, splitTag } from '@/ui/layout';
import { T, S, R, C, F } from '@/ui/theme';
import WydatkiModal from '@/components/dashboard/WydatkiModal';
import HabitsModal from '@/components/dashboard/HabitsModal';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { colors } from '@/theme/colors';
import { useCalendarStore } from '@/store/calendarStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useHabitsStore } from '@/store/habitsStore';
import { useHealthStore } from '@/store/healthStore';
import { useHealthSync } from '@/hooks/useHealthSync';
import { todayISO } from '@/utils/date';
import { foodByMonth, foodDailyAverageThisMonth } from '@/utils/foodStats';
import { habitStreak } from '@/utils/habitStreak';
import { useWydatkiData } from '@/hooks/useWydatkiData';
import { getBalanceOffset, accountBalance, affectsBalance } from '@/utils/balance';
import type { CalendarEvent } from '@/types/calendar';
import type { HabitKey } from '@/types/habits';

// Faza 3.11 (2026-11-02, user: "zrób tę apkę w pełni funkcjonalną") — Woda/
// Słodycze/Trening DOSTAŁY realny store (`habitsStore.ts`/`utils/habitStreak.ts`/
// `HabitsModal.tsx`).
// Faza 3.12 (2026-11-02, user: "masz w sapp jak były połączenia z health czemu
// nie możesz tego zrobić na podstawie jak tam") — Sen DOSTAŁ realny Health
// Connect (port z sapp, `src/services/healthConnectService.ts`), ten sam
// store'owy wzorzec co nawyki: `useHealthSync()` odświeża cache w tle (cicho,
// bez promptu — zgoda przyznawana TYLKO z przycisku w Ustawieniach),
// `useHealthStore` czyta ostatni snapshot. Bez zegarka/braku zgody →
// `sleep: null`, kit renderuje zaprojektowany stan pusty.
// - Kalendarz/jedzenie/transakcje/saldo/48h — bez zmian, te same store'y/hooki.
const FACTS = [
  'Mózg zużywa jedną piątą energii twojego organizmu',
  'Grafen jest ok. 200× wytrzymalszy od stali przy tej samej masie',
  'Atom złota ma średnicę ok. 0,3 nm',
  'GaAs przewodzi elektrony ok. 6× szybciej niż krzem',
];

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

function eventStart(e: CalendarEvent): Date | null {
  if (!e.startTime) return null;
  const dayKey = (e.date || '').slice(0, 10);
  const [h, mi] = e.startTime.split(':').map(Number);
  const d = new Date(`${dayKey}T00:00:00`);
  d.setHours(h, mi, 0, 0);
  return d;
}
function eventEnd(e: CalendarEvent, start: Date): Date {
  if (!e.endTime) return start;
  const [h, mi] = e.endTime.split(':').map(Number);
  const d = new Date(start);
  d.setHours(h, mi, 0, 0);
  return d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// "Dziś 14:30" / "Jutro" / "Śr 09:15" — ten sam format co design/app-design.html's
// `whenTxt`/timeline (sekcja "DASHBOARD: 48h", `DN=['Dziś','Jutro','Wt']`), tylko
// uogólniony na realne daty zamiast mockowych indeksów dni.
function whenLabel(d: Date, now: Date): string {
  const dayDiff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000);
  const dayLabel = dayDiff === 0 ? 'Dziś' : dayDiff === 1 ? 'Jutro' : d.toLocaleDateString('pl-PL', { weekday: 'short' });
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  return `${dayLabel} ${time}`;
}

export default function Dashboard() {
  const [wydatkiOpen, setWydatkiOpen] = useState(false);
  const [wydatkiTab, setWydatkiTab] = useState<'food' | 'fixed' | 'variable'>('food');
  const [factIndex, setFactIndex] = useState<number | null>(null);
  const [nextOpen, setNextOpen] = useState(false);
  const [habitsOpen, setHabitsOpen] = useState(false);
  const [habitsFocus, setHabitsFocus] = useState<HabitKey | undefined>();
  const [offset, setOffset] = useState(0);
  const calendarTasks = useCalendarStore((st) => st.tasks);
  const calendarEvents = useCalendarStore((st) => st.events);
  const gcalEvents = useCalendarStore((st) => st.gcalEvents);
  const setSelectedDate = useCalendarStore((st) => st.setSelectedDate);
  const expenses = useExpensesStore((st) => st.expenses);
  const habitDays = useHabitsStore((st) => st.days);
  const healthToday = useHealthStore((st) => st.today);
  useHealthSync();
  const today = todayISO();
  const now = useMemo(() => new Date(), [today]);

  useEffect(() => { getBalanceOffset().then(setOffset); }, []);
  useEffect(() => { setFactIndex(dayOfYear(now) % FACTS.length); }, [now]);

  const dailyFoodAvg = useMemo(() => foodDailyAverageThisMonth(expenses, now), [expenses, now]);
  const wydatkiData = useWydatkiData(expenses, now);
  const foodMonths = useMemo(() => foodByMonth(expenses, 4, now), [expenses, now]);

  const allEvents = useMemo(() => [...calendarEvents, ...gcalEvents], [calendarEvents, gcalEvents]);

  const upcomingEvent = useMemo(() => {
    const list = allEvents
      .map((e) => {
        const start = eventStart(e);
        if (!start) return null;
        const end = e.endTime ? eventEnd(e, start) : start;
        return { e, start, end };
      })
      .filter((x): x is { e: CalendarEvent; start: Date; end: Date } => !!x && x.end.getTime() > now.getTime())
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    return list[0] ?? null;
  }, [allEvents, now]);

  const balance = useMemo(() => accountBalance(expenses, offset), [expenses, offset]);
  const daysLeftInMonth = useMemo(() => {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Math.max(1, lastDay - now.getDate() + 1);
  }, [now]);
  const todaySpend = useMemo(
    () => expenses
      .filter((e) => e.type === 'expense' && affectsBalance(e) && e.date.slice(0, 10) === today)
      .reduce((a, e) => a + e.amount, 0),
    [expenses, today],
  );

  const recentExpenses = useMemo(
    () => [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [expenses],
  );

  type TimelineEntry = { key: string; at: Date; title: string; color: string; kind: 'event' | 'deadline'; minutes?: number };
  const timeline48h = useMemo<TimelineEntry[]>(() => {
    const limit = new Date(now.getTime() + 48 * 3600000);
    const out: TimelineEntry[] = [];
    for (const e of allEvents) {
      const start = eventStart(e);
      if (!start || start < now || start > limit) continue;
      out.push({ key: `e_${e.id}`, at: start, title: e.title, color: e.color || colors.ui.in2, kind: 'event', minutes: Math.round((start.getTime() - now.getTime()) / 60000) });
    }
    for (const t of calendarTasks) {
      if (t.status !== 'pending' || !t.deadline) continue;
      const at = new Date(t.deadline);
      if (at < now || at > limit) continue;
      out.push({ key: `t_${t.id}`, at, title: t.title, color: colors.accent.red, kind: 'deadline' });
    }
    return out.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [allEvents, calendarTasks, now]);

  const streaks = useMemo(() => ({
    water: habitStreak(habitDays, 'water', today),
    sweets: habitStreak(habitDays, 'sweets', today),
    training: habitStreak(habitDays, 'training', today),
  }), [habitDays, today]);

  const sleep = useMemo(() => {
    if (!healthToday || healthToday.sleepMinutes == null || !healthToday.sleepFrom || !healthToday.sleepTo) return null;
    const phases: { kind: 'deep' | 'light' | 'rem' | 'awake'; min: number }[] = [
      { kind: 'deep' as const, min: healthToday.sleepDeepMin ?? 0 },
      { kind: 'light' as const, min: healthToday.sleepLightMin ?? 0 },
      { kind: 'rem' as const, min: healthToday.sleepRemMin ?? 0 },
      { kind: 'awake' as const, min: healthToday.sleepAwakeMin ?? 0 },
    ].filter((p) => p.min > 0);
    return { minutes: healthToday.sleepMinutes, from: healthToday.sleepFrom, to: healthToday.sleepTo, phases };
  }, [healthToday]);

  const data: DashData = {
    streaks,
    next: upcomingEvent ? { title: upcomingEvent.e.title, start: upcomingEvent.start } : null,
    fact: FACTS[factIndex ?? 0],
    sleep,
    foodPerDay: dailyFoodAvg,
    foodMonths: foodMonths.map((m) => ({ label: m.label, value: m.value })),
    transactions: recentExpenses.map((e) => ({
      id: e.id,
      name: e.note || e.storeName || (e.type === 'income' ? 'Przychód' : 'Płatność'),
      amount: e.type === 'income' ? e.amount : -e.amount,
    })),
    safe: { balance, unpaidDue: 0, daysLeft: daysLeftInMonth, spentToday: todaySpend },
    next48: timeline48h.map((x) => ({
      id: x.key,
      when: whenLabel(x.at, now),
      title: x.title,
      kind: x.kind,
      color: x.color,
      minutes: x.minutes,
    })),
    onOpen: (what, id) => {
      if (what === 'fact') setFactIndex((i) => ((i ?? 0) + 1) % FACTS.length);
      else if (what === 'foodDay' || what === 'foodMonth') { setWydatkiTab('food'); setWydatkiOpen(true); }
      else if (what === 'tx' || what === 'safe') { setWydatkiTab('variable'); setWydatkiOpen(true); }
      else if (what === 'next' && upcomingEvent) setNextOpen(true);
      else if (what === 'streak') { setHabitsFocus(id as HabitKey | undefined); setHabitsOpen(true); }
      // sleep/next48 — jeszcze bez docelowego popupu (Health Connect
      // nieistniejący / szczegół wydarzenia na 48h), świadomie bez akcji na razie.
    },
  };

  const nextTag = upcomingEvent ? splitTag(upcomingEvent.e.title) : null;
  const openNextInTasks = () => {
    if (!upcomingEvent) return;
    setNextOpen(false);
    setSelectedDate(upcomingEvent.e.date.slice(0, 10));
    router.push('/tasks');
  };

  return (
    <>
      <DashboardScreen {...data} />
      <WydatkiModal
        visible={wydatkiOpen}
        onClose={() => setWydatkiOpen(false)}
        month={wydatkiData.month}
        initialTab={wydatkiTab}
        food={wydatkiData.food}
        fixed={wydatkiData.fixed}
        variable={wydatkiData.variable}
      />
      <HabitsModal visible={habitsOpen} onClose={() => setHabitsOpen(false)} focusKey={habitsFocus} />
      <AppBottomSheet visible={nextOpen} onClose={() => setNextOpen(false)} scrollable={false}>
        {upcomingEvent && nextTag ? (
          <View style={ns.card}>
            <Cap l="Najbliższe wydarzenie" />
            <View style={ns.titleRow}>
              {nextTag.tag ? <Tag label={nextTag.tag} kind={nextTag.tag === 'PUR' || nextTag.tag === 'UR' ? 'ur' : 'default'} /> : null}
              <Text style={[T.rowHi, ns.title]} numberOfLines={2}>{nextTag.title}</Text>
            </View>
            <Text style={T.small}>
              {upcomingEvent.start.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}
              {upcomingEvent.start.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
              {upcomingEvent.e.endTime ? ` – ${upcomingEvent.e.endTime}` : ''}
            </Text>
            <TouchableOpacity onPress={openNextInTasks} style={ns.btn}>
              <Text style={ns.btnLabel}>Otwórz w Zadaniach</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </AppBottomSheet>
    </>
  );
}

const ns = StyleSheet.create({
  card: { gap: S.gap },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: S.gap, flexWrap: 'wrap' },
  title: { flex: 1 },
  btn: { marginTop: S.gap, height: 48, borderRadius: R.btn, backgroundColor: C.hi, alignItems: 'center', justifyContent: 'center' },
  btnLabel: { fontFamily: F.xb, fontSize: 13, color: '#000' },
});
