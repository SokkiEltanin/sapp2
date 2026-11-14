import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Globe, ListTodo, CalendarClock, Wrench, MapPin, StickyNote } from 'lucide-react-native';
import NotePreview from '@/components/notes/NotePreview';
import { noteTitle } from '@/utils/notes';
import type { Note } from '@/types/notes';
import * as LucideIcons from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, T, F } from './theme';
import { Screen, Row, Tile, Cap, FitList, Item, Tag, Price, Bars, StackBar, splitTag } from './layout';
import { countdownParts, formatCountdown } from '@/utils/countdown';

/**
 * Wzorcowy Dashboard 1:1 z app-design.html.
 * Podepnij swoje hooki pod typ DashData – komponent nie zakłada skąd są dane.
 * Rzędy: 4×stat | 96px | auto | flex 1 | flex 1.3  → zawsze wypełnia ekran, nic się nie rozjeżdża.
 */
export type DashData = {
  next?: { title: string; start: Date } | null;
  fact: string;
  // Pogoda ZAMIAST snu (2026-11-13, user: "sen na dashboardzie jest spoko, ale
  // on jest zaraz w zakładce obok") — `null` + `weatherHint` = stan pusty.
  weather: { temp: string; feels: string; label: string; icon: string; tone: string; place: string; rain: string; aqi?: { value: number; color: string } } | null;
  weatherHint: string;
  foodMonths: { label: string; value: number }[];
  // Przypięta notatka (2026-11-14, user: listy wydatków tu "nie chcę" → notatka:
  // tekst / lista z odhaczaniem / rysunek S-Pen). `null` = brak przypiętej.
  note: Note | null;
  notesCount: number;
  onNoteToggle: (noteId: string, itemId: string) => void;
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
  // kafelek"), od 2026-11-13 zasilany `allReplaceRows` (utils/replacements.ts): dom + pojazdy, ze
  // WSZYSTKICH pojazdów naraz. CELOWO bez `onPress` — user ustalił wcześniej
  // (przy decyzji "zostaw pusty"), że to miejsce MUSI zostać czysto
  // informacyjne, nie klikane, bo jest wysoko na ekranie (trudno dosięgnąć
  // kciukiem).
  nextMaintenance: { vehicleName: string; label: string; dueLabel: string; overdue: boolean } | null;
  upcoming: { id: string; when: string; title: string; kind: 'event' | 'deadline' | 'bill'; color: string; minutes?: number; amount?: number; fx?: { amount: number; currency: string } }[];
  onOpen: (what: string, id?: string) => void; // otwiera bottom sheet
};


// KIEDY (konkretna pora, nie odstęp) — pod dużym odliczaniem (2026-11-11), więc
// "za 3h" dublowałoby liczbę wyżej: "dziś 18:00" / "jutro 07:00" / "śr. 08:00" /
// "25 lis 08:00" (dalej niż tydzień).
function whenAt(start: Date, now: Date): string {
  const hhmm = start.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const diffDay = Math.round((new Date(start).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000);
  if (diffDay <= 0) return `dziś ${hhmm}`;
  if (diffDay === 1) return `jutro ${hhmm}`;
  if (diffDay < 7) return `${start.toLocaleDateString('pl-PL', { weekday: 'short' })} ${hhmm}`;
  return `${start.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} ${hhmm}`;
}

export function DashboardScreen(d: DashData) {
  const now = new Date();
  // 2026-11-08, user: "kafelek ten biały w prawym gornym musi pokazywać tag
  // tez" — `splitTag` już wyciągał tag ([UR]/[PUR] itp. prefiks tytułu), ale
  // kafelek renderował TYLKO `.title`, tag po prostu znikał bez śladu.
  const { tag: nextTag, title: nextTitle } = d.next ? splitTag(d.next.title) : { tag: undefined, title: '' };
  const nextCountdownParts = d.next ? countdownParts(d.next.start, now) : null;
  const nextCountdown = nextCountdownParts ? (nextCountdownParts.past ? 'teraz' : formatCountdown(nextCountdownParts)) : '';

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
        <Tile span={2} hot={!!d.next} center={!d.next} style={d.next ? st.nextTile : undefined} onPress={() => d.onOpen('next')}>
          {d.next ? (
            <>
              {/* Układ jak kafel snu (2026-11-11, user: "zróbmy go w taki
                  sposób jak jest sen zrobiony, że na górze będzie ilość
                  godzin, dni, w jakim czasie się pojawia ten event i pod nim
                  będzie ten napis jutro 07... tam gdzie jest pasek we śnie
                  damy ten event... a tag nadal po prawej, tam gdzie ikonka
                  księżyca") — duże odliczanie (`formatCountdown`, to samo co
                  kafel "Odliczanie"), pod nim kiedy, na dole tytuł; tag w
                  prawym górnym rogu jak księżyc. */}
              {nextTag ? (
                <View style={st.nextTagCorner}>
                  <Tag label={nextTag} kind={nextTag === 'PUR' || nextTag === 'UR' ? 'ur' : 'default'} />
                </View>
              ) : null}
              <View>
                <Text style={[T.num, st.nextNum]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{nextCountdown}</Text>
                <Text style={[T.unit, st.nextWhen]} numberOfLines={1}>{whenAt(d.next.start, now)}</Text>
              </View>
              <Text style={st.nextTitle} numberOfLines={2} ellipsizeMode="tail">{nextTitle}</Text>
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
        <Tile span={2} onPress={() => d.onOpen('weather')} style={{ justifyContent: 'space-between', overflow: 'hidden' }}>
          {d.weather ? (
            <>
              {/* Lekki akcent w kolorze pogody (2026-11-14) — bez animacji. */}
              <LinearGradient
                colors={[d.weather.tone + '33', 'transparent']}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.2, y: 0.9 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <WeatherIcon name={d.weather.icon} color={d.weather.tone} />
              <View>
                <Text style={T.num} numberOfLines={1}>{d.weather.temp}</Text>
                <Text style={T.unit} numberOfLines={1}>odcz. {d.weather.feels} · {d.weather.label}</Text>
              </View>
              <View style={st.wxFoot}>
                <Text style={[T.small, { flex: 1 }]} numberOfLines={1}>{d.weather.rain}</Text>
                {d.weather.aqi && (
                  <View style={st.wxAqi}>
                    <View style={[st.wxDot, { backgroundColor: d.weather.aqi.color }]} />
                    <Text style={T.small}>{d.weather.aqi.value}</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              <MapPin size={12} color={C.dim} style={st.icoR} />
              <Text style={[T.num, { color: C.dim }]}>--°</Text>
              <Text style={T.small} numberOfLines={2}>{d.weatherHint}</Text>
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
        <Tile span={3} onPress={() => d.onOpen(d.note ? 'note' : 'noteNew', d.note?.id)} style={{ overflow: 'hidden' }}>
          <Cap l={d.note ? noteTitle(d.note) : 'Notatka'} r={d.notesCount > 0 ? `wszystkie ${d.notesCount}` : undefined} onR={() => d.onOpen('notes')} />
          {d.note ? (
            <View style={{ flex: 1, marginTop: 6 }}>
              <NotePreview note={d.note} maxLines={7} compact onToggle={(itemId) => d.onNoteToggle(d.note!.id, itemId)} />
            </View>
          ) : (
            <View style={st.noteEmpty}>
              <StickyNote size={18} color={C.dim} />
              <Text style={[T.small, { textAlign: 'center' }]}>Stuknij, żeby napisać.{'\n'}Pinezka w notatce przypina ją tutaj.</Text>
            </View>
          )}
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
                  {x.kind === 'bill' && x.amount != null ? <Price amount={-x.amount} fx={x.fx} /> : null}
                </Item>
              );
            }}
          />
        </Tile>
      </Row>
    </Screen>
  );
}

// Ikona warunków (nazwa z utils/weather.ts's weatherCodeInfo → komponent lucide).
function WeatherIcon({ name, color = C.txt }: { name: string; color?: string }) {
  const Icon = (LucideIcons as any)[name] ?? LucideIcons.Cloud;
  return <Icon size={16} color={color} style={st.icoR} />;
}

const st = StyleSheet.create({
  wxFoot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wxAqi: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wxDot: { width: 7, height: 7, borderRadius: 4 },
  icoL: { position: 'absolute', top: 10, left: 10 },
  icoR: { position: 'absolute', top: 10, right: 10 },
  when: { width: 64, fontFamily: F.xb, fontSize: 10, color: C.mut, fontVariant: ['tabular-nums'] },
  bar: { width: 3, height: 16, borderRadius: 2 },
  kindIcon: { marginRight: 1 },
  // Układ jak kafel snu (2026-11-11): odliczanie+kiedy na górze, tytuł na
  // dole (`space-between`, jak sen ma pasek), tag w prawym górnym rogu.
  // `paddingRight` przy liczbie — żeby długie "7 dni 23h" nie wjechało pod tag.
  nextTile: { justifyContent: 'space-between', minHeight: 96 },
  maintTile: { paddingHorizontal: 8 },
  nextTagCorner: { position: 'absolute', top: 9, right: 9 },
  nextNum: { color: '#000', paddingRight: 34 },
  nextWhen: { color: 'rgba(0,0,0,.55)' },
  nextTitle: { fontFamily: F.xb, fontSize: 12.5, lineHeight: 15, letterSpacing: 0.2, color: '#000' },
  noteEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
