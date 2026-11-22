import { memo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { radius, themedStyles } from '@/theme';
import { fmtDur, peakHour, nightMinutes, type ScreenDay } from '@/utils/screenTime';
import { haptic } from '@/utils/haptics';

// Doba na jednym wykresie (2026-11-22, user: "wykres bardziej szczegółowy, więcej danych, żeby
// zbić i nie powtarzać — najwięcej 18–19 zaznaczyć NA wykresie, bez pisania na dole; mega
// ładnie"). Cała doba 0–24, a na niej:
//   • słupek = minuty w godzinie (liczba nad), SZCZYT wyróżniony i podpisany,
//   • przerywana linia "zwykle" = średnia tej godziny z poprzednich dni (avgHours),
//   • noc 0–6 jako przyciemnione pole z sumą minut,
//   • kreska "pierwsze odblokowanie" o realnej godzinie, dziś — kreska "teraz" (później wyblakłe),
//   • pod osią odblokowania w każdej godzinie (natywne `uh`).
// Stuknięcie słupka = dokładnie ta godzina w nagłówku karty (onSelect).
const H = 96;     // wysokość pola słupków
const TOP = 16;   // miejsce na liczby nad słupkami

export default memo(function DayChart({ d, usual, isToday, now, sel, onSelect }: {
  d: ScreenDay; usual: number[] | null; isToday: boolean; now: Date; sel: number | null; onSelect: (h: number | null) => void;
}) {
  const s = makeS();
  const [w, setW] = useState(0);
  const col = w / 24;
  const peak = peakHour(d);
  const max = Math.max(1, ...d.hours, ...(usual ?? [0]));
  const y = (m: number) => TOP + H - (m / max) * H;
  const night = nightMinutes(d);
  const nowH = isToday ? now.getHours() + now.getMinutes() / 60 : null;
  const first = d.first ? Number(d.first.slice(0, 2)) + Number(d.first.slice(3, 5)) / 60 : null;
  const unl = d.unlockHours;
  // linia "zwykle" schodkami po środkach godzin
  const usualPath = usual && col > 0
    ? usual.map((m, h) => `${h === 0 ? 'M' : 'L'}${(h * col).toFixed(1)} ${y(m).toFixed(1)}L${((h + 1) * col).toFixed(1)} ${y(m).toFixed(1)}`).join('')
    : '';

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <>
          <View style={{ height: TOP + H }}>
            {/* noc 0–6 */}
            <View style={[s.night, { width: col * 6, height: TOP + H }]}>
              <Text style={s.nightTxt}>noc{night > 0 ? ` · ${fmtDur(night)}` : ' · 0'}</Text>
            </View>
            {/* siatka 25/50/75% */}
            {[0.25, 0.5, 0.75].map((f) => <View key={f} style={[s.grid, { top: TOP + H * (1 - f) }]} />)}
            {/* słupki */}
            {d.hours.map((m, h) => {
              const isPeak = peak != null && peak.m > 0 && h === peak.h;
              const on = sel === h;
              const future = nowH != null && h > nowH;
              const bh = m > 0 ? Math.max(2, (m / max) * H) : 0;
              return (
                <TouchableOpacity key={h} activeOpacity={0.7} onPress={() => { haptic.tap(); onSelect(on ? null : h); }}
                  style={[s.colHit, { left: h * col, width: col, height: TOP + H }]} accessibilityLabel={`${h}:00–${h + 1}:00, ${fmtDur(m)}`}>
                  {on && <View style={s.selBg} />}
                  {m > 0 && (
                    <Text style={[s.val, { bottom: bh + 2 }, (isPeak || on) && s.valOn]} numberOfLines={1}>{m}</Text>
                  )}
                  <View style={[s.bar, {
                    height: bh,
                    backgroundColor: isPeak ? colors.accent.orange : on ? colors.text.bright : colors.text.secondary,
                    opacity: future ? 0.25 : isPeak || on ? 1 : 0.75,
                  }]} />
                </TouchableOpacity>
              );
            })}
            {/* zwykle */}
            {!!usualPath && (
              <Svg width={w} height={TOP + H} style={StyleSheet.absoluteFill} pointerEvents="none">
                <Path d={usualPath} stroke={colors.text.bright} strokeOpacity={0.45} strokeWidth={1.2} strokeDasharray="3 3" fill="none" />
              </Svg>
            )}
            {/* pierwsze odblokowanie */}
            {first != null && (
              <View pointerEvents="none" style={[s.mark, { left: first * col }]}>
                <View style={[s.markLine, { borderColor: '#FBBF24' }]} />
              </View>
            )}
            {/* teraz */}
            {nowH != null && (
              <View pointerEvents="none" style={[s.mark, { left: nowH * col }]}>
                <View style={[s.markLine, { borderColor: colors.text.muted }]} />
              </View>
            )}
            {/* podpis szczytu */}
            {peak != null && peak.m > 0 && (
              <View pointerEvents="none" style={[s.peakTag, { left: Math.min(w - 64, Math.max(0, peak.h * col + col / 2 - 32)) }]}>
                <Text style={s.peakTxt}>szczyt</Text>
              </View>
            )}
          </View>

          {/* oś: odblokowania + godziny */}
          {unl && (
            <View style={s.axisRow}>
              {unl.map((u, h) => <Text key={h} style={[s.unl, { width: col }, sel === h && { color: colors.text.bright }]} numberOfLines={1}>{u > 0 ? u : ''}</Text>)}
            </View>
          )}
          <View style={[s.axisRow, s.axisLine]}>
            {Array.from({ length: 24 }, (_, h) => (
              <Text key={h} style={[s.hour, { width: col }, sel === h && { color: colors.text.bright }]}>{h % 3 === 0 ? h : ''}</Text>
            ))}
          </View>

          {/* legenda */}
          <View style={s.legend}>
            <Legend color={colors.accent.orange} label={peak && peak.m > 0 ? `szczyt ${peak.h}–${peak.h + 1}` : 'szczyt'} />
            {usual && <Legend dash label="zwykle" />}
            {first != null && <Legend line={'#FBBF24'} label={`pierwsze ${d.first}`} />}
            {nowH != null && <Legend line={colors.text.muted} label="teraz" />}
            {unl && <Legend text label="odblokowania" />}
          </View>
        </>
      )}
    </View>
  );
});

function Legend({ color, dash, line, text, label }: { color?: string; dash?: boolean; line?: string; text?: boolean; label: string }) {
  const s = makeS();
  return (
    <View style={s.lg}>
      {color && <View style={[s.lgSq, { backgroundColor: color }]} />}
      {dash && <View style={s.lgDash} />}
      {line && <View style={[s.lgLine, { backgroundColor: line }]} />}
      {text && <Text style={s.lgNum}>3</Text>}
      <Text style={s.lgTxt}>{label}</Text>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  night: { position: 'absolute', left: 0, top: 0, backgroundColor: 'rgba(129,140,248,0.08)', borderRadius: radius.sm, paddingTop: 2, paddingLeft: 4 },
  nightTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#A5B4FC' },
  grid: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: c.ui.line, opacity: 0.6 },
  colHit: { position: 'absolute', top: 0, justifyContent: 'flex-end', alignItems: 'center' },
  selBg: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: c.ui.in2, borderRadius: 4 },
  bar: { width: '70%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  val: { position: 'absolute', fontSize: 8, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, fontVariant: ['tabular-nums'] },
  valOn: { color: c.text.bright, fontSize: 9, fontFamily: 'Inter_900Black' },
  mark: { position: 'absolute', top: 0, bottom: 0, width: 0 },
  markLine: { position: 'absolute', top: 0, bottom: 0, left: 0, borderLeftWidth: 1.5, borderStyle: 'dashed' },
  peakTag: { position: 'absolute', top: -2, width: 64, alignItems: 'center' },
  peakTxt: { fontSize: 8.5, fontFamily: 'Inter_900Black', color: c.accent.orange, letterSpacing: 0.3 },
  axisRow: { flexDirection: 'row', marginTop: 3 },
  axisLine: { borderTopWidth: 1, borderTopColor: c.ui.line, paddingTop: 3 },
  unl: { textAlign: 'center', fontSize: 8.5, fontFamily: 'Inter_700Bold', color: c.accent.blue },
  hour: { textAlign: 'left', fontSize: 9.5, fontFamily: 'Inter_700Bold', color: c.text.muted, marginLeft: -2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 10 },
  lg: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lgSq: { width: 8, height: 8, borderRadius: 2 },
  lgDash: { width: 12, height: 0, borderTopWidth: 1.2, borderStyle: 'dashed', borderColor: c.text.secondary },
  lgLine: { width: 2, height: 10, borderRadius: 1 },
  lgNum: { fontSize: 9, fontFamily: 'Inter_800ExtraBold', color: c.accent.blue },
  lgTxt: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted },
}));
