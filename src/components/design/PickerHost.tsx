import FitText from '@/ui/FitText';
import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { usePicker, resolvePicker, monthGrid, dayAllowed } from '@/services/picker';
import { haptic } from '@/utils/haptics';

// Własny picker daty/godziny (services/picker.ts) — zamiast systemowego dialogu
// Androida. Data: kalendarz miesiąca od poniedziałku; godzina: siatka 24 h + minuty
// co 5 z dokładnym ±1. Po polsku, w czarnym motywie appki.
const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const WD = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const pad = (n: number) => String(n).padStart(2, '0');

export default function PickerHost() {
  const req = usePicker((st) => st.req);
  const s = makeS();
  const { width } = useWindowDimensions();
  const [val, setVal] = useState(() => new Date());
  const [view, setView] = useState({ y: 2026, m: 0 });

  useEffect(() => {
    if (!req) return;
    const v = new Date(req.value.getTime());
    setVal(v);
    setView({ y: v.getFullYear(), m: v.getMonth() });
  }, [req?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!req) return null;
  const isTime = req.mode === 'time';
  const cardW = Math.min(360, width - 32);
  const cell = Math.floor((cardW - spacing[4] * 2) / 7);
  const today = new Date();

  const setDay = (d: number) => {
    const n = new Date(val); n.setFullYear(view.y, view.m, d);
    if (!dayAllowed(n, req.minimumDate, req.maximumDate)) return;
    haptic.tap(); setVal(n);
  };
  const shiftMonth = (k: number) => {
    haptic.tap();
    setView((v) => { const d = new Date(v.y, v.m + k, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  };
  const setHM = (h: number, m: number) => { const n = new Date(val); n.setHours(h, ((m % 60) + 60) % 60, 0, 0); setVal(n); };
  const jumpNow = () => {
    haptic.tap();
    const n = new Date(val);
    if (isTime) n.setHours(today.getHours(), today.getMinutes(), 0, 0);
    else n.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
    if (!isTime && !dayAllowed(n, req.minimumDate, req.maximumDate)) return;
    setVal(n); setView({ y: n.getFullYear(), m: n.getMonth() });
  };
  const ok = () => { haptic.success(); resolvePicker(val); };
  const cancel = () => { haptic.tap(); resolvePicker(null); };

  const head = isTime
    ? `${pad(val.getHours())}:${pad(val.getMinutes())}`
    : val.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={cancel} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={cancel}>
        <Pressable style={[s.card, { width: cardW }]} onPress={() => {}}>
          <Text style={s.kicker}>{req.title ?? (isTime ? 'Wybierz godzinę' : `Wybierz datę · ${val.getFullYear()}`)}</Text>
          {isTime ? (
            <View style={s.timeHead}>
              <TouchableOpacity style={s.fine} onPress={() => { haptic.tap(); setHM(val.getHours(), val.getMinutes() - 1); }} accessibilityLabel="Minuta wcześniej">
                <Minus size={16} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={s.bigTime}>{head}</Text>
              <TouchableOpacity style={s.fine} onPress={() => { haptic.tap(); setHM(val.getHours(), val.getMinutes() + 1); }} accessibilityLabel="Minuta później">
                <Plus size={16} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <FitText style={s.bigDate} numberOfLines={1}>{head}</FitText>
          )}

          {isTime ? (
            <>
              <Text style={s.label}>Godzina</Text>
              <View style={s.grid}>
                {Array.from({ length: 24 }, (_, h) => {
                  const on = val.getHours() === h;
                  return (
                    <TouchableOpacity key={h} style={[s.tchip, on && s.on]} onPress={() => { haptic.tap(); setHM(h, val.getMinutes()); }}>
                      <Text style={[s.tchipTxt, on && s.onTxt]}>{pad(h)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={s.label}>Minuty</Text>
              <View style={s.grid}>
                {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => {
                  const on = val.getMinutes() === m;
                  const near = !on && Math.floor(val.getMinutes() / 5) * 5 === m;
                  return (
                    <TouchableOpacity key={m} style={[s.tchip, on && s.on, near && s.near]} onPress={() => { haptic.tap(); setHM(val.getHours(), m); }}>
                      <Text style={[s.tchipTxt, on && s.onTxt]}>{pad(m)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <View style={s.monthRow}>
                <TouchableOpacity style={s.navBtn} onPress={() => shiftMonth(-1)} accessibilityLabel="Poprzedni miesiąc">
                  <ChevronLeft size={18} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={s.month}>{MONTHS[view.m]} {view.y}</Text>
                <TouchableOpacity style={s.navBtn} onPress={() => shiftMonth(1)} accessibilityLabel="Następny miesiąc">
                  <ChevronRight size={18} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
              <View style={s.week}>
                {WD.map((w, i) => <Text key={w} style={[s.wd, { width: cell }, i >= 5 && { color: colors.text.secondary }]}>{w}</Text>)}
              </View>
              {monthGrid(view.y, view.m).map((row, ri) => (
                <View key={ri} style={s.week}>
                  {row.map((d, ci) => {
                    if (!d) return <View key={ci} style={{ width: cell, height: cell - 4 }} />;
                    const date = new Date(view.y, view.m, d);
                    const on = date.toDateString() === val.toDateString();
                    const isToday = date.toDateString() === today.toDateString();
                    const allowed = dayAllowed(date, req.minimumDate, req.maximumDate);
                    return (
                      <TouchableOpacity key={ci} disabled={!allowed} onPress={() => setDay(d)} style={[s.day, { width: cell, height: cell - 4 }]}>
                        <View style={[s.dayDot, { width: cell - 8, height: cell - 8, borderRadius: (cell - 8) / 2 }, on && s.on, !on && isToday && s.todayRing]}>
                          <Text style={[s.dayTxt, on && s.onTxt, !allowed && { color: colors.border.default }]}>{d}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </>
          )}

          <View style={s.foot}>
            <TouchableOpacity onPress={jumpNow} style={s.ghost}>
              <Text style={s.ghostTxt}>{isTime ? 'Teraz' : 'Dziś'}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={cancel} style={s.ghost}>
              <Text style={s.ghostTxt}>Anuluj</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={ok} style={s.okBtn}>
              <Text style={s.okTxt}>OK</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: c.bg.card, borderRadius: radius.sheet, borderWidth: 1, borderColor: c.border.subtle, padding: spacing[4] },
  kicker: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  bigDate: { fontSize: 24, fontFamily: 'Inter_900Black', color: c.text.bright, marginTop: 4, marginBottom: spacing[3] },
  timeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: spacing[2] },
  bigTime: { fontSize: 48, fontFamily: 'Inter_900Black', color: c.text.bright, fontVariant: ['tabular-nums'] },
  fine: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[3], marginBottom: spacing[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tchip: { width: '15.1%', paddingVertical: 9, borderRadius: radius.md, backgroundColor: c.bg.primary, alignItems: 'center' },
  tchipTxt: { fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: c.text.primary, fontVariant: ['tabular-nums'] },
  near: { borderWidth: 1, borderColor: c.text.muted },
  on: { backgroundColor: c.text.bright },
  onTxt: { color: c.bg.primary },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  month: { fontSize: 15, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  navBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.primary },
  week: { flexDirection: 'row' },
  wd: { textAlign: 'center', fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, paddingVertical: 6 },
  day: { alignItems: 'center', justifyContent: 'center' },
  dayDot: { alignItems: 'center', justifyContent: 'center' },
  todayRing: { borderWidth: 1, borderColor: c.text.muted },
  dayTxt: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary, fontVariant: ['tabular-nums'] },
  foot: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[4] },
  ghost: { paddingHorizontal: spacing[3], paddingVertical: 10, borderRadius: radius.md },
  ghostTxt: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  okBtn: { paddingHorizontal: spacing[5], paddingVertical: 10, borderRadius: radius.md, backgroundColor: c.text.bright },
  okTxt: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },
}));
