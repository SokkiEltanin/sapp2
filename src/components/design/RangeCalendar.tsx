import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { monthGrid } from '@/services/picker';
import { nextRange, ymdOf } from '@/utils/dateRange';
import { haptic } from '@/utils/haptics';

// Kalendarz zakresu "od – do" w miejscu (bez okienka) — logika w utils/dateRange.ts.
// Zmiana od razu woła onChange, więc filtr działa bez przycisku "OK".
const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const WD = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

export default function RangeCalendar({ from, to, onChange }: {
  from?: string; to?: string; onChange: (from: string, to: string) => void;
}) {
  const s = makeS();
  const [view, setView] = useState(() => {
    const anchor = to ?? from;
    const d = anchor ? new Date(`${anchor}T12:00:00`) : new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const shift = (k: number) => { haptic.tap(); setView((v) => { const d = new Date(v.y, v.m + k, 1); return { y: d.getFullYear(), m: d.getMonth() }; }); };
  const now = new Date();
  const today = ymdOf(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <View>
      <View style={s.head}>
        <TouchableOpacity style={s.nav} onPress={() => shift(-1)} accessibilityLabel="Poprzedni miesiąc"><ChevronLeft size={16} color={colors.text.primary} /></TouchableOpacity>
        <Text style={s.month}>{MONTHS[view.m]} {view.y}</Text>
        <TouchableOpacity style={s.nav} onPress={() => shift(1)} accessibilityLabel="Następny miesiąc"><ChevronRight size={16} color={colors.text.primary} /></TouchableOpacity>
      </View>
      <View style={s.week}>{WD.map((w) => <Text key={w} style={s.wd}>{w}</Text>)}</View>
      {monthGrid(view.y, view.m).map((row, ri) => (
        <View key={ri} style={s.week}>
          {row.map((d, ci) => {
            if (!d) return <View key={ci} style={s.cell} />;
            const k = ymdOf(view.y, view.m, d);
            const edge = k === from || k === to;
            const inside = !!from && !!to && k > from && k < to;
            return (
              <TouchableOpacity key={ci} style={[s.cell, inside && s.inside]} activeOpacity={0.7}
                onPress={() => { haptic.tap(); const r = nextRange(from, to, k); onChange(r.from, r.to); }}>
                <View style={[s.dot, edge && s.edge, !edge && k === today && s.today]}>
                  <Text style={[s.day, edge && s.dayOn]}>{d}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      <Text style={s.hint}>{from && to && from === to ? 'Stuknij drugi dzień, żeby zaznaczyć zakres.' : 'Stuknij dzień początku.'}</Text>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  nav: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.primary },
  month: { fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  week: { flexDirection: 'row' },
  wd: { flex: 1, textAlign: 'center', fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted, paddingVertical: 4 },
  cell: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center' },
  inside: { backgroundColor: c.bg.primary },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  edge: { backgroundColor: c.text.bright },
  today: { borderWidth: 1, borderColor: c.text.muted },
  day: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary, fontVariant: ['tabular-nums'] },
  dayOn: { color: c.bg.primary },
  hint: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: spacing[1] },
}));
