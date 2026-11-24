import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Linking, Modal, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight, Smartphone, Timer, Hourglass, X } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { SheetCard, Legend } from '@/components/design/SheetCard';
import DayChart from './DayChart';
import { useScreenTimeStore, useAppIconsStore } from '@/store/screenTimeStore';
import { useAppCategoryStore } from '@/store/appCategoryStore';
import { openScreenAccess, refreshScreenTime, screenTimeAvailable } from '@/services/screenTime';
import {
  fmtDur, byCategory, catOf, isFun, funMinutes, FUN_CATS, CAT_LABEL, CAT_COLOR, vsUsual, avgBefore, avgHours, lastScreenDays, ymd,
  type ScreenDay, type ScreenApp, type ScreenCat, type AppPrefs,
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
    <AppBottomSheet fixedHeight visible={visible} onClose={onClose} maxHeightRatio={0.92} header={
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
          {/* Android 13+ blokuje ten dostęp appkom z pliku APK (2026-11-22, zrzut usera
              "App was denied access / Controlled by restricted setting"). */}
          <Text style={s.accessHow}>Przełącznik szary i „App was denied access”? Android blokuje to appkom z pliku APK. Zrób raz: Ustawienia → Aplikacje → SOEN → ⋮ (prawy górny róg) → „Zezwól na ustawienia z ograniczeniami” (Allow restricted settings) → potwierdź PIN-em. Potem wróć tutaj i włącz przełącznik.</Text>
          <TouchableOpacity onPress={() => { haptic.tap(); Linking.openSettings().catch(() => {}); }} hitSlop={8}>
            <Text style={s.accessLink}>Otwórz informacje o aplikacji SOEN</Text>
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
  const prefCats = useAppCategoryStore((st) => st.cats);
  const prefFun = useAppCategoryStore((st) => st.fun);
  const prefs = useMemo<AppPrefs>(() => ({ cats: prefCats, fun: prefFun }), [prefCats, prefFun]);
  const [editApp, setEditApp] = useState<ScreenApp | null>(null);
  const vs = isToday ? vsUsual(days, now) : null;
  const avg = avgBefore(days, isToday ? now : new Date(`${d.date}T12:00:00`));
  const usual = useMemo(() => avgHours(days, isToday ? now : new Date(`${d.date}T12:00:00`)), [days, d.date, isToday, now]);
  const [hourSel, setHourSel] = useState<number | null>(null);
  useEffect(() => { setHourSel(null); }, [d.date]);
  const cats = byCategory(d.apps, prefs);
  const fun = funMinutes(d, prefs);
  const opens = d.apps.reduce((a, x) => a + x.n, 0);
  const catTotal = cats.reduce((a, c) => a + c.m, 0) || 1;
  const week = lastScreenDays(days, isToday ? now : new Date(`${d.date}T12:00:00`), 7);
  const weekMax = Math.max(1, ...week.map((w) => w.d?.total ?? 0));
  const appMax = Math.max(1, ...d.apps.map((a) => a.m));
  const [showAll, setShowAll] = useState(false);
  const apps = showAll ? d.apps : d.apps.slice(0, 8);

  return (
    <>
      <View style={s.hero}>
        <Text style={s.big}>{fmtDur(d.total)}</Text>
        {/* kiedy odczytano (2026-11-22, user: "ostatnio zaczytane z datą zaczytania") */}
        <Text style={s.readAt}>{isToday ? 'stan na' : 'odczyt'} {new Date(d.t).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{Platform.OS === 'web' ? ' · z telefonu' : ''}</Text>
        {vs ? (
          <Text style={[s.heroSub, { color: vs.pct > 10 ? colors.accent.orange : vs.pct < -10 ? colors.accent.green : colors.text.muted }]}>
            {vs.pct > 0 ? '▲' : vs.pct < 0 ? '▼' : '●'} {Math.abs(vs.pct)}% {vs.pct >= 0 ? 'więcej' : 'mniej'} niż zwykle do tej pory ({fmtDur(vs.usual)})
          </Text>
        ) : avg ? (
          <Text style={s.heroSub}>średnio {fmtDur(avg.total)} dziennie (ostatnie {avg.days} dni)</Text>
        ) : null}
      </View>

      {/* Najważniejsze 3 liczby w jednym pasku (2026-11-22, user: "za dużo kafelków,
          nieczytelne") — reszta jako lista "Szczegóły dnia" pod wykresem. */}
      <View style={s.strip}>
        <Stat l="Odblokowania" v={String(d.unlocks)} sub={avg ? `śr. ${Math.round(avg.unlocks)}` : undefined} />
        <View style={s.stripSep} />
        <Stat l="Rozrywka" v={fmtDur(fun)} sub={d.total ? `${Math.round((fun / d.total) * 100)}% czasu` : undefined} />
        <View style={s.stripSep} />
        <Stat l="Otwarcia appek" v={String(opens)} sub={d.unlocks ? `~${Math.max(1, Math.round(opens / d.unlocks))} na odblok.` : undefined} />
      </View>

      {/* Doba (2026-11-22): szczyt, noc, pierwsze odblokowanie, "teraz" i "zwykle" NA wykresie —
          bez osobnych wierszy pod spodem; zostają tylko dwie liczby o sesjach. */}
      <SheetCard title="W ciągu dnia" right={hourSel != null ? (
        <Text style={s.hourSel} numberOfLines={1}>{hourSel}–{hourSel + 1} · {fmtDur(d.hours[hourSel])}{d.unlockHours ? ` · ${d.unlockHours[hourSel]}× odbl.` : ''}{usual ? ` · zwykle ${Math.round(usual[hourSel])}` : ''}</Text>
      ) : <Text style={s.cardRight}>stuknij słupek</Text>}>
        <DayChart d={d} usual={usual} isToday={isToday} now={now} sel={hourSel} onSelect={setHourSel} />
        <View style={s.sessRow}>
          <View style={s.sess}>
            <Timer size={13} color={colors.text.muted} />
            <Text style={s.sessTxt} numberOfLines={1}>najdłużej <Text style={s.sessV}>{d.longest ? fmtDur(d.longest.m) : '—'}</Text>{d.longest ? ` · ${d.longest.l}` : ''}</Text>
          </View>
          <View style={s.sess}>
            <Hourglass size={13} color={colors.text.muted} />
            <Text style={s.sessTxt} numberOfLines={1}><Text style={s.sessV}>{d.total && d.unlocks ? `~${Math.max(1, Math.round(d.total / d.unlocks))} min` : '—'}</Text> na odblok. · ekran {d.screenOns}×</Text>
          </View>
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

      <SheetCard title="Aplikacje" right={<Text style={s.cardRight}>stuknij = kategoria</Text>}>
        {apps.map((a) => <AppRow key={a.p} a={a} max={appMax} prefs={prefs} onPress={() => setEditApp(a)} />)}
        {d.apps.length > 8 && (
          <TouchableOpacity onPress={() => { haptic.tap(); setShowAll((v) => !v); }} style={s.more}>
            <Text style={s.moreTxt}>{showAll ? 'Pokaż mniej' : `Pokaż wszystkie (${d.apps.length})`}</Text>
          </TouchableOpacity>
        )}
      </SheetCard>

      <AppCatPanel app={editApp} prefs={prefs} onClose={() => setEditApp(null)} />

      <SheetCard title="Ostatnie 7 dni" right={<Legend items={[{ color: colors.text.secondary, label: 'czas' }]} />}>
        <View style={s.week}>
          {week.map((w) => {
            const on = w.date === d.date;
            const v = w.d?.total ?? 0;
            return (
              <View key={w.date} style={s.weekCol}>
                <Text style={[s.weekVal, on && { color: colors.text.bright }]} numberOfLines={1}>{v ? fmtDur(v).replace(' min', 'm').replace(' h', 'h') : '—'}</Text>
                <View style={s.weekTrack}>
                  <View style={[s.weekBar, { height: Math.max(3, (v / weekMax) * 70), backgroundColor: on ? colors.text.bright : colors.text.secondary, opacity: on ? 1 : 0.45 }]} />
                </View>
                <Text style={[s.weekDay, on && { color: colors.text.bright }]}>{WD[new Date(`${w.date}T12:00:00`).getDay()]}</Text>
                <Text style={s.weekUnl}>{w.d ? `${w.d.unlocks}×` : ''}</Text>
              </View>
            );
          })}
        </View>
      </SheetCard>

      <Text style={s.note}>Liczony czas, gdy appka była na ekranie (bez ekranu głównego). Pod tygodniem — odblokowania danego dnia.</Text>
    </>
  );
}

function AppRow({ a, max, prefs, onPress }: { a: ScreenApp; max: number; prefs: AppPrefs; onPress: () => void }) {
  const s = makeS();
  const icon = useAppIconsStore((st) => st.icons[a.p]);
  const cat = catOf(a, prefs);
  const fun = isFun(a, prefs);
  return (
    <TouchableOpacity style={s.appRow} onPress={() => { haptic.tap(); onPress(); }} activeOpacity={0.7} accessibilityLabel={`${a.l} — zmień kategorię`}>
      {icon ? <Image source={{ uri: icon }} style={s.appIcon} /> : (
        <View style={[s.appIcon, s.appInitial]}>
          <Text style={s.appInitialTxt}>{(a.l || a.p).slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.appTop}>
          <Text style={s.appName} numberOfLines={1}>{a.l}</Text>
          <Text style={s.appVal}>{fmtDur(a.m)}</Text>
        </View>
        <View style={s.appTrack}><View style={[s.appFill, { width: `${Math.max(2, (a.m / max) * 100)}%` }]} /></View>
        <Text style={s.appSub} numberOfLines={1}>{CAT_LABEL[cat]}{fun ? ' · rozrywka' : ''}{a.n ? ` · otwarta ${a.n}×` : ''}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Kategoria appki i "rozrywka tak/nie" (2026-11-22, user: "oznaczyć aplikacje, które to rozrywka,
// bo niektóre może źle łapać"). Zapis: store/appCategoryStore.ts (sync z komputerem).
const CAT_ORDER: ScreenCat[] = ['social', 'chat', 'video', 'audio', 'games', 'web', 'work', 'maps', 'photo', 'news', 'other'];
function AppCatPanel({ app, prefs, onClose }: { app: ScreenApp | null; prefs: AppPrefs; onClose: () => void }) {
  const s = makeS();
  const setCat = useAppCategoryStore((st) => st.setCat);
  const setFun = useAppCategoryStore((st) => st.setFun);
  const icon = useAppIconsStore((st) => (app ? st.icons[app.p] : undefined));
  // Popup (2026-11-22, user: "jak kliknę, to popup z edycją kategorii, a nie pod spodem — trzeba
  // scrollować bez sensu").
  return (
    <Modal visible={!!app} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.popBack} onPress={onClose}>
        {app && (() => {
          const cat = catOf(app, prefs);
          const fun = isFun(app, prefs);
          const auto = catOf(app);
          return (
            <Pressable style={s.pop} onPress={() => {}}>
              <View style={s.popHead}>
                {icon ? <Image source={{ uri: icon }} style={s.popIcon} /> : (
                  <View style={[s.popIcon, s.appInitial, { backgroundColor: CAT_COLOR[cat] + '33' }]}>
                    <Text style={[s.appInitialTxt, { color: CAT_COLOR[cat] }]}>{(app.l || app.p).slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.popTitle} numberOfLines={1}>{app.l}</Text>
                  <Text style={s.popSub} numberOfLines={1}>{fmtDur(app.m)}{app.n ? ` · otwarta ${app.n}×` : ''}</Text>
                </View>
                <TouchableOpacity onPress={() => { haptic.tap(); onClose(); }} style={s.popClose} hitSlop={8} accessibilityLabel="Zamknij">
                  <X size={16} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
              <Text style={s.popLabel}>Kategoria</Text>
              <View style={s.catChips}>
                {CAT_ORDER.map((c) => (
                  <TouchableOpacity key={c} onPress={() => { haptic.tap(); setCat(app.p, c === auto ? null : c); }}
                    style={[s.catChip, cat === c && { backgroundColor: CAT_COLOR[c] + '33', borderColor: CAT_COLOR[c] }]}>
                    <View style={[s.catDot, { backgroundColor: CAT_COLOR[c] }]} />
                    <Text style={[s.catChipTxt, cat === c && { color: colors.text.bright }]}>{CAT_LABEL[c]}{c === auto ? ' ·auto' : ''}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.funRow}>
                <Text style={s.funTxt}>Liczy się jako rozrywka</Text>
                {([true, false] as const).map((v) => (
                  <TouchableOpacity key={String(v)} onPress={() => { haptic.tap(); setFun(app.p, v === FUN_CATS.has(cat) ? null : v); }}
                    style={[s.funBtn, fun === v && s.funBtnOn]}>
                    <Text style={[s.funBtnTxt, fun === v && s.funBtnTxtOn]}>{v ? 'Tak' : 'Nie'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.hourNote}>Rozrywka domyślnie = społeczności, wideo i gry. Ustawienie liczy się też we wzorcach zachowań i na komputerze.</Text>
              <TouchableOpacity onPress={() => { haptic.tap(); onClose(); }} style={s.popDone}>
                <Text style={s.popDoneTxt}>Gotowe</Text>
              </TouchableOpacity>
            </Pressable>
          );
        })()}
      </Pressable>
    </Modal>
  );
}

function Stat({ l, v, sub }: { l: string; v: string; sub?: string }) {
  const s = makeS();
  return (
    <View style={s.stat}>
      <Text style={s.statL} numberOfLines={1}>{l}</Text>
      <Text style={s.statV} numberOfLines={1} adjustsFontSizeToFit>{v}</Text>
      {sub ? <Text style={s.statSub} numberOfLines={1}>{sub}</Text> : null}
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
  readAt: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 1 },
  heroSub: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted, marginTop: 2 },
  strip: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: c.ui.in, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 4 },
  stripSep: { width: 1, backgroundColor: c.ui.line, marginVertical: 2 },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  statL: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  statV: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.bright, marginTop: 2, fontVariant: ['tabular-nums'] },
  statSub: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 1 },
  popBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: spacing[4] },
  pop: { width: '100%', maxWidth: 420, backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[4], gap: 10, borderWidth: 1, borderColor: c.border.default },
  popHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  popIcon: { width: 40, height: 40, borderRadius: 10 },
  popTitle: { fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.bright },
  popSub: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 1 },
  popClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.ui.in },
  popLabel: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 4 },
  popDone: { alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, backgroundColor: c.text.bright, marginTop: 4 },
  popDoneTxt: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.bg.primary },
  hourSel: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.text.bright },
  sessRow: { gap: 6, marginTop: 12 },
  sess: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.ui.in2, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  sessTxt: { flex: 1, fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  sessV: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.text.primary },
  hourNote: { fontSize: 10, lineHeight: 14, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2] },
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
  appInitial: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.ui.in2 },
  appInitialTxt: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.text.secondary },
  appTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  appName: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  appVal: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary, fontVariant: ['tabular-nums'] },
  appTrack: { height: 4, borderRadius: 2, backgroundColor: c.ui.in2, marginTop: 4, overflow: 'hidden' },
  appFill: { height: '100%', borderRadius: 2, backgroundColor: c.text.secondary },
  appSub: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 3 },
  catChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  catChipTxt: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  funRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  funTxt: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  funBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  funBtnOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  funBtnTxt: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  funBtnTxtOn: { color: c.bg.primary },
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
  accessHow: { fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_600SemiBold', color: c.text.secondary, textAlign: 'center', marginTop: spacing[2] },
  accessLink: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.bright, textDecorationLine: 'underline' },
  accessBtnTxt: { fontSize: 13, fontFamily: 'Inter_900Black', color: '#000' },
  note: { fontSize: 10.5, lineHeight: 15, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[3] },
}));
