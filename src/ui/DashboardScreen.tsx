import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Globe, Moon, ListTodo, CalendarClock } from 'lucide-react-native';
import { C, T, F } from './theme';
import { Screen, Row, Tile, StatTile, Cap, FitList, Item, Tag, Price, Bars, StackBar, Progress, splitTag, PulseDot } from './layout';

/**
 * Wzorcowy Dashboard 1:1 z app-design.html.
 * Podepnij swoje hooki pod typ DashData – komponent nie zakłada skąd są dane.
 * Rzędy: 4×stat | 96px | auto | flex 1 | flex 1.3  → zawsze wypełnia ekran, nic się nie rozjeżdża.
 */
export type DashData = {
  streaks: { water: number | null; sweets: number | null; training: number | null };
  next?: { title: string; start: Date } | null;
  fact: string;
  sleep?: { minutes: number; from: string; to: string; phases: { kind: 'deep' | 'light' | 'rem' | 'awake'; min: number }[] } | null;
  foodPerDay: number | null;
  foodMonths: { label: string; value: number }[];
  transactions: { id: string; name: string; amount: number }[];
  safe: { balance: number | null; unpaidDue: number; daysLeft: number; spentToday: number };
  upcoming: { id: string; when: string; title: string; kind: 'event' | 'deadline' | 'bill'; color: string; minutes?: number; amount?: number }[];
  onOpen: (what: string, id?: string) => void; // otwiera bottom sheet
};

const fmtMin = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
const phaseColor = { deep: C.deep, light: C.light, rem: C.rem, awake: C.awake };

// "za 45 min" / "za 3h" / "jutro 08:00" / "Śr 08:00" — skrót, nie wielka liczba
// godzin z ułamkiem (DESIGN.md's "4× StatTile: ... + hot „za X min · wydarzenie"" —
// ten kafelek jest ZAWSZE wariantem "hot", nie tylko gdy wydarzenie jest blisko).
function relTime(start: Date, now: Date): string {
  const diffMin = Math.round((start.getTime() - now.getTime()) / 60000);
  if (diffMin <= 0) return 'teraz';
  if (diffMin < 60) return `za ${diffMin} min`;
  const hhmm = start.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const diffDay = Math.round((new Date(start).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000);
  if (diffDay === 0) return `za ${Math.round(diffMin / 60)}h`;
  if (diffDay === 1) return `jutro ${hhmm}`;
  return `${start.toLocaleDateString('pl-PL', { weekday: 'short' })} ${hhmm}`;
}

export function DashboardScreen(d: DashData) {
  const now = new Date();
  // 2026-11-08, user: "kafelek ten biały w prawym gornym musi pokazywać tag
  // tez" — `splitTag` już wyciągał tag ([UR]/[PUR] itp. prefiks tytułu), ale
  // kafelek renderował TYLKO `.title`, tag po prostu znikał bez śladu.
  const { tag: nextTag, title: nextTitle } = d.next ? splitTag(d.next.title) : { tag: undefined, title: '' };

  // bezpieczne wydatki – nigdy nie pokazuj ujemnej liczby jako "limitu"
  const free = d.safe.balance == null ? null : d.safe.balance - d.safe.unpaidDue;
  const perDay = free == null ? null : free / Math.max(1, d.safe.daysLeft);
  const deficit = perDay != null && perDay < 0;

  return (
    <Screen>
      <Row>
        <StatTile value={d.streaks.water} unit="dni" label="Woda" onPress={() => d.onOpen('streak', 'water')} />
        <StatTile value={d.streaks.sweets} unit="dni" label="Słodycze" onPress={() => d.onOpen('streak', 'sweets')} />
        <StatTile value={d.streaks.training} unit="dni" label="Trening" onPress={() => d.onOpen('streak', 'training')} />
        <Tile hot={!!d.next} center style={st.nextTile} onPress={() => d.onOpen('next')}>
          {d.next ? (
            <>
              <PulseDot />
              <Text style={st.nextWhen} numberOfLines={1}>{relTime(d.next.start, now)}</Text>
              {nextTag ? (
                <View style={st.nextTagWrap}>
                  <Tag label={nextTag} kind={nextTag === 'PUR' || nextTag === 'UR' ? 'ur' : 'default'} />
                </View>
              ) : null}
              {/* `numberOfLines` niższe gdy jest tag — żeby łączna wysokość (tag +
                  tytuł) dalej mieściła się w stałej wysokości kafla; to ONO
                  (razem z `ellipsizeMode`) realnie "skraca" za długie nazwy
                  eventów do "…", user: "skrócone formy niektórych eventow jezeli
                  sa za długie". */}
              <Text style={st.nextTitle} numberOfLines={nextTag ? 1 : 2} ellipsizeMode="tail">{nextTitle}</Text>
            </>
          ) : (
            <>
              <Text style={[T.unit, { color: C.dim }]}>brak</Text>
              <Text style={T.lab} numberOfLines={1}>Kalendarz</Text>
            </>
          )}
        </Tile>
      </Row>

      <Row h={96}>
        <Tile span={2} center onPress={() => d.onOpen('fact')}>
          <Globe size={12} color={C.dim} style={st.icoL} />
          <Text style={[T.body, { textAlign: 'center' }]} numberOfLines={3}>{d.fact}</Text>
        </Tile>
        <Tile span={2} onPress={() => d.onOpen('sleep')} style={{ justifyContent: 'space-between' }}>
          <Moon size={12} color={C.dim} style={st.icoR} />
          {d.sleep ? (
            <>
              <View>
                <Text style={T.num}>{fmtMin(d.sleep.minutes)}</Text>
                <Text style={T.unit}>snu · {d.sleep.from} – {d.sleep.to}</Text>
              </View>
              <StackBar height={6} legend={false} parts={d.sleep.phases.map((p) => ({ label: p.kind, value: p.min, color: phaseColor[p.kind] }))} />
            </>
          ) : (
            <>
              <Text style={[T.num, { color: C.dim }]}>0h 00m</Text>
              <Text style={T.small}>Połącz zegarek w Ustawieniach</Text>
            </>
          )}
        </Tile>
      </Row>

      <Row>
        <StatTile value={d.foodPerDay == null ? null : d.foodPerDay.toFixed(1).replace('.', ',')} unit="pln / dzień" label="Jedzenie" onPress={() => d.onOpen('foodDay')} />
        <Tile span={3} onPress={() => d.onOpen('foodMonth')}>
          <Cap l="#JedzeniePerMiesiąc" r="PLN" />
          <Bars showValues height={36} values={d.foodMonths.map((m) => m.value)} labels={d.foodMonths.map((m) => m.label)} />
        </Tile>
      </Row>

      <Row flex={1}>
        <Tile span={3}>
          <FitList
            data={d.transactions}
            emptyText="Brak transakcji – zaimportuj wyciąg"
            renderItem={(t) => (
              <Item onPress={() => d.onOpen('tx', t.id)}>
                <Price amount={t.amount} />
                <Text style={[T.row, { flex: 1 }]} numberOfLines={1}>{t.name}</Text>
              </Item>
            )}
          />
        </Tile>
        <Tile onPress={() => d.onOpen('safe')} style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={[T.num, { fontSize: 26 }, (perDay == null || deficit) && { color: deficit ? C.warn : C.dim }]} adjustsFontSizeToFit numberOfLines={1}>
              {perDay == null ? '0' : deficit ? '0' : Math.round(perDay)}
            </Text>
            <Text style={T.unit}>pln / dzień</Text>
          </View>
          <View style={{ gap: 5 }}>
            <Progress value={perDay && perDay > 0 ? d.safe.spentToday / perDay : 1} color={deficit || (perDay != null && d.safe.spentToday > perDay) ? C.warn : C.txt} />
            <Text style={[st.tiny, deficit && { color: C.warn }]}>
              {deficit ? `brak ${Math.round(-free!)} zł` : `dziś ${Math.round(d.safe.spentToday)}`}
            </Text>
          </View>
        </Tile>
      </Row>

      <Row flex={1.3}>
        <Tile span={4}>
          <Cap l="Najbliższe eventy" r={`${d.upcoming.filter((x) => x.kind === 'deadline' || (x.minutes ?? 999) < 60).length} ważne · ${d.upcoming.length} razem`} />
          <FitList
            data={d.upcoming}
            emptyText="Nic zaplanowanego"
            renderItem={(x) => {
              const { tag, title } = splitTag(x.title);
              const important = x.kind === 'deadline' || (x.minutes ?? 999) < 60;
              // 2026-11-08, user: "zadania muszą wyróżniać sie lekko od eventow
              // z kalendarza" — kolorowy pasek + pogrubienie dla "ważnych" już
              // było, ale samo w sobie nie mówiło jednoznacznie "to ZADANIE" (bar
              // event-u może mieć dowolny kolor, pogrubienie dostawał też bliski
              // event). Osobna, stała (niezależna od pilności) ikonka per `kind`.
              const KindIcon = x.kind === 'deadline' ? ListTodo : CalendarClock;
              return (
                <Item onPress={() => d.onOpen(x.kind, x.id)}>
                  <Text style={st.when} numberOfLines={1}>{x.when}</Text>
                  <View style={[st.bar, { backgroundColor: x.color }]} />
                  <KindIcon size={11} color={x.kind === 'deadline' ? C.warn : C.dim} style={st.kindIcon} />
                  {tag ? <Tag label={tag} kind={tag === 'PUR' || tag === 'UR' ? 'ur' : 'default'} /> : null}
                  <Text style={[T.row, { flex: 1 }, important && { color: C.hi, fontFamily: F.xb }]} numberOfLines={1}>{title}</Text>
                  {x.minutes != null && x.minutes < 60 ? <Tag label={`${x.minutes} MIN`} kind="fr" /> : null}
                  {x.kind === 'deadline' ? <Tag label="TERMIN" kind="warn" /> : null}
                  {x.kind === 'bill' && x.amount != null ? <Price amount={-x.amount} /> : null}
                </Item>
              );
            }}
          />
        </Tile>
      </Row>
    </Screen>
  );
}

const st = StyleSheet.create({
  icoL: { position: 'absolute', top: 10, left: 10 },
  icoR: { position: 'absolute', top: 10, right: 10 },
  tiny: { fontFamily: F.b, fontSize: 10, color: C.mut },
  when: { width: 64, fontFamily: F.xb, fontSize: 10, color: C.mut, fontVariant: ['tabular-nums'] },
  bar: { width: 3, height: 16, borderRadius: 2 },
  kindIcon: { marginRight: 1 },
  nextTile: { paddingHorizontal: 6, paddingTop: 14, paddingBottom: 12 },
  nextTagWrap: { marginTop: 4 },
  nextWhen: { fontFamily: F.sb, fontSize: 9, letterSpacing: 1.2, color: 'rgba(0,0,0,.55)', textTransform: 'uppercase' },
  nextTitle: { fontFamily: F.xb, fontSize: 12, lineHeight: 15, letterSpacing: 0.2, color: '#000', textAlign: 'center', marginTop: 6 },
});
