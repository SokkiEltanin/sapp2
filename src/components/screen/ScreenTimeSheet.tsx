import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { ChevronLeft, ChevronRight, Smartphone, LockOpen, Sun, Moon, Timer, Flame } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { SheetCard, Legend } from '@/components/design/SheetCard';
import { useScreenTimeStore, useAppIconsStore } from '@/store/screenTimeStore';
import { openScreenAccess, refreshScreenTime, screenTimeAvailable } from '@/services/screenTime';
import {
  fmtDur, byCategory, catOf, CAT_LABEL, CAT_COLOR, vsUsual, avgBefore, peakHour, nightMinutes, lastScreenDays, ymd,
  type ScreenDay, type ScreenApp,
} from '@/utils/screenTime';
import { haptic } from '@/utils/haptics';

// Szczegóły czasu z telefonem (2026-11-22, user: "po otwarciu więcej szczegółów… w naszym
// stylu"). Dzień do wyboru strzałkami; karty: najważniejsze liczby, godziny, kategorie,
// appki, tydzień. Dane: store/screenTimeStore.ts (telefon) albo z chmury (komputer).
const WD = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];

function dayLabel(date: string, now: Date): string {
  const today = ymd(now);
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (date === today) return 'Dziś';
  if (date === ymd(y)) return 'Wczoraj';
  return new Date(`${date}T12:00:00`).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function ScreenTimeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const days = useScreenTimeStore((st) => st.days);
  const access = useScreenTimeStore((st) => st.access);
  const now = useMemo(() => new Date(), [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const dates = useMemo(() => Object.keys(days).sort(), [days]);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { if (visible) { setSel(null); refreshScreenTime(true); } }, [visible]);
  const date = sel && days[sel] ? sel : dates[dates.length - 1] ?? null;
  const d = date ? days[date] : null;
  const i = date ? dates.indexOf(date) : -1;
  const isToday = date === ymd(now);

  const android = Platform.OS === 'android';
  const noModule = android && !screenTimeAvailable();
  const noAccess = android && !noModule && access === false;

  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.92} header={
      <View style={s.headRow}>
        <Text style={s.title}>Czas z telefonem</Text>
        {d && (
          <View style={s.dayNav}>
            <TouchableOpacity disabled={i <= 0} onPress={() => { haptic.tap(); setSel(dates[i - 1]); }} hitSlop={8} accessibilityLabel="Poprzedni dzień">
              <ChevronLeft size={18} color={i <= 0 ? colors.text.muted : colors.text.primary} />
            </TouchableOpacity>
            <Text style={s.dayTxt}>{dayLabel(date!, now)}</Text>
            <TouchableOpacity disabled={i >= dates.length - 1} onPress={() => { haptic.tap(); setSel(dates[i + 1]); }} hitSlop={8} accessibilityLabel="Następny dzień">
              <ChevronRight size={18} color={i >= dates.length - 1 ? colors.text.muted : colors.text.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    }>
      {noModule ? (
        <Info icon text="Liczenie czasu z telefonem wymaga nowej wersji appki (APK). Zainstaluj najnowszy build z GitHuba." />
      ) : noAccess ? (
        <View style={s.accessCard}>
          <Smartphone size={22} color={colors.text.primary} />
          <Text style={s.accessTitle}>Zezwól na dostęp do danych o użyciu</Text>
          <Text style={s.accessTxt}>Android pokazuje te dane tylko appkom z osobnym dostępem. Na liście znajdź SOEN i włącz przełącznik — potem wróć tutaj. Nic nie wychodzi poza Twój telefon i Twoje konto.</Text>
          <TouchableOpacity style={s.accessBtn} onPress={() => { haptic.tap(); openScreenAccess(); }}>
            <Text style={s.accessBtnTxt}>Otwórz ustawienia dostępu</Text>
          </TouchableOpacity>
        </View>
      ) : !d ? (
        <Info icon text={android ? 'Zbieram dane… za chwilę pojawi się dzisiejszy dzień.' : 'Dane przychodzą z telefonu — otwórz SOEN na telefonie (z dostępem do danych o użyciu).'} />
      ) : (
        <DayView d={d} days={days} now={now} isToday={isToday} />
      )}
    </AppBottomSheet>
  );
}

function Info({ text }: { text: string; icon?: boolean }) {
  const s = makeS();
  return (
    <View style={s.accessCard}>
      <Smartphone size={22} color={colors.text.muted} />
      <Text style={s.accessTxt}>{text}</Text>
    </View>
  );
}

function DayView({ d, days, now, isToday }: { d: ScreenDay; days: Record<string, ScreenDay>; now: Date; isToday: boolean }) {
  const s = makeS();
  const vs = isToday ? vsUsual(days, now) : null;
  const avg = avgBefore(days, isToday ? now : new Date(`${d.date}T12:00:00`));
  const peak = peakHour(d);
  const night = nightMinutes(d);
  const cats = byCategory(d.apps);
  const catTotal = cats.reduce((a, c) => a + c.m, 0) || 1;
  const week = lastScreenDays(days, isToday ? now : new Date(`${d.date}T12:00:00`), 7);
  const weekMax = Math.max(1, ...week.map((w) => w.d?.total ?? 0));
  const hourMax = Math.max(1, ...d.hours);
  const appMax = Math.max(1, ...d.apps.map((a) => a.m));
  const [showAll, setShowAll] = useState(false);
  const apps = showAll ? d.apps : d.apps.slice(0, 8);

  return (
    <>
      <View style={s.hero}>
        <Text style={s.big}>{fmtDur(d.total)}</Text>
        {vs ? (
          <Text style={[s.heroSub, { color: vs.pct > 10 ? colors.accent.orange : vs.pct < -10 ? colors.accent.green : colors.text.muted }]}>
            {vs.pct > 0 ? '▲' : vs.pct < 0 ? '▼' : '●'} {Math.abs(vs.pct)}% {vs.pct >= 0 ? 'więcej' : 'mniej'} niż zwykle do tej pory ({fmtDur(vs.usual)})
          </Text>
        ) : avg ? (
          <Text style={s.heroSub}>średnio {fmtDur(avg.total)} dziennie (ostatnie {avg.days} dni)</Text>
        ) : null}
      </View>

      <View style={s.grid}>
        <Fact Icon={LockOpen} l="Odblokowania" v={String(d.unlocks)} sub={avg ? `śr. ${Math.round(avg.unlocks)}` : undefined} />
        <Fact Icon={Smartphone} l="Włączenia ekranu" v={String(d.screenOns)} sub={d.total && d.unlocks ? `~${Math.max(1, Math.round(d.total / d.unlocks))} min na odblok.` : undefined} />
        <Fact Icon={Sun} l="Pierwsze odblokowanie" v={d.first ?? '—'} />
        <Fact Icon={Timer} l="Najdłużej bez przerwy" v={d.longest ? fmtDur(d.longest.m) : '—'} sub={d.longest?.l} />
        <Fact Icon={Flame} l="Najwięcej" v={peak && peak.m > 0 ? `${peak.h}:00–${peak.h + 1}:00` : '—'} sub={peak && peak.m > 0 ? fmtDur(peak.m) : undefined} />
        <Fact Icon={Moon} l="W nocy (0–6)" v={fmtDur(night)} color={night >= 30 ? colors.accent.orange : undefined} />
      </View>

      <SheetCard title="W ciągu dnia">
        <View style={s.hours}>
          {d.hours.map((m, h) => (
            <View key={h} style={s.hourCol}>
              <View style={[s.hourBar, { height: Math.max(2, (m / hourMax) * 64), backgroundColor: m === 0 ? colors.ui.in2 : peak?.h === h ? colors.text.bright : colors.text.secondary }]} />
            </View>
          ))}
        </View>
        <View style={s.hourAxis}>
          {[0, 6, 12, 18, 24].map((h) => <Text key={h} style={s.axis}>{h}</Text>)}
        </View>
      </SheetCard>

      {cats.length > 0 && (
        <SheetCard title="Na co idzie czas">
          <View style={s.stack}>
            {cats.map((c) => <View key={c.cat} style={{ flex: c.m / catTotal, backgroundColor: CAT_COLOR[c.cat] }} />)}
          </View>
          <View style={s.catList}>
            {cats.slice(0, 6).map((c) => (
              <View key={c.cat} style={s.catRow}>
                <View style={[s.catDot, { backgroundColor: CAT_COLOR[c.cat] }]} />
                <Text style={s.catName}>{CAT_LABEL[c.cat]}</Text>
                <Text style={s.catPct}>{Math.round((c.m / catTotal) * 100)}%</Text>
                <Text style={s.catVal}>{fmtDur(c.m)}</Text>
              </View>
            ))}
          </View>
        </SheetCard>
      )}

      <SheetCard title="Aplikacje" right={<Text style={s.cardRight}>{d.apps.filter((a) => a.m > 0).length} użytych</Text>}>
        {apps.map((a) => <AppRow key={a.p} a={a} max={appMax} />)}
        {d.apps.length > 8 && (
          <TouchableOpacity onPress={() => { haptic.tap(); setShowAll((v) => !v); }} style={s.more}>
            <Text style={s.moreTxt}>{showAll ? 'Pokaż mniej' : `Pokaż wszystkie (${d.apps.length})`}</Text>
          </TouchableOpacity>
        )}
      </SheetCard>

      <SheetCard title="Ostatnie 7 dni" right={<Legend items={[{ color: colors.text.secondary, label: 'czas' }]} />}>
        <View style={s.week}>
          {week.map((w) => {
            const on = w.date === d.date;
            const v = w.d?.total ?? 0;
            return (
              <View key={w.date} style={s.weekCol}>
                <Text style={[s.weekVal, on && { color: colors.text.bright }]} numberOfLines={1}>{v ? fmtDur(v).replace(' min', 'm').replace(' h', 'h') : '—'}</Text>
                <View style={s.weekTrack}>
                  <View style={[s.weekBar, { height: Math.max(3, (v / weekMax) * 70), backgroundColor: on ? colors.text.bright : colors.ui.in2 }]} />
                </View>
                <Text style={[s.weekDay, on && { color: colors.text.bright }]}>{WD[new Date(`${w.date}T12:00:00`).getDay()]}</Text>
                <Text style={s.weekUnl}>{w.d ? `${w.d.unlocks}×` : ''}</Text>
              </View>
            );
          })}
        </View>
      </SheetCard>

      <Text style={s.note}>Liczony jest czas, gdy appka była na ekranie (bez ekranu głównego). Odblokowania = ile razy telefon został odblokowany; liczby pod tygodniem to odblokowania danego dnia. Zależność czasu z telefonem od humoru znajdziesz w statystykach humoru.</Text>
    </>
  );
}

function AppRow({ a, max }: { a: ScreenApp; max: number }) {
  const s = makeS();
  const icon = useAppIconsStore((st) => st.icons[a.p]);
  const cat = catOf(a);
  return (
    <View style={s.appRow}>
      {icon ? <Image source={{ uri: icon }} style={s.appIcon} /> : (
        <View style={[s.appIcon, s.appInitial, { backgroundColor: CAT_COLOR[cat] + '33' }]}>
          <Text style={[s.appInitialTxt, { color: CAT_COLOR[cat] }]}>{(a.l || a.p).slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.appTop}>
          <Text style={s.appName} numberOfLines={1}>{a.l}</Text>
          <Text style={s.appVal}>{fmtDur(a.m)}</Text>
        </View>
        <View style={s.appTrack}><View style={[s.appFill, { width: `${Math.max(2, (a.m / max) * 100)}%`, backgroundColor: CAT_COLOR[cat] }]} /></View>
        <Text style={s.appSub} numberOfLines={1}>{CAT_LABEL[cat]}{a.n ? ` · otwarta ${a.n}×` : ''}</Text>
      </View>
    </View>
  );
}

function Fact({ Icon, l, v, sub, color }: { Icon: any; l: string; v: string; sub?: string; color?: string }) {
  const s = makeS();
  return (
    <View style={s.fact}>
      <View style={s.factHead}><Icon size={11} color={colors.text.muted} /><Text style={s.factL} numberOfLines={1}>{l}</Text></View>
      <Text style={[s.factV, color ? { color } : null]} numberOfLines={1}>{v}</Text>
      {sub ? <Text style={s.factSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing[2] },
  title: { flex: 1, fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.bright },
  dayNav: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.ui.in, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 5 },
  dayTxt: { minWidth: 84, textAlign: 'center', fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  hero: { paddingVertical: spacing[2] },
  big: { fontSize: 38, lineHeight: 42, fontFamily: 'Inter_900Black', color: c.text.bright, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  heroSub: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fact: { flexGrow: 1, flexBasis: '45%', backgroundColor: c.ui.in, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 10 },
  factHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  factL: { flex: 1, fontSize: 9.5, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  factV: { fontSize: 15, fontFamily: 'Inter_900Black', color: c.text.primary, marginTop: 3, fontVariant: ['tabular-nums'] },
  factSub: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 1 },
  hours: { flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 2 },
  hourCol: { flex: 1, justifyContent: 'flex-end', height: 64 },
  hourBar: { borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  hourAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axis: { fontSize: 9.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  stack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  catList: { marginTop: spacing[2], gap: 6 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catDot: { width: 8, height: 8, borderRadius: 2 },
  catName: { flex: 1, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  catPct: { width: 38, textAlign: 'right', fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, fontVariant: ['tabular-nums'] },
  catVal: { width: 78, textAlign: 'right', fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary, fontVariant: ['tabular-nums'] },
  cardRight: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  appIcon: { width: 30, height: 30, borderRadius: 8 },
  appInitial: { alignItems: 'center', justifyContent: 'center' },
  appInitialTxt: { fontSize: 13, fontFamily: 'Inter_900Black' },
  appTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  appName: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  appVal: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary, fontVariant: ['tabular-nums'] },
  appTrack: { height: 4, borderRadius: 2, backgroundColor: c.ui.in2, marginTop: 4, overflow: 'hidden' },
  appFill: { height: '100%', borderRadius: 2 },
  appSub: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 3 },
  more: { alignItems: 'center', paddingTop: spacing[2] },
  moreTxt: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  week: { flexDirection: 'row', gap: 4 },
  weekCol: { flex: 1, alignItems: 'center' },
  weekVal: { fontSize: 9.5, fontFamily: 'Inter_700Bold', color: c.text.muted, marginBottom: 3 },
  weekTrack: { height: 70, justifyContent: 'flex-end', width: '70%' },
  weekBar: { borderTopLeftRadius: 3, borderTopRightRadius: 3, width: '100%' },
  weekDay: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, marginTop: 4 },
  weekUnl: { fontSize: 9.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  accessCard: { backgroundColor: c.ui.in, borderRadius: radius.lg, padding: spacing[4], alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  accessTitle: { fontSize: 15, fontFamily: 'Inter_900Black', color: c.text.bright, textAlign: 'center' },
  accessTxt: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold', color: c.text.muted, textAlign: 'center' },
  accessBtn: { marginTop: spacing[1], backgroundColor: c.text.primary, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10 },
  accessBtnTxt: { fontSize: 13, fontFamily: 'Inter_900Black', color: '#000' },
  note: { fontSize: 10.5, lineHeight: 15, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[3] },
}));
