import { useEffect, useMemo, useRef, useState } from 'react';
import LazyMount from '@/components/design/LazyMount';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { DashboardScreen, type DashData } from '@/ui/DashboardScreen';
import { Cap, Tag, splitTag } from '@/ui/layout';
import { T, S, R, C, F } from '@/ui/theme';
import WydatkiModal from '@/components/dashboard/WydatkiModal';
import AddExpenseModal from '@/components/finances/AddExpenseModal';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { colors } from '@/theme/colors';
import { useCalendarStore } from '@/store/calendarStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useWeather } from '@/hooks/useWeather';
import { useWeatherStore } from '@/store/weatherStore';
import { weatherCodeInfo, rainSummary, aqiInfo, fmtTemp } from '@/utils/weather';
import WeatherSheet from '@/components/weather/WeatherSheet';
import { useGoogleCalendarSync } from '@/hooks/useGoogleCalendarSync';
import { todayISO } from '@/utils/date';
import { foodByMonth } from '@/utils/foodStats';
import { useCountdownStore } from '@/store/countdownStore';
import { countdownParts, formatCountdown } from '@/utils/countdown';
import { useSubscriptionsStore } from '@/store/subscriptionsStore';
import { upcomingPayments } from '@/utils/recurringBills';
import { pendingFxOf, type PendingFx } from '@/utils/fx';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { nextMaintenanceDue } from '@/utils/vehicleMatch';
import type { CalendarEvent } from '@/types/calendar';
import type { Expense } from '@/types/finances';
import { haptic } from '@/utils/haptics';

// Faza 3.11 (2026-11-02, user: "zrób tę apkę w pełni funkcjonalną") — Woda/
// Słodycze/Trening dostały realny store (`habitsStore.ts`/`utils/habitStreak.ts`/
// `HabitsModal.tsx`). 2026-11-09: kafle streak USUNIĘTE stąd (user: "wywalimy
// streaki"), ich miejsce (lewa połowa Rzędu 1) zostaje świadomie puste —
// odhaczanie nawyków przeniesione do `app/(tabs)/daily.tsx`'s rząd "Nawyki",
// żeby nie zostawić dead-endu (ta sama logika/store, nowe wejście).
// Faza 3.12 (2026-11-02, user: "masz w sapp jak były połączenia z health czemu
// nie możesz tego zrobić na podstawie jak tam") — Sen DOSTAŁ realny Health
// Connect (port z sapp, `src/services/healthConnectService.ts`), ten sam
// store'owy wzorzec co nawyki: `useHealthSync()` odświeża cache w tle (cicho,
// bez promptu — zgoda przyznawana TYLKO z przycisku w Ustawieniach),
// `useHealthStore` czyta ostatni snapshot. Bez zegarka/braku zgody →
// `sleep: null`, kit renderuje zaprojektowany stan pusty.
// 2026-11-13: sen USUNIĘTY z Dashboardu (jest w Daily) — w jego miejscu pogoda
// (hooks/useWeather.ts, components/weather/WeatherSheet.tsx).
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
// Jak whenLabel, bez godziny — stałe opłaty mają tylko DZIEŃ płatności, nie
// godzinę, "Dziś 00:00" wyglądałoby jak błąd.
function whenLabelDayOnly(d: Date, now: Date): string {
  const dayDiff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000);
  if (dayDiff === 0) return 'Dziś';
  if (dayDiff === 1) return 'Jutro';
  return d.toLocaleDateString('pl-PL', { weekday: 'short' });
}

export default function Dashboard() {
  const [wydatkiOpen, setWydatkiOpen] = useState(false);
  const [wydatkiTab, setWydatkiTab] = useState<'food' | 'fixed' | 'variable'>('food');
  const [factIndex, setFactIndex] = useState<number | null>(null);
  const [nextOpen, setNextOpen] = useState(false);
  // Tap na konkretną transakcję w "Ostatnie transakcje" (2026-11-04, user: "klikam
  // w wydatek dany to pokazuje mi konkretnie ten wydatek") — wcześniej `onOpen('tx',
  // id)` IGNOROWAŁ `id` i zawsze otwierał ogólny WydatkiModal (zakładka "Zmienne"),
  // ten sam popup niezależnie KTÓRĄ pozycję się tapnęło. Teraz: ten sam wzorzec co
  // finances.tsx (TransactionsModal→tap→edycja) — `AddExpenseModal` w trybie edycji
  // konkretnego `Expense`.
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const calendarTasks = useCalendarStore((st) => st.tasks);
  const calendarEvents = useCalendarStore((st) => st.events);
  const gcalEvents = useCalendarStore((st) => st.gcalEvents);
  const setSelectedDate = useCalendarStore((st) => st.setSelectedDate);
  const expenses = useExpensesStore((st) => st.expenses);
  const subscriptions = useSubscriptionsStore((st) => st.subscriptions);
  const dismissedBills = useSubscriptionsStore((st) => st.dismissedBills);
  const vehicles = useVehiclesStore((st) => st.vehicles);
  // 2026-11-08, user: "jak wchodzę do apki to kalendarz sie nie ładuje na
  // dashbordzie a powinien... tylko rozsądnie bez lagów" — wcześniej TYLKO
  // `tasks.tsx` odświeżał `gcalEvents`, więc Dashboard pokazywał cokolwiek
  // zostało w store z ostatniej sesji dopóki user nie odwiedził Zadań.
  // Współdzielony hook z throttle'em (5 min, jak `useHealthSync`) — "bez
  // lagów" znaczy że szybkie przełączanie Dashboard↔Zadania NIE odpala
  // drugiego fetcha zaraz po pierwszym.
  useGoogleCalendarSync();
  const today = todayISO();
  const now = useMemo(() => new Date(), [today]);

  useEffect(() => { setFactIndex(dayOfYear(now) % FACTS.length); }, [now]);

  // 6 zamiast 4 miesięcy (2026-11-09, user: "jak jest średnia jedzenia z innych
  // miesięcy to możesz tam zrobic zeby bylo ich trochę więcej bo wydluzylismy
  // kafelek a tyle zostało samo miesięcy") — kafel dostał pełną szerokość (span 4)
  // przy usuwaniu "Jedzenie PLN/dzień" (patrz DashboardScreen.tsx), ale liczba
  // słupków została ta sama co przy wąskim kaflu (span 3), więc zostawiała pustą
  // przestrzeń. `MONTH_SHORT` (foodStats.ts) ma 12 unikalnych etykiet w obrębie
  // roku — 6 nie koliduje (brak przejścia przez Styczeń wstecz), 12 by kolidowało.
  const foodMonths = useMemo(() => foodByMonth(expenses, 6, now), [expenses, now]);

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

  // "Odliczanie" (2026-11-09, user: "ten kafelek po prawej finansów ostatnich na
  // dashboardzie, ten PLN per dzień" — czyli DOKŁADNIE to miejsce, Rząd 4 prawa
  // strona, dawniej "Bezpieczne wydatki") — zastępuje je realną funkcją: user
  // RĘCZNIE wybiera JEDEN event kalendarza (`countdownStore.ts`, świadomy wybór,
  // nie "najbliższy" jak kafelek "Teraz"), kafel liczy do niego w dół, coraz
  // drobniejsza jednostka w miarę zbliżania (`utils/countdown.ts`). Tick co 60s
  // (NIE co sekundę — appka świadomie unika żywych tickerów, patrz
  // src/types/work.ts). `countdownEventStart` (NIE `eventStart` wyżej) — tamten
  // zwraca `null` dla eventów całodniowych (celowo, zasila "Teraz"/timeline, które
  // dbają o realny czas zegarowy); odliczanie ma sens też dla "Wakacje" bez
  // konkretnej godziny, więc pada tu na północ dnia.
  const [countdownTick, setCountdownTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCountdownTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const [countdownPickerOpen, setCountdownPickerOpen] = useState(false);
  const selectedCountdownId = useCountdownStore((st) => st.selectedEventId);
  const setSelectedCountdownId = useCountdownStore((st) => st.setSelectedEventId);
  const countdownEventStart = (e: CalendarEvent): Date => {
    const d = new Date(`${(e.date || '').slice(0, 10)}T00:00:00`);
    if (e.startTime) {
      const [h, mi] = e.startTime.split(':').map(Number);
      d.setHours(h || 0, mi || 0, 0, 0);
    }
    return d;
  };
  const upcomingCountdownEvents = useMemo(() => {
    const nowMs = Date.now();
    return allEvents
      .map((e) => ({ e, start: countdownEventStart(e) }))
      .filter((x) => x.start.getTime() > nowMs)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 40);
  }, [allEvents]);
  const selectedCountdownEvent = useMemo(
    () => allEvents.find((e) => e.id === selectedCountdownId) ?? null,
    [allEvents, selectedCountdownId],
  );
  const countdown = useMemo(() => {
    void countdownTick;
    if (!selectedCountdownEvent) return null;
    return { text: formatCountdown(countdownParts(countdownEventStart(selectedCountdownEvent))), eventTitle: selectedCountdownEvent.title };
  }, [selectedCountdownEvent, countdownTick]);

  const recentExpenses = useMemo(
    () => [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [expenses],
  );

  // "Najbliższe eventy" — wcześniej "Najbliższe 48h" z twardym limitem 48h (user:
  // "zamieniamy na najbliższe eventy po prostu i tyle bez ograniczenia bo jak nic
  // nie będzie to będzie pusto") — BEZ limitu czasowego, wszystkie przyszłe
  // wydarzenia/terminy. `FitList` i tak pokaże tylko tyle ile się zmieści w
  // kaflu, pusty stan ("Nic zaplanowanego") jest uczciwy, nie coś do unikania.
  // `kind:'bill'` DOŁĄCZONY 2026-11-09 (user: "w kafelku w stałych opłatach
  // zaznaczyć kiedy co musimy opłacić") — ten wariant JUŻ istniał w
  // DashboardScreen.tsx/`DashData.upcoming` (zaprojektowany, nic go dotąd nie
  // zasilało), teraz REALNIE zasilany z `subscriptionsStore`. W PRZECIWIEŃSTWIE
  // do eventów/terminów — stałe opłaty DOSTAJĄ okno czasowe (14 dni): w innym
  // wypadku subskrypcja płatna raz w roku zaśmiecałaby listę miesiącami z
  // wyprzedzeniem, czego lista eventów (z natury bliskich w czasie) nie robi.
  const BILL_WINDOW_DAYS = 14;
  type TimelineEntry = { key: string; at: Date; title: string; color: string; kind: 'event' | 'deadline' | 'bill'; minutes?: number; amount?: number; fx?: PendingFx };
  const upcomingTimeline = useMemo<TimelineEntry[]>(() => {
    const out: TimelineEntry[] = [];
    for (const e of allEvents) {
      const start = eventStart(e);
      if (!start || start < now) continue;
      out.push({ key: `e_${e.id}`, at: start, title: e.title, color: e.color || colors.ui.in2, kind: 'event', minutes: Math.round((start.getTime() - now.getTime()) / 60000) });
    }
    for (const t of calendarTasks) {
      if (t.status !== 'pending' || !t.deadline) continue;
      const at = new Date(t.deadline);
      if (at < now) continue;
      out.push({ key: `t_${t.id}`, at, title: t.title, color: colors.accent.red, kind: 'deadline' });
    }
    // `upcomingPayments` (nie samo `upcomingSubscriptions`) — 2026-11-09, user:
    // "ta ostatnia platnosc najbliższą ma być automatyczna po stałych i
    // subskrypcjach łapać" — dolicza też PRZEWIDYWANE terminy rachunków stałych
    // (czynsz/prąd/internet...) rozpoznanych z historii wydatków, nie tylko
    // ręcznie dodane Subskrypcje.
    for (const p of upcomingPayments(expenses, subscriptions, now, dismissedBills)) {
      if (p.daysUntil > BILL_WINDOW_DAYS) continue;
      out.push({ key: `b_${p.id}`, at: new Date(`${p.dueDate}T00:00:00`), title: p.name, color: colors.accent.red, kind: 'bill', amount: p.amount, fx: p.fx });
    }
    return out.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [allEvents, calendarTasks, subscriptions, expenses, now, dismissedBills]);

  // Pogoda zamiast snu (2026-11-13) — sen jest w Daily.
  const { data: wx } = useWeather();
  const wxLocation = useWeatherStore((st) => st.location);
  const wxDenied = useWeatherStore((st) => st.gpsDenied);
  const wxError = useWeatherStore((st) => st.error);
  const [weatherOpen, setWeatherOpen] = useState(false);
  // Kliknięcie widgetu "Pogoda" na pulpicie → app/weather.tsx → tu z ?weather=1.
  const { weather: weatherParam } = useLocalSearchParams<{ weather?: string }>();
  useEffect(() => {
    if (weatherParam !== '1') return;
    setWeatherOpen(true);
    router.setParams({ weather: undefined });
  }, [weatherParam]);
  const weather = useMemo(() => {
    if (!wx) return null;
    const info = weatherCodeInfo(wx.current.code, wx.current.isDay);
    return {
      temp: fmtTemp(wx.current.temp), feels: fmtTemp(wx.current.feels), label: info.label, icon: info.icon,
      place: wx.place, rain: rainSummary(wx.hourly),
      aqi: wx.air ? { value: wx.air.aqi, color: aqiInfo(wx.air.aqi).color } : undefined,
    };
  }, [wx]);
  const weatherHint = wxError ?? (wxDenied && !wxLocation ? 'Stuknij i wpisz miasto' : 'Pobieram pogodę…');

  const nextMaintenance = useMemo(() => nextMaintenanceDue(vehicles, now), [vehicles, now]);

  const data: DashData = {
    next: upcomingEvent ? { title: upcomingEvent.e.title, start: upcomingEvent.start } : null,
    fact: FACTS[factIndex ?? 0],
    weather,
    weatherHint,
    foodMonths: foodMonths.map((m) => ({ label: m.label, value: m.value })),
    nextMaintenance: nextMaintenance
      ? { vehicleName: nextMaintenance.vehicleName, label: nextMaintenance.label, dueLabel: nextMaintenance.dueLabel, overdue: nextMaintenance.dueMonths <= 0 }
      : null,
    transactions: recentExpenses.map((e) => ({
      id: e.id,
      name: e.note || e.storeName || (e.type === 'income' ? 'Przychód' : 'Płatność'),
      amount: e.type === 'income' ? e.amount : -e.amount,
      fx: pendingFxOf(e),
    })),
    countdown,
    upcoming: upcomingTimeline.map((x) => ({
      id: x.key,
      when: x.kind === 'bill' ? whenLabelDayOnly(x.at, now) : whenLabel(x.at, now),
      title: x.title,
      kind: x.kind,
      color: x.color,
      minutes: x.minutes,
      amount: x.amount,
      fx: x.fx,
    })),
    onOpen: (what, id) => {
      if (what === 'fact') setFactIndex((i) => ((i ?? 0) + 1) % FACTS.length);
      else if (what === 'foodMonth') { setWydatkiTab('food'); setWydatkiOpen(true); }
      else if (what === 'tx') {
        const expense = expenses.find((e) => e.id === id);
        if (expense) setEditingExpense(expense);
      }
      else if (what === 'countdown') setCountdownPickerOpen(true);
      else if (what === 'next' && upcomingEvent) setNextOpen(true);
      else if (what === 'bill') router.push('/subscriptions');
      else if (what === 'weather') setWeatherOpen(true);
      // upcoming — jeszcze bez docelowego popupu (szczegół pojedynczego
      // wydarzenia/terminu z listy "Najbliższe eventy"), świadomie bez akcji na razie.
      // 'streak' — przeniesione do Daily (`app/(tabs)/daily.tsx`'s rząd "Nawyki"),
      // patrz komentarz w DashboardScreen.tsx przy usunięciu kafli streak.
    },
  };

  const nextTag = upcomingEvent ? splitTag(upcomingEvent.e.title) : null;
  // Przejście do Zadań DOPIERO po zamknięciu sheeta (`onClosed`) — przełączenie
  // zakładki w trakcie animacji zamykania zostawiało puste okno sheeta na
  // wierzchu (ten sam bug co Ustawienia → Płatności do zatwierdzenia, 2026-11-11).
  const goToTasksAfterClose = useRef(false);
  const openNextInTasks = () => {
    if (!upcomingEvent) return;
    haptic.tap();
    setSelectedDate(upcomingEvent.e.date.slice(0, 10));
    goToTasksAfterClose.current = true;
    setNextOpen(false);
  };

  return (
    <>
      <DashboardScreen {...data} />
      <LazyMount visible={weatherOpen}>
        <WeatherSheet visible={weatherOpen} onClose={() => setWeatherOpen(false)} />
      </LazyMount>
      <LazyMount visible={!!editingExpense}>
        <AddExpenseModal
          visible={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          editingExpense={editingExpense}
        />
      </LazyMount>
      <LazyMount visible={wydatkiOpen}>
        <WydatkiModal
          visible={wydatkiOpen}
          onClose={() => setWydatkiOpen(false)}
          initialTab={wydatkiTab}
          expenses={expenses}
          today={now}
          onEditExpense={setEditingExpense}
        />
      </LazyMount>
      <AppBottomSheet
        visible={nextOpen}
        onClose={() => setNextOpen(false)}
        onClosed={() => { if (goToTasksAfterClose.current) { goToTasksAfterClose.current = false; router.push('/tasks'); } }}
        scrollable={false}
      >
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

      <AppBottomSheet visible={countdownPickerOpen} onClose={() => setCountdownPickerOpen(false)}>
        <Text style={[T.rowHi, { marginBottom: S.gap }]}>Odliczanie do…</Text>
        {selectedCountdownEvent && (
          <TouchableOpacity
            style={ns.countdownClearBtn}
            onPress={() => { haptic.tap(); setSelectedCountdownId(null); setCountdownPickerOpen(false); }}
            activeOpacity={0.8}
          >
            <Text style={ns.countdownClearLabel}>Wyłącz odliczanie</Text>
          </TouchableOpacity>
        )}
        {upcomingCountdownEvents.length === 0 ? (
          <Text style={T.small}>Brak nadchodzących wydarzeń w kalendarzu.</Text>
        ) : upcomingCountdownEvents.map(({ e, start }) => (
          <TouchableOpacity
            key={e.id}
            style={[ns.countdownRow, e.id === selectedCountdownId && ns.countdownRowOn]}
            onPress={() => { haptic.success(); setSelectedCountdownId(e.id); setCountdownPickerOpen(false); }}
            activeOpacity={0.8}
          >
            <Text style={T.row} numberOfLines={1}>{e.title}</Text>
            <Text style={ns.countdownRowDate}>
              {start.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
              {e.startTime ? ` · ${e.startTime}` : ''}
            </Text>
          </TouchableOpacity>
        ))}
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
  countdownClearBtn: { marginBottom: S.gap, paddingVertical: 6 },
  countdownClearLabel: { fontFamily: F.b, fontSize: 12.5, color: C.warn },
  countdownRow: { marginTop: S.gap, padding: S.pad, borderRadius: R.inner, borderWidth: 1, borderColor: C.line, backgroundColor: C.in },
  countdownRowOn: { borderColor: C.hi },
  countdownRowDate: { fontFamily: F.sb, fontSize: 11, color: C.mut, marginTop: 2, textTransform: 'capitalize' },
});
