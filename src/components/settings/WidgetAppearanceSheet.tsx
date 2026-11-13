import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Minus, Plus } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useWidgetSettingsStore, WIDGET_BG_COLORS, type WidgetTextScale } from '@/store/widgetSettingsStore';
import { useCalendarStore } from '@/store/calendarStore';
import { applyWidgetAppearance } from '@/services/widgetSync';
import { buildWidgetSnapshot } from '@/utils/widgetTasks';
import { haptic } from '@/utils/haptics';

// Ustawienia → Widget (2026-11-13, user: "ma ustawienia przezroczystości i w ogóle
// w ustawieniach tego widgetu?"). Podgląd na żywo na "tapecie" (gradient), te same
// wiersze co prawdziwy widget (buildWidgetSnapshot), każda zmiana od razu leci do
// widgetu na pulpicie (applyWidgetAppearance → natywne SharedPreferences).
const OPACITY_STEPS = [100, 75, 50, 25, 0];
const SCALES: { key: WidgetTextScale; label: string; mult: number }[] = [
  { key: 'small', label: 'Mały', mult: 0.85 },
  { key: 'medium', label: 'Średni', mult: 1 },
  { key: 'large', label: 'Duży', mult: 1.2 },
];
const SAMPLE = [
  { id: 'a', title: 'Zapłacić za internet', sub: 'Zaległe · wt.', color: '#EF4444', overdue: true },
  { id: 'b', title: 'Zakupy na weekend', sub: 'Dziś · 18:00', color: '#F2F2F2', overdue: false },
  { id: 'c', title: 'Wymiana oleju', sub: '20 lis', color: '#6E6E6E', overdue: false },
];

function hexA(hex: string, opacityPct: number): string {
  const a = Math.round((opacityPct / 100) * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

export default function WidgetAppearanceSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const { bgOpacity, bgColor, textScale, set } = useWidgetSettingsStore();
  const tasks = useCalendarStore((st) => st.tasks);
  const snap = useMemo(() => buildWidgetSnapshot(tasks), [tasks]);
  const rows = snap.rows.length ? snap.rows.slice(0, 4) : SAMPLE;
  const mult = SCALES.find((x) => x.key === textScale)?.mult ?? 1;

  const update = (patch: Partial<{ bgOpacity: number; bgColor: string; textScale: WidgetTextScale }>) => {
    haptic.tap();
    set(patch);
    const next = { bgOpacity, bgColor, textScale, ...patch };
    applyWidgetAppearance(next.bgOpacity, next.bgColor, next.textScale);
  };
  const step = (d: number) => update({ bgOpacity: Math.max(0, Math.min(100, Math.round((bgOpacity + d) / 5) * 5)) });

  return (
    <AppBottomSheet visible={visible} onClose={onClose}>
      <Text style={s.title}>Widgety: Zadania i Pogoda</Text>
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
          <Text style={[s.wHeader, { fontSize: 10 * mult }]}>{snap.rows.length ? snap.header : 'ZADANIA · 3 · 1 ZALEGŁE'}</Text>
          {rows.map((r) => (
            <View key={r.id} style={s.wRow}>
              <View style={s.wCheck} />
              <View style={[s.wDot, { backgroundColor: r.color }]} />
              <Text style={[s.wTitle, { fontSize: 13 * mult }]} numberOfLines={1}>{r.title}</Text>
              <Text style={[s.wSub, { fontSize: 10 * mult }, r.overdue && { color: '#EF4444' }]} numberOfLines={1}>{r.sub}</Text>
            </View>
          ))}
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
  widget: { borderRadius: 22, borderWidth: 1, padding: 12 },
  wHeader: { fontFamily: 'Inter_700Bold', color: '#6E6E6E', letterSpacing: 0.8, paddingBottom: 4 },
  wRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  wCheck: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#6E6E6E', marginRight: 8 },
  wDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  wTitle: { flex: 1, fontFamily: 'Inter_500Medium', color: '#F2F2F2' },
  wSub: { fontFamily: 'Inter_500Medium', color: '#6E6E6E', marginLeft: 6 },
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
