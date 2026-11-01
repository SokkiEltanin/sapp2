import { View, Text, StyleSheet } from 'react-native';
import { themedStyles } from '@/theme';

// `Bars` (spec: "MiniBars") — design/app-design.html §Komponenty: "słupki, bieżący =
// txt, reszta in2". Prosty słupkowy wykres kolumnowy (miesiące jedzenia, tętno,
// kroki, sen z ostatnich 7 dni) — `Math.max(1, ...)` na mianowniku wysokości jest
// obowiązkiem WOŁAJĄCEGO (ten sam floor co już ustalony w foodStats.ts dla realnych,
// czasem zerowych danych), nie tego komponentu.
export interface BarDatum {
  value: number;
  label?: string;
}

export default function Bars({
  data,
  max,
  activeIndex,
  height = 56,
}: {
  data: BarDatum[];
  max: number;
  activeIndex?: number;
  height?: number;
}) {
  const s = makeS();
  return (
    <View style={[s.wrap, { height }]}>
      {data.map((d, i) => {
        const on = i === activeIndex;
        const pct = Math.min(100, Math.max(0, (d.value / max) * 100));
        return (
          <View key={i} style={s.col}>
            <View style={s.track}>
              <View style={[s.bar, on && s.barOn, { height: `${pct}%` }]} />
            </View>
            {d.label ? <Text style={[s.label, on && s.labelOn]} numberOfLines={1}>{d.label}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 5 },
  track: { width: '100%', flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3, backgroundColor: c.ui.in2, minHeight: 2 },
  barOn: { backgroundColor: c.text.primary },
  label: { fontSize: 9, fontFamily: 'Inter_800ExtraBold', letterSpacing: 0.5, color: c.text.muted },
  labelOn: { color: c.text.primary },
}));
