import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Zap, Wallet, Smartphone, Moon, Smile, Footprints, Candy, Pizza, ShoppingBag, Briefcase, Lock, Sparkles } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useInsights } from '@/hooks/useInsights';
import { fmtVal, type Insight, type Group, type FeatKey } from '@/utils/insights';
import { haptic } from '@/utils/haptics';

// Twoje wzorce (2026-11-22, user: "sensowne porównanie danych i schematy zachowań — mniej energii,
// więcej słodyczy jak więcej pracuję, rozrywka w telefonie a słodycze i zakupy"). Logika:
// utils/insights.ts + hooks/useInsights.ts. Karta = zdanie + dwa paski (więcej vs mniej).
const GROUPS: { id: Group | 'all'; label: string }[] = [
  { id: 'all', label: 'Wszystkie' }, { id: 'praca', label: 'Praca' }, { id: 'energia', label: 'Energia i humor' }, { id: 'wydatki', label: 'Wydatki' },
  { id: 'telefon', label: 'Telefon' }, { id: 'sen', label: 'Sen' },
];
// Ikona wg tego, CO jest mierzone (y), nie wg grupy (2026-11-22, user: "dwa razy energia —
// humor niech ma buźkę"): humor ≠ energia ≠ kroki, choć są w jednej grupie filtra.
const Y_ICON: Partial<Record<FeatKey, typeof Zap>> = {
  mood: Smile, energy: Zap, sleep: Moon, steps: Footprints,
  sweets: Candy, fastfood: Pizza, shop: ShoppingBag, spend: Wallet,
  fun: Smartphone, screen: Smartphone, unlocks: Lock, night: Moon, work: Briefcase, good: Sparkles,
};
const GROUP_ICON = { praca: Briefcase, energia: Zap, wydatki: Wallet, telefon: Smartphone, sen: Moon };
const TONE = { good: colors.accent.green, bad: colors.accent.orange, neutral: colors.text.secondary };

export default function InsightsSheet({ visible, onClose, onOpenScreen }: { visible: boolean; onClose: () => void; onOpenScreen?: () => void }) {
  const s = makeS();
  const { insights, coverage } = useInsights();
  const [g, setG] = useState<Group | 'all'>('all');
  const list = useMemo(() => (g === 'all' ? insights : insights.filter((x) => x.group === g)), [insights, g]);
  const count = (id: Group | 'all') => (id === 'all' ? insights.length : insights.filter((x) => x.group === id).length);

  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.92} header={
      <View style={{ paddingBottom: spacing[2] }}>
        <Text style={s.title}>Twoje wzorce</Text>
        <Text style={s.sub}>ostatnie 90 dni · to zależności w Twoich danych, nie pewne przyczyny</Text>
      </View>
    }>
      {insights.length > 0 && (
        <View style={s.chips}>
          {GROUPS.filter((x) => x.id === 'all' || count(x.id) > 0).map((x) => (
            <TouchableOpacity key={x.id} onPress={() => { haptic.tap(); setG(x.id); }} style={[s.chip, g === x.id && s.chipOn]}>
              <Text style={[s.chipTxt, g === x.id && s.chipTxtOn]}>{x.label} {count(x.id)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {insights.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>Zbieram dane</Text>
          <Text style={s.emptyTxt}>Wzorzec pokazuje się dopiero, gdy jest pewny: min. 14 dni danych, po 5 w każdej grupie (np. 5 dni pracy i 5 wolnych), wyraźna różnica i test statystyczny z poprawką na to, że sprawdzamy ok. 45 par naraz — żeby nie było przypadkowych „strzałów”. Zwykle po 2–4 tygodniach.</Text>
          <View style={s.cov}>
            {Object.entries(coverage).map(([k, n]) => (
              <View key={k} style={s.covItem}><Text style={s.covN}>{n}</Text><Text style={s.covL}>{k}</Text></View>
            ))}
          </View>
          <Text style={s.emptyTxt}>dni z danymi · humor z wpisów, sen i kroki z zegarka, wydatki z banku i paragonów, praca z kalendarza, telefon z „Czas z telefonem”.</Text>
        </View>
      ) : list.map((x) => <InsightCard key={x.id} x={x} />)}

      <Text style={s.note}>
        Jak czytać: dni dzielone są na dwie grupy (np. praca vs wolne, więcej vs mniej rozrywki w telefonie — próg to Twoja mediana), a pasek pokazuje średni wynik w każdej. Praca rozbita jest też między samymi dniami pracy: zmiana 10 h+ vs do 8,5 h, od rana (przed 10:00) vs od popołudnia (od 12:00), do późna (21:00+) vs do 19:00, po 7 h+ snu vs poniżej 6,5 h — godziny zmian z tytułu wydarzenia w kalendarzu. Każdy pokazany wzorzec przeszedł test statystyczny (z poprawką na wiele porównań); „silny” = duża i bardzo pewna różnica, „słaby” = pewna, ale mniejsza.
        Rozrywka w telefonie = społeczności, wideo i gry — appki źle złapane zmienisz stukając je w „Czas z telefonem”.
      </Text>
      {onOpenScreen && (
        <TouchableOpacity onPress={() => { haptic.tap(); onOpenScreen(); }} style={s.link}><Text style={s.linkTxt}>Ustaw, które appki to rozrywka ›</Text></TouchableOpacity>
      )}
    </AppBottomSheet>
  );
}

function InsightCard({ x }: { x: Insight }) {
  const s = makeS();
  const Icon = Y_ICON[x.y] ?? GROUP_ICON[x.group];
  const tone = TONE[x.tone];
  const max = Math.max(x.hi.mean, x.lo.mean, 0.0001);
  const dots = x.strength === 'silny' ? 3 : x.strength === 'wyraźny' ? 2 : 1;
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={[s.iconWrap, { backgroundColor: tone + '22' }]}><Icon size={13} color={tone} /></View>
        <View style={s.dots}>{[1, 2, 3].map((i) => <View key={i} style={[s.dot, { backgroundColor: i <= dots ? tone : colors.ui.in2 }]} />)}</View>
        <Text style={[s.strength, { color: tone }]}>{x.strength}</Text>
        <Text style={s.n}>{x.hi.n + x.lo.n} dni w porównaniu</Text>
      </View>
      <Text style={s.text}>{x.text}</Text>
      {[x.hi, x.lo].map((side, i) => (
        <View key={i} style={s.barRow}>
          <Text style={s.barLab} numberOfLines={1}>{side.label} · {side.n} dni</Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${Math.max(3, (side.mean / max) * 100)}%`, backgroundColor: i === 0 ? tone : colors.text.muted }]} />
          </View>
          <Text style={[s.barVal, i === 0 && { color: colors.text.bright }]}>{fmtVal(side.mean, x.unit)}</Text>
        </View>
      ))}
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.bright },
  sub: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing[2] },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  chipOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  chipTxt: { fontSize: 11.5, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  chipTxtOn: { color: c.bg.primary },
  card: { backgroundColor: c.ui.in, borderRadius: radius.lg, padding: spacing[3], marginTop: spacing[2], gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  strength: { flex: 1, fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  n: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  text: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_700Bold', color: c.text.primary },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLab: { width: 116, fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.ui.in2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barVal: { minWidth: 62, textAlign: 'right', fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary, fontVariant: ['tabular-nums'] },
  empty: { backgroundColor: c.ui.in, borderRadius: radius.lg, padding: spacing[4], gap: spacing[2] },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_900Black', color: c.text.bright },
  emptyTxt: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  cov: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing[1] },
  covItem: { alignItems: 'center', flex: 1 },
  covN: { fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.bright, fontVariant: ['tabular-nums'] },
  covL: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted },
  note: { fontSize: 10.5, lineHeight: 15, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[3] },
  link: { paddingVertical: spacing[2] },
  linkTxt: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.bright },
}));
