import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle } from 'lucide-react-native';
import Tile from '@/components/design/Tile';
import StatTile from '@/components/design/StatTile';
import Row from '@/components/design/Row';
import PricePill from '@/components/design/PricePill';
import Bars from '@/components/design/Bars';
import FitList from '@/components/design/FitList';
import WydatkiModal from '@/components/dashboard/WydatkiModal';
import { colors } from '@/theme/colors';
import { spacing, themedStyles } from '@/theme';
import { useCalendarStore } from '@/store/calendarStore';
import { useExpensesStore } from '@/store/expensesStore';
import { todayISO } from '@/utils/date';
import { foodByMonth, foodDailyAverageThisMonth } from '@/utils/foodStats';
import { useWydatkiData } from '@/hooks/useWydatkiData';
import { getBalanceOffset, accountBalance, affectsBalance } from '@/utils/balance';
import type { CalendarEvent } from '@/types/calendar';

// Faza 3.2 (2026-11-01, "dawaj" po Fazie 3.1) — Dashboard przebudowany na nowy
// system komponentów z design/app-design.html (Tile/StatTile/Row/PricePill/Bars/
// FitList), zgodnie z jego gridem (4 kolumny, grid-template-rows:
// `auto 96px auto 1fr 1.3fr`) i KOLEJNOŚCIĄ kafelków. Stary `src/components/
// dashboard/{StatTile,FactTile,SleepTile,TaskListTile,FoodBarsTile,
// PatternTileBackground,tilePosition}.*` USUNIĘTE — po przełączeniu index.tsx na
// nowe komponenty nic już ich nie importowało.
//
// Co jest REALNE, a co stub — żadnego kafla nie udaje danych, których appka nie
// zbiera (patrz ARCHITECTURE.md §"REDESIGN RDZENIA UI", decyzje #1/#2):
// - Woda/Słodycze/Trening (streaki) — appka NIE ma jeszcze żadnego store'a
//   nawyków/odhaczania dni. Stary Dashboard renderował tu SZTYWNE mocki ("74"/"4"/
//   "12") jako jeśli realne — to był pre-existing problem, nie mój wybór, i
//   naprawiony tutaj: `StatTile` bez `onPress` (nieinteraktywna), wartość "—",
//   `unit="WKRÓTCE"`. Zbudowanie realnego licznika to osobna, świadoma faza
//   (potrzebuje: co liczy się jako "dzień czysty", UI odznaczania, store).
// - Sen — Health Connect nieistniejący (Faza 3, decyzja #2) — ten sam stub.
// - "Siłownia"/hot-tile — ZREALIZOWANE z prawdziwych wydarzeń kalendarza
//   (`calendarStore`'s `events`+`gcalEvents`, już realne od Fazy 1 kalendarza):
//   najbliższe nadchodzące wydarzenie z godziną startu; "hot" (odwrócone
//   kolory+pulsująca kropka) gdy zaczyna się w ciągu 90 minut.
// - Ciekawostka — realna, statyczna lista + rotacja po dniu roku (deterministyczna,
//   nie losowa — to samo info cały dzień), tap = następna (bez popupu na razie,
//   bottom-sheet-yfikacja popupów to kolejna faza).
// - Jedzenie PLN/dzień, #JedzeniePerMiesiąc, Ostatnie transakcje — bez zmian w
//   danych (już realne, `foodStats.ts`/`useExpensesStore`), tylko nowy wygląd.
// - Bezpieczne wydatki — UPROSZCZONA, ale REALNA wersja: appka nie ma jeszcze
//   store'a "płatności cykliczne/bills" (patrz ARCHITECTURE.md), więc liczone
//   jako saldo (`utils/balance.ts`, realne) / dni do końca miesiąca, BEZ
//   odjęcia nieopłaconych rachunków (bo appka nie wie o żadnych). Jawnie
//   uproszczone, nie fałszywe — gdy store rachunków powstanie, odjęcie wraca.
// - Najbliższe 48h — REALNY merge wydarzeń kalendarza + terminów zadań
//   (oba już istniejące store'y), bez płatności cyklicznych (jak wyżej, nie
//   istnieją). Sortowane po czasie, max tyle wierszy ile się zmieści (`FitList`).
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

function fmtAmount(n: number): string {
  return Math.abs(n).toFixed(2).replace('.', ',');
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

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const s = makeS();
  const [wydatkiOpen, setWydatkiOpen] = useState(false);
  const [factIndex, setFactIndex] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const calendarTasks = useCalendarStore((st) => st.tasks);
  const calendarEvents = useCalendarStore((st) => st.events);
  const gcalEvents = useCalendarStore((st) => st.gcalEvents);
  const expenses = useExpensesStore((st) => st.expenses);
  const today = todayISO();
  const now = useMemo(() => new Date(), [today]);

  useEffect(() => { getBalanceOffset().then(setOffset); }, []);
  useEffect(() => { setFactIndex(dayOfYear(now) % FACTS.length); }, [now]);

  const dailyFoodAvg = useMemo(() => foodDailyAverageThisMonth(expenses, now), [expenses, now]);
  const wydatkiData = useWydatkiData(expenses, now);

  const foodMonths = useMemo(() => foodByMonth(expenses, 4, now), [expenses, now]);
  const foodMax = Math.max(1, ...foodMonths.map((m) => m.value));

  // Scalone wydarzenia kalendarza (lokalne + Google) — te same dwie listy, których
  // Zadania/Kalendarz już używają gdzie indziej w appce.
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
  const minutesToEvent = upcomingEvent ? Math.round((upcomingEvent.start.getTime() - now.getTime()) / 60000) : null;
  const isHotEvent = minutesToEvent !== null && minutesToEvent <= 90;

  // Saldo = realne (utils/balance.ts), ale "bezpieczne wydatki" bez odjęcia
  // nieopłaconych rachunków cyklicznych — appka nie ma jeszcze tego store'a.
  const balance = useMemo(() => accountBalance(expenses, offset), [expenses, offset]);
  const daysLeftInMonth = useMemo(() => {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Math.max(1, lastDay - now.getDate() + 1);
  }, [now]);
  const safePerDay = balance / daysLeftInMonth;
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

  type TimelineEntry = { key: string; at: Date; title: string; color: string; badge: 'event-hot' | 'task' | null };
  const timeline48h = useMemo<TimelineEntry[]>(() => {
    const limit = new Date(now.getTime() + 48 * 3600000);
    const out: TimelineEntry[] = [];
    for (const e of allEvents) {
      const start = eventStart(e);
      if (!start || start < now || start > limit) continue;
      out.push({ key: `e_${e.id}`, at: start, title: e.title, color: e.color || colors.ui.in2, badge: (start.getTime() - now.getTime()) / 60000 <= 60 ? 'event-hot' : null });
    }
    for (const t of calendarTasks) {
      if (t.status !== 'pending' || !t.deadline) continue;
      const at = new Date(t.deadline);
      if (at < now || at > limit) continue;
      out.push({ key: `t_${t.id}`, at, title: t.title, color: colors.accent.red, badge: 'task' });
    }
    return out.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [allEvents, calendarTasks, now]);

  return (
    <View style={[s.safe, { paddingTop: insets.top + spacing[2] }]}>
      {/* Rząd 1 (auto): streaki + hot event — auto=content-sized */}
      <View style={s.row}>
        <StatTile value="—" unit="WKRÓTCE" label="WODA" />
        <StatTile value="—" unit="WKRÓTCE" label="SŁODYCZE" />
        <StatTile value="—" unit="WKRÓTCE" label="TRENING" />
        {upcomingEvent ? (
          <StatTile
            value={isHotEvent ? ((minutesToEvent ?? 0) <= 0 ? 'TERAZ' : String(minutesToEvent)) : upcomingEvent.start.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
            unit={isHotEvent ? `MIN · ${upcomingEvent.start.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}` : 'START'}
            label={upcomingEvent.e.title}
            variant={isHotEvent ? 'hot' : 'default'}
            pulse={isHotEvent}
          />
        ) : (
          <StatTile value="—" unit="BRAK" label="WYDARZENIA" />
        )}
      </View>

      {/* Rząd 2 (96px): Ciekawostka + Sen (stub) */}
      <View style={[s.row, s.rowGap, s.row96]}>
        <Tile style={s.factTile} onPress={() => setFactIndex((i) => ((i ?? 0) + 1) % FACTS.length)}>
          <Text style={s.factText} numberOfLines={3}>{FACTS[factIndex ?? 0]}</Text>
        </Tile>
        <Tile style={s.sleepTile}>
          <Text style={s.sleepNum}>—</Text>
          <Text style={s.sleepUnit}>SNU · WKRÓTCE</Text>
        </Tile>
      </View>

      {/* Rząd 3 (auto): Jedzenie PLN/dzień + #JedzeniePerMiesiąc */}
      <View style={[s.row, s.rowGap]}>
        <StatTile
          value={dailyFoodAvg.toFixed(1).replace('.', ',')}
          unit="PLN/DZIEŃ"
          label="JEDZENIE"
          onPress={() => setWydatkiOpen(true)}
        />
        <Tile style={s.monthTile} onPress={() => setWydatkiOpen(true)}>
          <View style={s.capRow}>
            <Text style={s.capLabel}>#JEDZENIEPERMIESIĄC</Text>
            <Text style={s.capUnit}>PLN</Text>
          </View>
          <View style={s.monthVals}>
            {foodMonths.map((m, i) => (
              <Text key={m.key} style={[s.monthVal, i === foodMonths.length - 1 && s.monthValOn]}>{m.value}</Text>
            ))}
          </View>
          <Bars
            data={foodMonths.map((m) => ({ value: m.value, label: m.label }))}
            max={foodMax}
            activeIndex={foodMonths.length - 1}
            height={44}
          />
        </Tile>
      </View>

      {/* Rząd 4 (1fr): Ostatnie transakcje + Bezpieczne wydatki */}
      <View style={[s.row, s.rowGap, s.rowFlex1]}>
        <Tile style={s.txTile} variant="static">
          <Text style={s.capLabelStandalone}>OSTATNIE TRANSAKCJE</Text>
          <FitList
            data={recentExpenses}
            itemHeight={40}
            gap={spacing[1]}
            keyExtractor={(e) => e.id}
            empty={<Text style={s.emptyText}>Brak transakcji</Text>}
            renderItem={(e) => (
              <Row
                key={e.id}
                label={e.note || e.storeName || (e.type === 'income' ? 'Przychód' : 'Płatność')}
                right={<PricePill amount={fmtAmount(e.amount)} income={e.type === 'income'} />}
              />
            )}
          />
        </Tile>
        <Tile style={s.safeTile} onPress={() => setWydatkiOpen(true)}>
          <View>
            <Text style={[s.safeNum, safePerDay < 0 && s.safeNumNegative]}>{safePerDay < 0 ? 0 : Math.round(safePerDay)}</Text>
            <Text style={[s.sleepUnit, safePerDay < 0 && s.safeNumNegative]}>
              {safePerDay < 0 ? `brak ${Math.round(Math.abs(safePerDay))} zł` : 'PLN / DZIEŃ'}
            </Text>
          </View>
          <View>
            <View style={s.safeBarTrack}>
              <View style={[s.safeBarFill, { width: `${Math.min(100, (todaySpend / Math.max(1, safePerDay)) * 100)}%`, backgroundColor: safePerDay < 0 || todaySpend > safePerDay ? colors.accent.red : colors.text.primary }]} />
            </View>
            <Text style={[s.safeToday, (safePerDay < 0 || todaySpend > safePerDay) && s.safeTodayOver]}>dziś {Math.round(todaySpend)}</Text>
          </View>
        </Tile>
      </View>

      {/* Rząd 5 (1.3fr, najwyższy): Najbliższe 48h */}
      <View style={[s.row, s.rowGap, s.rowFlex13]}>
        <Tile style={s.timelineTile} variant="static">
          <View style={s.capRow}>
            <Text style={s.capLabelStandalone}>NAJBLIŻSZE 48H</Text>
            <Text style={s.capUnit}>{timeline48h.length} razem</Text>
          </View>
          <FitList
            data={timeline48h}
            itemHeight={40}
            gap={spacing[1]}
            keyExtractor={(x) => x.key}
            empty={<Text style={s.emptyText}>Spokój — nic w ciągu 48h</Text>}
            renderItem={(x) => (
              <Row
                key={x.key}
                left={<View style={[s.bar4, { backgroundColor: x.color }]} />}
                label={x.title}
                sublabel={x.at.toLocaleDateString('pl-PL', { weekday: 'short' }) + ' ' + x.at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                right={x.badge === 'task' ? <AlertTriangle size={14} color={colors.accent.red} /> : undefined}
              />
            )}
          />
        </Tile>
      </View>

      <WydatkiModal
        visible={wydatkiOpen}
        onClose={() => setWydatkiOpen(false)}
        month={wydatkiData.month}
        initialTab="food"
        food={wydatkiData.food}
        fixed={wydatkiData.fixed}
        variable={wydatkiData.variable}
      />
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary, paddingHorizontal: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[2] },
  rowGap: { marginTop: spacing[2] },
  row96: { height: 96 },
  rowFlex1: { flex: 1 },
  rowFlex13: { flex: 1.3 },

  factTile: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing[3] },
  factText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.primary, lineHeight: 17, textAlign: 'center' },

  sleepTile: { flex: 1, justifyContent: 'center' },
  sleepNum: { fontSize: 30, fontFamily: 'Inter_800ExtraBold', letterSpacing: -1.2, color: c.text.bright },
  sleepUnit: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2, color: c.text.muted, textTransform: 'uppercase', marginTop: 4 },

  monthTile: { flex: 3 },
  capRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, color: c.text.primary },
  capLabelStandalone: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, color: c.text.primary, marginBottom: spacing[2] },
  capUnit: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  monthVals: { flexDirection: 'row', gap: spacing[1], marginTop: spacing[2], marginBottom: spacing[1] },
  monthVal: { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.text.muted },
  monthValOn: { color: c.text.bright },

  txTile: { flex: 3 },
  emptyText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', marginTop: spacing[2] },

  safeTile: { flex: 1, justifyContent: 'space-between' },
  safeNum: { fontSize: 26, fontFamily: 'Inter_800ExtraBold', letterSpacing: -1, color: c.text.bright },
  // `safePerDay < 0` (2026-11-02, DESIGN.md §"Stany puste": "bezpieczne wydatki < 0 →
  // czerwone 0 + „brak X zł”, nigdy liczba ujemna") — pokazywanie realnej ujemnej
  // liczby ("-2 PLN/DZIEŃ") było mylące, wygląda jak błąd, nie jak uczciwy sygnał
  // "przekroczyłeś budżet". Czerwone "0" + ile brakuje, ten sam ton co inne stany
  // puste w appce.
  safeNumNegative: { color: c.accent.red },
  safeBarTrack: { height: 4, borderRadius: 999, backgroundColor: c.ui.in2, overflow: 'hidden', marginBottom: 5 },
  safeBarFill: { height: '100%', borderRadius: 999 },
  safeToday: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted },
  safeTodayOver: { color: c.accent.red },

  timelineTile: { flex: 1 },
  bar4: { width: 3, height: 20, borderRadius: 2, flexShrink: 0 },
}));
