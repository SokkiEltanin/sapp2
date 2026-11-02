import { useEffect, useMemo, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { DashboardScreen, type DashData } from '@/ui/DashboardScreen';
import { Cap, Tag, splitTag } from '@/ui/layout';
import { T, S, R, C, F } from '@/ui/theme';
import WydatkiModal from '@/components/dashboard/WydatkiModal';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { colors } from '@/theme/colors';
import { useCalendarStore } from '@/store/calendarStore';
import { useExpensesStore } from '@/store/expensesStore';
import { todayISO } from '@/utils/date';
import { foodByMonth, foodDailyAverageThisMonth } from '@/utils/foodStats';
import { useWydatkiData } from '@/hooks/useWydatkiData';
import { getBalanceOffset, accountBalance, affectsBalance } from '@/utils/balance';
import type { CalendarEvent } from '@/types/calendar';

// Faza 3.9 (design/rn kit, 2026-11-02) — Dashboard podmieniony na `DashboardScreen`
// z kitu (src/ui/, skopiowane 1:1 z design/rn/, patrz ARCHITECTURE.md): ten plik
// teraz TYLKO zbiera prawdziwe dane appki i mapuje je na `DashData`, cały layout/
// grid/style żyje w kicie. Co jest REALNE a co stub — bez zmian względem starego
// Dashboardu (Faza 3.2):
// - Woda/Słodycze/Trening: appka NIE ma jeszcze store'a nawyków → `null` dla
//   wszystkich trzech. `StatTile` z kitu renderuje `null` jako zaprojektowany stan
//   pusty (DESIGN.md: "0" przygaszone + "brak"), NIE jako fałszywy mock.
// - Sen: Health Connect nieistniejący → `sleep: null` (kit: "0h 00m" + "Połącz
//   zegarek w Ustawieniach").
// - Reszta (kalendarz, jedzenie, transakcje, saldo, 48h) — bez zmian, te same
//   store'y/hooki co w starym Dashboardzie.
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
  const [offset, setOffset] = useState(0);
  const calendarTasks = useCalendarStore((st) => st.tasks);
  const calendarEvents = useCalendarStore((st) => st.events);
  const gcalEvents = useCalendarStore((st) => st.gcalEvents);
  const setSelectedDate = useCalendarStore((st) => st.setSelectedDate);
  const expenses = useExpensesStore((st) => st.expenses);
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

  const data: DashData = {
    streaks: { water: null, sweets: null, training: null },
    next: upcomingEvent ? { title: upcomingEvent.e.title, start: upcomingEvent.start } : null,
    fact: FACTS[factIndex ?? 0],
    sleep: null,
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
    onOpen: (what) => {
      if (what === 'fact') setFactIndex((i) => ((i ?? 0) + 1) % FACTS.length);
      else if (what === 'foodDay' || what === 'foodMonth') { setWydatkiTab('food'); setWydatkiOpen(true); }
      else if (what === 'tx' || what === 'safe') { setWydatkiTab('variable'); setWydatkiOpen(true); }
      else if (what === 'next' && upcomingEvent) setNextOpen(true);
      // streak/sleep/next48 — jeszcze bez docelowego popupu (brak store'a
      // nawyków / szczegółu wydarzenia na 48h), świadomie bez akcji na razie.
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
