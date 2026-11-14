import { useNotesStore } from '@/store/notesStore';
import { buildNoteWidgetSnapshot } from '@/utils/widgetNote';
import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Minus, Plus } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useWidgetSettingsStore, WIDGET_BG_COLORS, type WidgetTextScale, type WidgetId, type WidgetLook } from '@/store/widgetSettingsStore';
import { useWeatherStore } from '@/store/weatherStore';
import { buildWeatherWidgetSnapshot } from '@/utils/widgetWeather';
import { useCalendarStore } from '@/store/calendarStore';
import { applyWidgetAppearance } from '@/services/widgetSync';
import { buildWidgetSnapshot } from '@/utils/widgetTasks';
import { haptic } from '@/utils/haptics';

// Ustawienia → Widget (2026-11-13, user: "ma ustawienia przezroczystości i w ogóle
// w ustawieniach tego widgetu?"). Podgląd na żywo na "tapecie" (gradient), te same
// wiersze co prawdziwy widget (buildWidgetSnapshot), każda zmiana od razu leci do
// widgetu na pulpicie (applyWidgetAppearance → natywne SharedPreferences).
// 2026-11-14: osobno Zadania i Pogoda (user: "rozdzielić ustawienia widgetów"),
// podgląd w kolorach jak na pulpicie (jaśniejsze szarości, odstęp 16 dp od krawędzi).
const OPACITY_STEPS = [100, 75, 50, 25, 0];
const SCALES: { key: WidgetTextScale; label: string; mult: number }[] = [
  { key: 'small', label: 'Mały', mult: 0.85 },
  { key: 'medium', label: 'Średni', mult: 1 },
  { key: 'large', label: 'Duży', mult: 1.2 },
];
const SAMPLE = [
  { id: 'a', title: 'Zapłacić za internet', sub: 'wt.', color: '#F87171', overdue: true },
  { id: 'b', title: 'Zakupy na weekend', sub: 'Dziś · 18:00', color: '#F2F2F2', overdue: false },
  { id: 'c', title: 'Wymiana oleju', sub: '20 lis', color: '#B5B5B5', overdue: false },
];

function hexA(hex: string, opacityPct: number): string {
  const a = Math.round((opacityPct / 100) * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

export default function WidgetAppearanceSheet({ visible, onClose, widget }: { visible: boolean; onClose: () => void; widget: WidgetId }) {
  const s = makeS();
  const look = useWidgetSettingsStore((st) => st[widget]);
  const { bgOpacity, bgColor, textScale } = look;
  const tasks = useCalendarStore((st) => st.tasks);
  const wx = useWeatherStore((st) => st.data);
  const loc = useWeatherStore((st) => st.location);
  const snap = useMemo(() => buildWidgetSnapshot(tasks), [tasks]);
  const pinned = useNotesStore((st) => st.notes.find((n) => n.pinned));
  const nsnap = useMemo(() => buildNoteWidgetSnapshot(pinned), [pinned]);
  const wsnap = useMemo(() => (wx && loc ? buildWeatherWidgetSnapshot(wx, loc.lat, loc.lon) : null), [wx, loc]);
  const rows = snap.rows.length ? snap.rows.slice(0, 4) : SAMPLE;
  const mult = SCALES.find((x) => x.key === textScale)?.mult ?? 1;

  const update = (patch: Partial<WidgetLook>) => {
    haptic.tap();
    useWidgetSettingsStore.getState().setLook(widget, patch);
    applyWidgetAppearance(widget, { ...look, ...patch });
  };
  const step = (d: number) => update({ bgOpacity: Math.max(0, Math.min(100, Math.round((bgOpacity + d) / 5) * 5)) });

  return (
    <AppBottomSheet visible={visible} onClose={onClose}>
      <Text style={s.title}>Widget {widget === 'tasks' ? 'Zadania' : widget === 'weather' ? 'Pogoda' : 'Notatka'}</Text>
      <Text style={s.hint}>Dodasz go z listy widgetów na pulpicie. Zmiany widać od razu.</Text>

      {/* Podgląd na "tapecie" */}
      <View style={s.preview}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#3B4D6E" />
              <Stop offset="0.55" stopColor="#6B4F63" />
              <Stop offset="1" stopColor="#B07A4F" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#wall)" />
        </Svg>
        <View style={[s.widget, { backgroundColor: hexA(bgColor, bgOpacity), borderColor: bgOpacity > 0 ? `rgba(255,255,255,${0.13 * bgOpacity / 100})` : 'transparent' }]}>
          {widget === 'note' ? (
            <>
              <Text style={[s.wHeader, { fontSize: 10 * mult }]}>{nsnap.title}</Text>
              {nsnap.text ? <Text style={[s.wTitle, { fontSize: 13 * mult, flex: 0 }]} numberOfLines={5}>{nsnap.text}</Text> : null}
              {nsnap.rows.slice(0, 5).map((r, i) => (
                <View key={i} style={s.wRow}>
                  <View style={[s.nBox, r.done && s.nBoxDone]} />
                  <Text style={[s.wTitle, { fontSize: 13 * mult }, r.done && { color: '#8A8A8A' }]} numberOfLines={1}>{r.text}</Text>
                </View>
              ))}
            </>
          ) : widget === 'tasks' ? (
            <>
              <Text style={[s.wHeader, { fontSize: 10 * mult }]}>{snap.rows.length ? snap.header : 'ZADANIA · 3 · 1 ZALEGŁE'}</Text>
              {rows.map((r) => (
                <View key={r.id} style={s.wRow}>
                  <View style={s.wCheck} />
                  <View style={[s.wDot, { backgroundColor: r.color }]} />
                  <Text style={[s.wTitle, { fontSize: 13 * mult }]} numberOfLines={1}>{r.title}</Text>
                  <Text style={[s.wSub, { fontSize: 10 * mult }, r.overdue && { color: '#F87171' }]} numberOfLines={1}>{r.sub}</Text>
                </View>
              ))}
            </>
          ) : (
            <>
              <Text style={[s.wHeader, { fontSize: 10 * mult }]}>{(wsnap?.place ?? 'POGODA').toUpperCase()}</Text>
              <View style={s.wxTop}>
                <View style={[s.wxIcon, { backgroundColor: wsnap?.color ?? '#FBBF24' }]} />
                <Text style={[s.wxTemp, { fontSize: 38 * mult }]}>{wsnap?.temp ?? '7°'}</Text>
                <View style={s.wxSide}>
                  <Text style={[s.wxLabel, { fontSize: 13 * mult }]} numberOfLines={1}>{wsnap?.label ?? 'Częściowe zachmurzenie'}</Text>
                  <Text style={[s.wxHilo, { fontSize: 12 * mult }]}>{wsnap ? `${wsnap.hi} / ${wsnap.lo}` : '9° / 2°'}</Text>
                </View>
              </View>
              <Text style={[s.wxLine, { fontSize: 12 * mult }, wsnap?.rain && { color: '#6C9EFF' }]} numberOfLines={1}>{wsnap?.line ?? 'Bez opadów do jutra'}</Text>
              <View style={s.wxHours}>
                {(wsnap?.hours ?? [{ t: '15', temp: '8°', pop: '', color: '#F5C451', icon: '' }, { t: '18', temp: '6°', pop: '20%', color: '#60A5FA', icon: '' }, { t: '21', temp: '4°', pop: '', color: '#A5B4FC', icon: '' }]).map((h) => (
                  <View key={h.t} style={s.wxHour}>
                    <Text style={[s.wxHt, { fontSize: 10 * mult }]}>{h.t}</Text>
                    <View style={[s.wxDot, { backgroundColor: h.color }]} />
                    <Text style={[s.wxHtemp, { fontSize: 12 * mult }]}>{h.temp}</Text>
                    <Text style={[s.wxHpop, { fontSize: 9.5 * mult }]}>{h.pop || ' '}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </View>

      <Text style={s.label}>Tło (krycie)</Text>
      <View style={s.opRow}>
        <TouchableOpacity style={s.stepBtn} onPress={() => step(-5)} accessibilityLabel="Bardziej przezroczyste">
          <Minus size={16} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={s.opVal}>{bgOpacity === 0 ? 'przezroczyste' : `${bgOpacity}%`}</Text>
        <TouchableOpacity style={s.stepBtn} onPress={() => step(5)} accessibilityLabel="Mniej przezroczyste">
          <Plus size={16} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
      <View style={s.chips}>
        {OPACITY_STEPS.map((v) => (
          <TouchableOpacity key={v} style={[s.chip, bgOpacity === v && s.chipOn]} onPress={() => update({ bgOpacity: v })} activeOpacity={0.8}>
            <Text style={[s.chipLabel, bgOpacity === v && s.chipLabelOn]}>{v === 100 ? 'Pełne' : v === 0 ? 'Brak' : `${v}%`}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Kolor tła</Text>
      <View style={s.chips}>
        {WIDGET_BG_COLORS.map((c) => (
          <TouchableOpacity key={c.key} style={[s.chip, s.colorChip, bgColor === c.key && s.chipOn]} onPress={() => update({ bgColor: c.key })} activeOpacity={0.8}>
            <View style={[s.swatch, { backgroundColor: c.key }]} />
            <Text style={[s.chipLabel, bgColor === c.key && s.chipLabelOn]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Wielkość tekstu</Text>
      <View style={s.chips}>
        {SCALES.map((x) => (
          <TouchableOpacity key={x.key} style={[s.chip, textScale === x.key && s.chipOn]} onPress={() => update({ textScale: x.key })} activeOpacity={0.8}>
            <Text style={[s.chipLabel, textScale === x.key && s.chipLabelOn]}>{x.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  hint: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
  preview: { marginTop: spacing[3], borderRadius: radius.lg, overflow: 'hidden', padding: spacing[4], minHeight: 170, justifyContent: 'center' },
  widget: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  wHeader: { fontFamily: 'Inter_700Bold', color: '#A3A3A3', letterSpacing: 0.8, paddingBottom: 4 },
  wRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  wCheck: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#8A8A8A', marginRight: 8 },
  wDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  wTitle: { flex: 1, fontFamily: 'Inter_500Medium', color: '#F2F2F2' },
  wSub: { fontFamily: 'Inter_500Medium', color: '#A3A3A3', marginLeft: 6 },
  nBox: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5, borderColor: '#8A8A8A', marginRight: 8 },
  nBoxDone: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  wxTop: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  wxIcon: { width: 30, height: 30, borderRadius: 15 },
  wxTemp: { fontFamily: 'Inter_800ExtraBold', color: '#F2F2F2', marginLeft: 8 },
  wxSide: { flex: 1, marginLeft: 10 },
  wxLabel: { fontFamily: 'Inter_700Bold', color: '#D6D6D6' },
  wxHilo: { fontFamily: 'Inter_500Medium', color: '#A7ADBD' },
  wxLine: { fontFamily: 'Inter_700Bold', color: '#A7ADBD' },
  wxHours: { flexDirection: 'row', marginTop: 8 },
  wxHour: { flex: 1, alignItems: 'center' },
  wxHt: { fontFamily: 'Inter_500Medium', color: '#A3A3A3' },
  wxDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  wxHtemp: { fontFamily: 'Inter_800ExtraBold', color: '#F2F2F2', marginTop: 2 },
  wxHpop: { fontFamily: 'Inter_500Medium', color: '#6C9EFF' },
  label: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing[4] },
  opRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[2] },
  stepBtn: { width: 40, height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.elevated },
  opVal: { minWidth: 110, textAlign: 'center', fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  chipOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  chipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  chipLabelOn: { color: c.bg.primary },
  colorChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
}));
