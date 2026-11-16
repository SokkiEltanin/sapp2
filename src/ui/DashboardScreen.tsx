import FitText from '@/ui/FitText';
import { Fragment } from 'react';
import { useDashboardLayoutStore } from '@/store/dashboardLayoutStore';
import { visibleSections, type DashSection } from '@/utils/dashboardLayout';
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { ListTodo, CalendarClock, Wrench, MapPin, StickyNote, Smartphone, Watch, Zap } from 'lucide-react-native';
import { batteryTone, ageLabel, watchName } from '@/utils/deviceBattery';
import NotePreview from '@/components/notes/NotePreview';
import NotePage from '@/components/notes/NotePage';
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
  // Baterie (2026-11-16, user: "paski naładowania urządzeń zamiast kafelka Ciekawostek").
  batteries: {
    phone: { level: number; charging: boolean } | null;
    watch: { level: number; charging: boolean; model: string; t: number } | null;
    lowPct: number;
  };
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
  // WSZYSTKICH pojazdów naraz. 2026-11-15, user: "jak klikam wymiana niech mnie
  // przeniesie do wymiany" — klikany, otwiera ekran Wymiany.
  nextMaintenance: { vehicleName: string; label: string; dueLabel: string; overdue: boolean } | null;
  upcoming: { id: string; when: string; title: string; kind: 'event' | 'deadline' | 'bill'; color: string; minutes?: number; amount?: number; fx?: { amount: number; currency: string }; steps?: string }[];
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
  const order = useDashboardLayoutStore((st) => st.order);
  const hidden = useDashboardLayoutStore((st) => st.hidden);
  const shown = visibleSections(order, hidden);
  // 2026-11-08, user: "kafelek ten biały w prawym gornym musi pokazywać tag
  // tez" — `splitTag` już wyciągał tag ([UR]/[PUR] itp. prefiks tytułu), ale
  // kafelek renderował TYLKO `.title`, tag po prostu znikał bez śladu.
  const { tag: nextTag, title: nextTitle } = d.next ? splitTag(d.next.title) : { tag: undefined, title: '' };
  const nextCountdownParts = d.next ? countdownParts(d.next.start, now) : null;
  const nextCountdown = nextCountdownParts ? (nextCountdownParts.past ? 'teraz' : formatCountdown(nextCountdownParts)) : '';

  // Rzędy jako sekcje (2026-11-14): kolejność i ukrywanie z Ustawień → Ogólne →
  // Układ Dashboardu (store/dashboardLayoutStore.ts, utils/dashboardLayout.ts).
  const sections: Record<DashSection, React.ReactNode> = {
    top: <>
          {/* 2026-11-09, user: "wywalimy streaki... kafelek NOW... x2 szerszy a na
              drugiej połowie... zostaw pusty" — kafle Woda/Słodycze/Trening
              usunięte stąd (odhaczanie nawyków przeniesione do Daily, patrz
              `app/(tabs)/daily.tsx`'s rząd "Nawyki" — appka nie traci realnej
              funkcji, tylko miejsce). Lewa połowa: BYŁA świadomie pusta, teraz
              (ten sam dzień, user zmienił zdanie na zrzucie) pokazuje "Najbliższa
              wymiana" z Pojazdów — patrz `nextMaintenance` w `DashData` wyżej.
              Tap → ekran Wymiany (2026-11-15). */}
          <Row>
            <Tile span={2} center style={st.maintTile} onPress={() => d.onOpen('replacements')} accessibilityLabel="Wymiany">
              {d.nextMaintenance ? (
                <>
                  <Wrench size={12} color={C.dim} style={st.icoL} />
                  <FitText style={[T.num, { fontSize: 20 }, d.nextMaintenance.overdue && { color: C.warn }]} numberOfLines={1} minimumFontScale={0.6}>
                    {d.nextMaintenance.dueLabel}
                  </FitText>
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
                    <FitText style={[T.num, st.nextNum]} numberOfLines={1} minimumFontScale={0.45}>{nextCountdown}</FitText>
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
    </>,
    factWeather: <>
          <Row h={96}>
            {/* Baterie telefonu i zegarka; stuknięcie = świeży odczyt z zegarka. */}
            <Tile span={2} onPress={() => d.onOpen('battery')} accessibilityLabel="Baterie urządzeń" style={st.batTile}>
              <BatteryRow icon="phone" label={Platform.OS === 'web' ? 'Komputer' : 'Telefon'} b={d.batteries.phone} lowPct={d.batteries.lowPct} />
              <BatteryRow icon="watch" label={d.batteries.watch ? watchName(d.batteries.watch.model) : 'Zegarek'} b={d.batteries.watch} lowPct={d.batteries.lowPct}
                sub={d.batteries.watch ? ageLabel(d.batteries.watch.t) : Platform.OS === 'web' ? 'na telefonie' : 'otwórz Sapp2 na zegarku'} />
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
    </>,
    food: <>
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
    </>,
    note: <>
          <Row flex={1}>
            <Tile span={3} onPress={() => d.onOpen(d.note ? 'note' : 'noteNew', d.note?.id)} style={{ overflow: 'hidden' }}>
              <Cap l={d.note ? noteTitle(d.note) : 'Notatka'} r={d.notesCount > 0 ? `wszystkie ${d.notesCount}` : undefined} onR={() => d.onOpen('notes')} />
              {d.note ? (
                <View style={{ flex: 1, marginTop: 6 }}>
                  {/* Tekst/rysunek = pomniejszona strona 1:1 (linia "widoczne na Dashboardzie"
                      w edytorze); lista — odhaczana z podglądu. */}
                  {d.note.kind === 'list'
                    ? <NotePreview note={d.note} maxLines={7} compact onToggle={(itemId) => d.onNoteToggle(d.note!.id, itemId)} />
                    : <NotePage note={d.note} />}
                </View>
              ) : (
                <View style={st.noteEmpty}>
                  <StickyNote size={18} color={C.dim} />
                  <Text style={[T.small, { textAlign: 'center' }]}>Stuknij, żeby napisać.{'\n'}Pinezka w notatce przypina ją tutaj.</Text>
                </View>
              )}
            </Tile>
            <Tile onPress={() => d.onOpen('countdown')} center style={{ justifyContent: 'center', paddingHorizontal: 8 }}>
              <FitText style={[T.num, { fontSize: 22 }, !d.countdown && { color: C.dim }]} numberOfLines={1} minimumFontScale={0.4}>
                {d.countdown ? d.countdown.text : '0'}
              </FitText>
              {/* 2026-11-09, user: "ten w czerwonym kółku kafelek... on jest wysoki
                  wiec pozwol tekst zawijać zeby bylo wiadomo do jakiego eventu" —
                  `numberOfLines:1` obcinał tytuł eventu do "…" mimo że ten kafel
                  (Row flex:1, sporo wysokości) ma miejsce na więcej. */}
              <Text style={[T.unit, { textAlign: 'center' }]} numberOfLines={3}>{d.countdown ? d.countdown.eventTitle : 'brak'}</Text>
              <Text style={T.lab} numberOfLines={1}>Odliczanie</Text>
            </Tile>
          </Row>
    </>,
    upcoming: <>
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
                      {x.steps ? <Tag label={x.steps} /> : null}
                      {x.kind === 'deadline' ? <Tag label="TERMIN" kind="warn" /> : null}
                      {x.kind === 'bill' && x.amount != null ? <Price amount={-x.amount} fx={x.fx} /> : null}
                    </Item>
                  );
                }}
              />
            </Tile>
          </Row>
    </>,
  };

  return (
    <Screen>
      {shown.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}
    </Screen>
  );
}

const BAT_TONE = { charge: '#4ADE80', low: '#F87171', mid: '#FB923C', ok: C.txt };
function BatteryRow({ icon, label, b, lowPct, sub }: { icon: 'phone' | 'watch'; label: string; b: { level: number; charging: boolean } | null; lowPct: number; sub?: string }) {
  const Icon = icon === 'phone' ? Smartphone : Watch;
  const tone = b ? BAT_TONE[batteryTone(b.level, b.charging, lowPct)] : C.dim;
  return (
    <View style={st.batRow}>
      <Icon size={13} color={b ? C.txt : C.dim} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={st.batHead}>
          <Text style={st.batLabel} numberOfLines={1}>{label}</Text>
          {b?.charging ? <Zap size={10} color={BAT_TONE.charge} /> : null}
          <Text style={[st.batPct, { color: b ? tone : C.dim }]}>{b ? `${b.level}%` : '—'}</Text>
        </View>
        <View style={st.batTrack}>
          {b ? <View style={[st.batFill, { width: `${Math.max(3, b.level)}%`, backgroundColor: tone }]} /> : null}
        </View>
        {sub ? <Text style={st.batSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// Ikona warunków (nazwa z utils/weather.ts's weatherCodeInfo → komponent lucide).
function WeatherIcon({ name, color = C.txt }: { name: string; color?: string }) {
  const Icon = (LucideIcons as any)[name] ?? LucideIcons.Cloud;
  return <Icon size={16} color={color} style={st.icoR} />;
}

const st = StyleSheet.create({
  batTile: { justifyContent: 'center', gap: 8, paddingVertical: 10 },
  batRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  batHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  batLabel: { flex: 1, fontFamily: F.xb, fontSize: 10, color: C.mut },
  batPct: { fontFamily: F.xb, fontSize: 11, fontVariant: ['tabular-nums'] },
  batTrack: { height: 5, borderRadius: 3, backgroundColor: C.in2, overflow: 'hidden' },
  batFill: { height: '100%', borderRadius: 3 },
  batSub: { fontFamily: F.b, fontSize: 9, color: C.dim },
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
