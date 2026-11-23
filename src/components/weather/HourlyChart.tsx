import { memo, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle } from 'react-native-svg';
import PixelWeatherIcon from './PixelWeatherIcon';
import { colors } from '@/theme/colors';
import { themedStyles } from '@/theme';
import { fmtTemp, smoothPath, type WeatherHour } from '@/utils/weather';

// 24 h jako jeden wykres (2026-11-22, user: "pogodę zrobiłbym lepiej"): godzina + ikona na górze,
// gładka krzywa temperatury z wartościami nad punktami, pod nią szansa opadu (słupki z %),
// mm opadu i pasek zachmurzenia (im ciemniej, tym więcej chmur). Przewijane w poziomie.
// Te same dane co wcześniej (temp, pop, precip, cloud) — nic nie znika.
const COL = 46;          // szerokość godziny
const CURVE_H = 64;      // wysokość pola krzywej
const TOP_PAD = 18;      // miejsce na etykietę temperatury nad punktem
const RAIN_H = 30;       // maks. wysokość słupka opadu

export default memo(function HourlyChart({ hours, isDayAt }: { hours: WeatherHour[]; isDayAt: (t: string) => boolean }) {
  const s = makeS();
  const W = hours.length * COL;
  const hasClouds = hours.some((h) => h.cloud != null);
  const { pts, line, area } = useMemo(() => {
    const ts = hours.map((h) => h.temp);
    const lo = Math.min(...ts), hi = Math.max(...ts);
    const span = Math.max(4, hi - lo); // płaska doba nie robi z 1° góry
    const mid = (lo + hi) / 2;
    const y = (t: number) => TOP_PAD + (CURVE_H - TOP_PAD - 6) * (1 - ((t - mid) / span + 0.5));
    const p = hours.map((h, i) => [i * COL + COL / 2, y(h.temp)] as [number, number]);
    const l = smoothPath(p);
    return { pts: p, line: l, area: p.length ? `${l}L${p[p.length - 1][0]} ${CURVE_H}L${p[0][0]} ${CURVE_H}Z` : '' };
  }, [hours]);
  if (!hours.length) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ width: W }}>
        {/* godzina + ikona */}
        <View style={s.row}>
          {hours.map((h, i) => {
            const hh = Number(h.time.slice(11, 13));
            const day = isDayAt(h.time);
            return (
              <View key={h.time} style={s.col}>
                <Text style={[s.time, i === 0 && s.now, hh === 0 && s.midnight]}>{i === 0 ? 'teraz' : hh === 0 ? 'jutro' : `${hh}:00`}</Text>
                <PixelWeatherIcon code={h.code} isDay={day} size={20} />
              </View>
            );
          })}
        </View>

        {/* krzywa temperatury */}
        <View style={{ width: W, height: CURVE_H }}>
          <Svg width={W} height={CURVE_H} style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgGradient id="tfill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.accent.orange} stopOpacity={0.22} />
                <Stop offset="1" stopColor={colors.accent.orange} stopOpacity={0} />
              </SvgGradient>
            </Defs>
            <Path d={area} fill="url(#tfill)" />
            <Path d={line} stroke={colors.accent.orange} strokeWidth={2} fill="none" strokeLinecap="round" />
            {pts.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={i === 0 ? 3.5 : 2} fill={i === 0 ? colors.text.bright : colors.accent.orange} />)}
          </Svg>
          {hours.map((h, i) => (
            <Text key={h.time} style={[s.temp, { left: i * COL, top: pts[i][1] - 17 }, i === 0 && s.tempNow]}>{fmtTemp(h.temp)}</Text>
          ))}
        </View>

        {/* szansa opadu */}
        <View style={[s.row, { height: RAIN_H + 2, alignItems: 'flex-end', marginTop: 6 }]}>
          {hours.map((h) => (
            <View key={h.time} style={s.col}>
              <View style={[s.rainBar, { height: Math.max(2, (h.pop / 100) * RAIN_H), opacity: h.pop >= 50 ? 1 : h.pop >= 20 ? 0.6 : 0.25 }]} />
            </View>
          ))}
        </View>
        <View style={s.row}>
          {hours.map((h) => (
            <View key={h.time} style={s.col}>
              <Text style={[s.pop, h.pop < 20 && s.popLow]}>{h.pop > 0 ? `${h.pop}%` : '–'}</Text>
              <Text style={s.mm}>{h.precip >= 0.1 ? `${h.precip.toFixed(1).replace('.', ',')} mm` : ' '}</Text>
            </View>
          ))}
        </View>

        {/* zachmurzenie */}
        {hasClouds && (
          <View style={[s.row, { marginTop: 4 }]}>
            {hours.map((h) => (
              <View key={h.time} style={s.cloudCell}>
                <View style={[s.cloud, { opacity: 0.12 + ((h.cloud ?? 0) / 100) * 0.88 }]} />
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
});

const makeS = themedStyles((c) => StyleSheet.create({
  row: { flexDirection: 'row' },
  col: { width: COL, alignItems: 'center', gap: 5 },
  time: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  now: { color: c.text.bright, fontFamily: 'Inter_900Black' },
  midnight: { color: c.text.secondary, fontFamily: 'Inter_900Black' },
  temp: { position: 'absolute', width: COL, textAlign: 'center', fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary, fontVariant: ['tabular-nums'] },
  tempNow: { color: c.text.bright, fontFamily: 'Inter_900Black' },
  rainBar: { width: 12, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: c.accent.blue },
  pop: { fontSize: 10, fontFamily: 'Inter_800ExtraBold', color: c.accent.blue, marginTop: 3 },
  popLow: { color: c.text.muted, fontFamily: 'Inter_600SemiBold' },
  mm: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: -3 },
  cloudCell: { width: COL, paddingHorizontal: 1 },
  cloud: { height: 6, borderRadius: 2, backgroundColor: c.text.secondary },
}));
