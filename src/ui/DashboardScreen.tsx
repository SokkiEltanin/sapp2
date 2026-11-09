import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Globe, Moon, ListTodo, CalendarClock, Wrench } from 'lucide-react-native';
import { C, T, F } from './theme';
import { Screen, Row, Tile, Cap, FitList, Item, Tag, Price, Bars, StackBar, splitTag } from './layout';

/**
 * Wzorcowy Dashboard 1:1 z app-design.html.
 * Podepnij swoje hooki pod typ DashData – komponent nie zakłada skąd są dane.
 * Rzędy: 4×stat | 96px | auto | flex 1 | flex 1.3  → zawsze wypełnia ekran, nic się nie rozjeżdża.
 */
export type DashData = {
  next?: { title: string; start: Date } | null;
  fact: string;
  sleep?: { minutes: number; from: string; to: string; phases: { kind: 'deep' | 'light' | 'rem' | 'awake'; min: number }[] } | null;
  foodMonths: { label: string; value: number }[];
  transactions: { id: string; name: string; amount: number }[];
  // "Bezpieczne wydatki" ZASTĄPIONE "Odliczaniem" (2026-11-09, user: "ten
  // kafelek po prawej finansów ostatnich na dashboardzie, ten PLN per dzień"
  // — DOKŁADNIE ten kafel, nie Finanse's "Najbliższa opłata" jak pierwotnie
  // zrozumiano) — user RĘCZNIE wybiera jeden event kalendarza
  // (`countdownStore.ts`), kafel liczy do niego w dół. `balance`-owe pola
  // USUNIĘTE stąd razem z nieużywanym dalej kodem w index.tsx (ta funkcja
  // nigdzie indziej się nie pokazywała).
  countdown: { text: string; eventTitle: string } | null;
  // Lewa połowa Rzędu 1 (2026-11-09, user: "tam gdzie zielony musimy coś
  // zrobić i może zróbmy będzie najbliższa wymiana (oleju, filtra itp z
  // zapisanych)") — wcześniej świadomie pusty `Tile` (user: "zostaw pusty
  // kafelek"), teraz zasilany `nextMaintenanceDue` (vehicleMatch.ts) ze
  // WSZYSTKICH pojazdów naraz. CELOWO bez `onPress` — user ustalił wcześniej
  // (przy decyzji "zostaw pusty"), że to miejsce MUSI zostać czysto
  // informacyjne, nie klikane, bo jest wysoko na ekranie (trudno dosięgnąć
  // kciukiem).
  nextMaintenance: { vehicleName: string; label: string; dueLabel: string; overdue: boolean } | null;
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

  return (
    <Screen>
      {/* 2026-11-09, user: "wywalimy streaki... kafelek NOW... x2 szerszy a na
          drugiej połowie... zostaw pusty" — kafle Woda/Słodycze/Trening
          usunięte stąd (odhaczanie nawyków przeniesione do Daily, patrz
          `app/(tabs)/daily.tsx`'s rząd "Nawyki" — appka nie traci realnej
          funkcji, tylko miejsce). Lewa połowa: BYŁA świadomie pusta, teraz
          (ten sam dzień, user zmienił zdanie na zrzucie) pokazuje "Najbliższa
          wymiana" z Pojazdów — patrz `nextMaintenance` w `DashData` wyżej.
          CELOWO bez `onPress`/`Pressable` — czysto informacyjny `View`, nie
          `Tile`'s klikalny wariant, bo to miejsce jest za wysoko na ekranie na
          wygodne dotknięcie kciukiem (ta sama zasada co reszta tego rzędu). */}
      <Row>
        <Tile span={2} center style={st.maintTile}>
          {d.nextMaintenance ? (
            <>
              <Wrench size={12} color={C.dim} style={st.icoL} />
              <Text style={[T.num, { fontSize: 20 }, d.nextMaintenance.overdue && { color: C.warn }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {d.nextMaintenance.dueLabel}
              </Text>
              <Text style={T.unit} numberOfLines={1}>{d.nextMaintenance.vehicleName}</Text>
              <Text style={[T.lab, { textAlign: 'center' }]} numberOfLines={2}>{d.nextMaintenance.label}</Text>
            </>
          ) : (
            <>
              <Text style={[T.unit, { color: C.dim }]}>brak</Text>
              <Text style={T.lab} numberOfLines={1}>Najbliższa wymiana</Text>
            </>
          )}
        </Tile>
        <Tile span={2} hot={!!d.next} center style={st.nextTile} onPress={() => d.onOpen('next')}>
          {d.next ? (
            <>
              {/* 2026-11-09, user: "zamiast tej kropki czarnej jest ten badge po
                  prefiksie... po lewej w lewym górnym jest godzina... po środku
                  wiecej tekstu sie niech zmieści" — `PulseDot` (kropka, prawy
                  górny róg) USUNIĘTA stąd, jej miejsce przejmuje tag prefiksu
                  (`nextTagCorner`, ten sam róg). Godzina przeniesiona do
                  LEWEGO górnego rogu (`nextWhenCorner`) — oba teraz `position:
                  absolute`, więc nie zajmują miejsca w wyśrodkowanym stosie i
                  tytuł (jedyne dziecko "w przepływie") dostaje całą wysokość
                  kafla dla siebie, stąd `numberOfLines` 1→3. */}
              <Text style={[st.nextWhen, st.nextWhenCorner]} numberOfLines={1}>{relTime(d.next.start, now)}</Text>
              {nextTag ? (
                <View style={st.nextTagCorner}>
                  <Tag label={nextTag} kind={nextTag === 'PUR' || nextTag === 'UR' ? 'ur' : 'default'} />
                </View>
              ) : null}
              <Text style={st.nextTitle} numberOfLines={3} ellipsizeMode="tail">{nextTitle}</Text>
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

      {/* 2026-11-09, user: "Jedzenie PLN/dzień... dziwnie to wygląda... usunąć
          całkiem" — #JedzeniePerMiesiąc dostaje cały rząd (span 4 zamiast 3),
          `foodPerDay`/`onOpen('foodDay')` USUNIĘTE z `DashData` (poniżej) —
          `onOpen('foodMonth')` już otwiera dokładnie ten sam `WydatkiModal`
          ('food' tab), więc nic się nie traci. */}
      <Row>
        <Tile span={4} onPress={() => d.onOpen('foodMonth')}>
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
        <Tile onPress={() => d.onOpen('countdown')} center style={{ justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={[T.num, { fontSize: 22 }, !d.countdown && { color: C.dim }]} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.6}>
            {d.countdown ? d.countdown.text : '0'}
          </Text>
          {/* 2026-11-09, user: "ten w czerwonym kółku kafelek... on jest wysoki
              wiec pozwol tekst zawijać zeby bylo wiadomo do jakiego eventu" —
              `numberOfLines:1` obcinał tytuł eventu do "…" mimo że ten kafel
              (Row flex:1, sporo wysokości) ma miejsce na więcej. */}
          <Text style={[T.unit, { textAlign: 'center' }]} numberOfLines={3}>{d.countdown ? d.countdown.eventTitle : 'brak'}</Text>
          <Text style={T.lab} numberOfLines={1}>Odliczanie</Text>
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
  when: { width: 64, fontFamily: F.xb, fontSize: 10, color: C.mut, fontVariant: ['tabular-nums'] },
  bar: { width: 3, height: 16, borderRadius: 2 },
  kindIcon: { marginRight: 1 },
  // `paddingTop: 30` (nie 14) — rezerwuje miejsce na róg z godziną/tagiem
  // (`top:9/10`, wysokość ~16px), żeby wyśrodkowany tytuł (3 linie) nigdy na nie
  // nie nachodził niezależnie od długości tekstu/wysokości kafla. `minHeight: 96`
  // — zabezpiecza przed skurczeniem się kafla poniżej tego, gdy tytuł jest krótki.
  nextTile: { paddingHorizontal: 8, paddingTop: 30, paddingBottom: 12, minHeight: 96 },
  maintTile: { paddingHorizontal: 8 },
  nextWhenCorner: { position: 'absolute', top: 10, left: 10 },
  nextTagCorner: { position: 'absolute', top: 9, right: 9 },
  nextWhen: { fontFamily: F.sb, fontSize: 9, letterSpacing: 1.2, color: 'rgba(0,0,0,.55)', textTransform: 'uppercase' },
  nextTitle: { fontFamily: F.xb, fontSize: 12, lineHeight: 15, letterSpacing: 0.2, color: '#000', textAlign: 'center' },
});
