import { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import type { SleepStageSpan, SleepStageKind } from '@/types/health';
import { PHASE_COLOR, PHASE_META } from '@/utils/sleepStats';
import { colors } from '@/theme/colors';
import { themedStyles } from '@/theme';

// Hipnogram (2026-11-13): przebieg faz w nocy, 4 pasy — wybudzenie na górze,
// głęboki na dole (klasyczny układ). Szerokość z onLayout (SVG w px).
const LANES: SleepStageKind[] = ['awake', 'rem', 'light', 'deep'];
const LANE_H = 16;
const GAP = 6;

const hm = (ms: number) => new Date(ms).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

export default function Hypnogram({ spans, start, end }: { spans: SleepStageSpan[]; start: number; end: number }) {
  const st = makeS();
  const [w, setW] = useState(0);
  const labelW = 74;
  const plotW = Math.max(0, w - labelW);
  const span = Math.max(1, end - start);
  const x = (t: number) => labelW + ((t - start) / span) * plotW;
  const h = LANES.length * (LANE_H + GAP);
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={h}>
          {LANES.map((lane, i) => (
            <Line key={lane} x1={labelW} x2={w} y1={i * (LANE_H + GAP) + LANE_H / 2} y2={i * (LANE_H + GAP) + LANE_H / 2} stroke={colors.border.default} strokeWidth={1} />
          ))}
          {spans.map((s, k) => {
            const i = LANES.indexOf(s.stage);
            const x1 = x(Math.max(start, s.start));
            const x2 = x(Math.min(end, s.end));
            return <Rect key={k} x={x1} y={i * (LANE_H + GAP)} width={Math.max(1.5, x2 - x1)} height={LANE_H} rx={3} fill={PHASE_COLOR[s.stage]} />;
          })}
        </Svg>
      )}
      <View style={[st.labels, { height: h }]} pointerEvents="none">
        {LANES.map((lane) => (
          <Text key={lane} style={[st.lane, { height: LANE_H + GAP, color: PHASE_COLOR[lane] }]} numberOfLines={1}>{PHASE_META[lane].label}</Text>
        ))}
      </View>
      <View style={[st.axis, { marginLeft: labelW }]}>
        <Text style={st.axisT}>{hm(start)}</Text>
        <Text style={st.axisT}>{hm(start + span / 2)}</Text>
        <Text style={st.axisT}>{hm(end)}</Text>
      </View>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  labels: { position: 'absolute', left: 0, top: 0, width: 72 },
  lane: { fontSize: 10.5, fontFamily: 'Inter_700Bold', lineHeight: LANE_H },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisT: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
}));
