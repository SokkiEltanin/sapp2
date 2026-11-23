import { memo, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import PixelWeatherIcon from './PixelWeatherIcon';
import { Droplet } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { radius, themedStyles } from '@/theme';
import { weatherToneKey, WEATHER_TONES, fmtTemp, smoothPath, dayRainText, type WeatherDay } from '@/utils/weather';
import { haptic } from '@/utils/haptics';

// 7 dni jak 24 h (2026-11-22, user: "7 dni zrób jak są 24 h, tylko na tydzień, z wersją noc/dzień"):
// dzień tygodnia + ikona, DWIE krzywe — dzień (najcieplej, pomarańczowa, liczby nad) i noc
// (najzimniej, niebieska, liczby pod) — potem szansa opadu (słupek + %) i suma mm. Stuknięcie
// w dzień = pod wykresem opis: pogoda, temperatury i KIEDY pada (dayRainText — nic nie znika
// z poprzednich kafli dni). Mieści się bez przewijania (7 kolumn na szerokość karty).
const CURVE_H = 96;
const PAD = 18;   // miejsce na liczby nad krzywą dnia i pod krzywą nocy
const RAIN_H = 26;
const WD = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
const DAY_C = '#FB923C';
const NIGHT_C = '#818CF8';

const dayName = (iso: string, i: number) => {
  if (i === 0) return 'dziś';
  const [y, m, d] = iso.split('-').map(Number);
  return WD[new Date(y, m - 1, d).getDay()];
};

export default memo(function WeeklyChart({ days }: { days: WeatherDay[] }) {
  const s = makeS();
  const [w, setW] = useState(0);
  const [sel, setSel] = useState(0);
  const col = w > 0 ? w / Math.max(1, days.length) : 0;
  const geo = useMemo(() => {
    if (!col) return null;
    const all = days.flatMap((d) => [d.max, d.min]);
    const lo = Math.min(...all), hi = Math.max(...all);
    const span = Math.max(6, hi - lo);
    const mid = (lo + hi) / 2;
    const y = (t: number) => PAD + (CURVE_H - 2 * PAD) * (1 - ((t - mid) / span + 0.5));
    const hiPts = days.map((d, i) => [i * col + col / 2, y(d.max)] as [number, number]);
    const loPts = days.map((d, i) => [i * col + col / 2, y(d.min)] as [number, number]);
    // pas między nocą a dniem (zakres doby) — lekko wypełniony
    const band = `${smoothPath(hiPts)}L${loPts[loPts.length - 1][0]} ${loPts[loPts.length - 1][1]}${smoothPath([...loPts].reverse()).replace(/^M[^C]*/, '')}Z`;
    return { hiPts, loPts, hi: smoothPath(hiPts), lo: smoothPath(loPts), band };
  }, [days, col]);
  if (!days.length) return null;
  const d = days[Math.min(sel, days.length - 1)];
  const tone = WEATHER_TONES[weatherToneKey(d.code)];
  const rain = dayRainText(d);

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {col > 0 && geo && (
        <>
          <View style={s.cols} pointerEvents="box-none">
            {days.map((x, i) => (
              <TouchableOpacity key={x.date} style={[s.colHit, { width: col }, i === sel && s.colOn]} activeOpacity={0.7}
                onPress={() => { haptic.tap(); setSel(i); }} accessibilityLabel={`${dayName(x.date, i)}: ${fmtTemp(x.max)} / ${fmtTemp(x.min)}`} />
            ))}
          </View>
          <View style={s.row} pointerEvents="none">
            {days.map((x, i) => (
              <View key={x.date} style={[s.col, { width: col }]}>
                <Text style={[s.day, i === sel && s.dayOn]}>{dayName(x.date, i)}</Text>
                <PixelWeatherIcon code={x.code} size={20} />
              </View>
            ))}
          </View>
          <View style={{ height: CURVE_H }} pointerEvents="none">
            <Svg width={w} height={CURVE_H} style={StyleSheet.absoluteFill}>
              <Path d={geo.band} fill={colors.text.secondary} fillOpacity={0.07} />
              <Path d={geo.hi} stroke={DAY_C} strokeWidth={2} fill="none" />
              <Path d={geo.lo} stroke={NIGHT_C} strokeWidth={2} fill="none" />
              {geo.hiPts.map(([x, y], i) => <Circle key={`h${i}`} cx={x} cy={y} r={i === sel ? 4 : 2.5} fill={DAY_C} />)}
              {geo.loPts.map(([x, y], i) => <Circle key={`l${i}`} cx={x} cy={y} r={i === sel ? 4 : 2.5} fill={NIGHT_C} />)}
            </Svg>
            {days.map((x, i) => (
              <View key={x.date}>
                <Text style={[s.tHi, { left: i * col, width: col, top: geo.hiPts[i][1] - 17 }, i === sel && s.tOn]}>{fmtTemp(x.max)}</Text>
                <Text style={[s.tLo, { left: i * col, width: col, top: geo.loPts[i][1] + 4 }, i === sel && s.tOn]}>{fmtTemp(x.min)}</Text>
              </View>
            ))}
          </View>
          <View style={[s.row, { height: RAIN_H, alignItems: 'flex-end', marginTop: 4 }]} pointerEvents="none">
            {days.map((x) => (
              <View key={x.date} style={[s.col, { width: col }]}>
                <View style={[s.rainBar, { height: Math.max(2, (x.pop / 100) * RAIN_H), opacity: x.pop >= 50 ? 1 : x.pop >= 20 ? 0.6 : 0.25 }]} />
              </View>
            ))}
          </View>
          <View style={s.row} pointerEvents="none">
            {days.map((x) => (
              <View key={x.date} style={[s.col, { width: col }]}>
                <Text style={[s.pop, x.pop < 20 && s.popLow]}>{x.pop > 0 ? `${x.pop}%` : '–'}</Text>
                <Text style={s.mm}>{x.precipSum >= 0.1 ? `${String(Math.round(x.precipSum * 10) / 10).replace('.', ',')} mm` : ' '}</Text>
              </View>
            ))}
          </View>

          {/* wybrany dzień — słowami */}
          <View style={s.detail}>
            <Text style={s.detailHead}>
              <Text style={s.detailDay}>{sel === 0 ? 'Dziś' : sel === 1 ? 'Jutro' : dayName(d.date, sel)} {Number(d.date.slice(8, 10))}.{d.date.slice(5, 7)}</Text>
              {'  ·  '}{tone.label}{'  ·  '}
              <Text style={{ color: DAY_C }}>dzień {fmtTemp(d.max)}</Text>{'  '}
              <Text style={{ color: NIGHT_C }}>noc {fmtTemp(d.min)}</Text>
            </Text>
            <View style={s.detailRain}>
              <Droplet size={12} color={rain.wet ? colors.accent.blue : colors.text.muted} />
              <Text style={s.detailRainTxt}>{rain.text}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
});

const makeS = themedStyles((c) => StyleSheet.create({
  cols: { position: 'absolute', left: 0, right: 0, top: 0, height: 40 + CURVE_H + RAIN_H + 34, flexDirection: 'row' },
  colHit: { height: '100%', borderRadius: radius.md },
  colOn: { backgroundColor: c.ui.in2 },
  row: { flexDirection: 'row' },
  col: { alignItems: 'center', gap: 5 },
  day: { fontSize: 11.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, marginTop: 6 },
  dayOn: { color: c.text.bright, fontFamily: 'Inter_900Black' },
  tHi: { position: 'absolute', textAlign: 'center', fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.text.primary, fontVariant: ['tabular-nums'] },
  tLo: { position: 'absolute', textAlign: 'center', fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.muted, fontVariant: ['tabular-nums'] },
  tOn: { color: c.text.bright },
  rainBar: { width: 12, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: c.accent.blue },
  pop: { fontSize: 10, fontFamily: 'Inter_800ExtraBold', color: c.accent.blue, marginTop: 3 },
  popLow: { color: c.text.muted, fontFamily: 'Inter_600SemiBold' },
  mm: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: -3, marginBottom: 4 },
  detail: { marginTop: 10, backgroundColor: c.ui.in2, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, gap: 4 },
  detailHead: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  detailDay: { fontFamily: 'Inter_900Black', color: c.text.bright },
  detailRain: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailRainTxt: { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
}));
