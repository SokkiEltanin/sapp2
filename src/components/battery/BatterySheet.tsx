import { useMemo } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import Svg, { Polyline, Polygon, Line } from 'react-native-svg';
import { Smartphone, Watch, Laptop, Zap, Thermometer } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useDeviceBatteryStore } from '@/store/deviceBatteryStore';
import { analyzeBattery, ageLabel, tempTone, type BatSample } from '@/utils/deviceBattery';

// Szczegóły baterii (2026-11-17, user: "klikam → zakładka z całym info: ile, kiedy ostatnio
// ładowane, kiedy ostatni odczyt, temperatura i wykresy, czy się grzeje, zużycie od
// ostatniego ładowania"). Dane: historia z natywnego BatteryLog (telefon dopisuje zegarek
// co ~15 min i siebie), na komputerze z chmury. Analiza: utils/deviceBattery.ts.
type Now = { level: number; charging: boolean; t?: number; temp?: number } | null;

const TONE = { ok: colors.text.primary, warm: colors.accent.orange, hot: colors.accent.red };
const fmtH = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} dni`);
const hm = (t: number) => new Date(t).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
const dayHm = (t: number) => {
  const d = new Date(t); const today = new Date();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const day = d.toDateString() === today.toDateString() ? 'dziś' : d.toDateString() === y.toDateString() ? 'wczoraj' : d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  return `${day} ${hm(t)}`;
};

export default function BatterySheet({ visible, onClose, phone, watch, laptop }: {
  visible: boolean; onClose: () => void; phone: Now; watch: Now; laptop?: Now;
}) {
  const s = makeS();
  const phoneLog = useDeviceBatteryStore((st) => st.phoneLog);
  const watchLog = useDeviceBatteryStore((st) => st.watchLog);
  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.92} header={<Text style={s.title}>Baterie</Text>}>
      {Platform.OS === 'web' && laptop && <Device name="Komputer" icon="laptop" now={laptop} log={[]} />}
      <Device name="Telefon" icon="phone" now={phone} log={phoneLog} />
      <Device name="Zegarek" icon="watch" now={watch} log={watchLog} />
      <Text style={s.note}>Historia zbiera się sama co ~15 min (przy raportach zegarka) i przy każdej zmianie poziomu, gdy appka jest otwarta — wykresy wypełnią się w ciągu kilku godzin. Temperatura: do 38 °C w normie, 38–42 °C ciepło, ponad 42 °C gorąco.</Text>
    </AppBottomSheet>
  );
}

function Device({ name, icon, now, log }: { name: string; icon: 'phone' | 'watch' | 'laptop'; now: Now; log: BatSample[] }) {
  const s = makeS();
  const Icon = icon === 'phone' ? Smartphone : icon === 'watch' ? Watch : Laptop;
  const a = useMemo(() => analyzeBattery(log), [log]);
  const last24 = useMemo(() => log.filter((x) => Date.now() - x.t <= 24 * 3600000), [log]);
  const levelPts = (a.sinceCharge.length >= 2 ? a.sinceCharge : last24).map((x) => ({ t: x.t, v: x.l }));
  const tempPts = last24.filter((x) => x.tp != null).map((x) => ({ t: x.t, v: x.tp! }));
  const temp = now?.temp ?? a.tempNow;
  const level = now?.level ?? log.at(-1)?.l ?? null;
  const charging = now?.charging ?? log.at(-1)?.c ?? false;
  const readAt = now?.t ?? log.at(-1)?.t ?? null;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Icon size={18} color={colors.text.primary} />
        <Text style={s.name}>{name}</Text>
        {charging && <View style={s.charge}><Zap size={11} color="#4ADE80" fill="#4ADE80" /><Text style={s.chargeTxt}>ładuje</Text></View>}
        <Text style={s.big}>{level != null ? `${level}%` : '—'}</Text>
      </View>

      {icon !== 'laptop' && <View style={s.grid}>
        <Fact l="Ostatni odczyt" v={readAt ? ageLabel(readAt) : '—'} />
        <Fact l={a.chargingSince ? 'Ładuje się od' : 'Ostatnio ładowany'}
          v={a.chargingSince ? dayHm(a.chargingSince) : a.chargedAt ? `${ageLabel(a.chargedAt)}${a.chargedTo != null ? ` · do ${a.chargedTo}%` : ''}` : charging ? 'teraz' : 'brak w historii'} />
        <Fact l="Zużycie od ładowania" v={a.drainPerHour != null ? `${a.drainPerHour} %/h` : '—'} sub={a.hoursLeft != null ? `starczy na ~${fmtH(a.hoursLeft)}` : undefined} />
        <Fact l="Temperatura" v={temp != null ? `${temp.toFixed(1)} °C` : '—'} color={temp != null ? TONE[tempTone(temp)] : undefined}
          sub={a.tempMax24h != null ? `max 24 h: ${a.tempMax24h.toFixed(1)} °C` : undefined} />
      </View>}

      {levelPts.length >= 2 && (
        <>
          <Text style={s.chartLabel}>{a.sinceCharge.length >= 2 ? 'Poziom od ostatniego ładowania' : 'Poziom — ostatnie 24 h'}</Text>
          <Chart pts={levelPts} min={0} max={100} unit="%" color={icon === 'watch' ? '#A78BFA' : '#60A5FA'} />
        </>
      )}
      {tempPts.length >= 2 && (
        <>
          <View style={s.chartHead}><Thermometer size={12} color={colors.text.muted} /><Text style={s.chartLabel}>Temperatura — ostatnie 24 h</Text></View>
          <Chart pts={tempPts} min={Math.min(25, ...tempPts.map((p) => p.v))} max={Math.max(45, ...tempPts.map((p) => p.v))} unit="°" color={colors.accent.orange} mark={42} />
        </>
      )}
      {levelPts.length < 2 && icon !== 'laptop' && <Text style={s.empty}>Wykresy pojawią się, gdy zbierze się kilka odczytów.</Text>}
    </View>
  );
}

function Fact({ l, v, sub, color }: { l: string; v: string; sub?: string; color?: string }) {
  const s = makeS();
  return (
    <View style={s.fact}>
      <Text style={s.factL}>{l}</Text>
      <Text style={[s.factV, color ? { color } : null]} numberOfLines={1}>{v}</Text>
      {sub ? <Text style={s.factSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

// Prosty wykres liniowy (oś czasu = rzeczywisty czas próbek) + linia ostrzegawcza `mark`.
function Chart({ pts, min, max, unit, color, mark }: { pts: { t: number; v: number }[]; min: number; max: number; unit: string; color: string; mark?: number }) {
  const s = makeS();
  const { width: winW } = useWindowDimensions();
  const W = Math.min(winW, 560) - spacing[4] * 2 - spacing[3] * 2 - 40;
  const H = 90;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * W;
  const y = (v: number) => H - ((v - min) / Math.max(1, max - min)) * H;
  const line = pts.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `0,${H} ${line} ${W.toFixed(1)},${H}`;
  return (
    <View style={s.chart}>
      <View style={[s.yAxis, { height: H }]}>
        <Text style={s.axis}>{Math.round(max)}{unit}</Text>
        <Text style={s.axis}>{Math.round(min)}{unit}</Text>
      </View>
      <View>
        <Svg width={W} height={H}>
          <Line x1={0} y1={0} x2={W} y2={0} stroke={colors.ui.line} strokeWidth={1} />
          <Line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke={colors.ui.line} strokeWidth={1} strokeDasharray="3,4" />
          <Line x1={0} y1={H} x2={W} y2={H} stroke={colors.ui.line} strokeWidth={1} />
          {mark != null && mark > min && mark < max && <Line x1={0} y1={y(mark)} x2={W} y2={y(mark)} stroke={colors.accent.red} strokeWidth={1} strokeDasharray="4,4" opacity={0.6} />}
          <Polygon points={area} fill={color} opacity={0.15} />
          <Polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
        <View style={s.xAxis}>
          <Text style={s.axis}>{dayHm(t0)}</Text>
          <Text style={s.axis}>{hm(t1)}</Text>
        </View>
      </View>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.bright, paddingBottom: spacing[2] },
  card: { backgroundColor: c.bg.primary, borderRadius: radius.lg, padding: spacing[3], marginBottom: spacing[3], gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  name: { flex: 1, fontSize: 15, fontFamily: 'Inter_900Black', color: c.text.primary },
  charge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(74,222,128,0.14)' },
  chargeTxt: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: '#4ADE80' },
  big: { fontSize: 24, fontFamily: 'Inter_900Black', color: c.text.bright, fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fact: { flexGrow: 1, flexBasis: '45%', backgroundColor: c.bg.card, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 10 },
  factL: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  factV: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.text.primary, marginTop: 2 },
  factSub: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 1 },
  chartHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chartLabel: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 },
  chart: { flexDirection: 'row', gap: 4 },
  yAxis: { width: 34, justifyContent: 'space-between' },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  axis: { fontSize: 9.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  empty: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  note: { fontSize: 10.5, lineHeight: 15, fontFamily: 'Inter_500Medium', color: c.text.muted },
}));
