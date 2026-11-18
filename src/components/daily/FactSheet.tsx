import FitText from '@/ui/FitText';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check, ChevronLeft } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useFactsStore } from '@/store/factsStore';
import { FACT_BY_ID, CAT_LABEL, factsLeft } from '@/utils/facts';
import { FACT_CATS } from '@/utils/factsData';
import { todayISO } from '@/utils/date';
import { haptic } from '@/utils/haptics';
import { useConfirmTap } from '@/hooks/useConfirmTap';

// Pełna ciekawostka (2026-11-16): temat → zajawka → liczby (duże kafelki) → wyjaśnienie
// → źródło. "Znam to" chowa ją na zawsze i od razu pokazuje następną. Niżej: dziedziny
// (wyłączenie = nie losuj z niej) i przeczytane (można wrócić do każdej).
export default function FactSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const cur = useFactsStore((st) => st.cur);
  const seen = useFactsStore((st) => st.seen);
  const known = useFactsStore((st) => st.known);
  const off = useFactsStore((st) => st.off);
  const knowIt = useFactsStore((st) => st.knowIt);
  const [knowArmed, knowTap] = useConfirmTap();
  const toggleCat = useFactsStore((st) => st.toggleCat);
  const restart = useFactsStore((st) => st.restart);
  const [view, setView] = useState<string | null>(null);   // przeczytana z historii
  useEffect(() => { if (!visible) setView(null); }, [visible]);

  const id = view ?? cur?.id ?? null;
  const f = id ? FACT_BY_ID[id] : null;
  const isCur = !view && !!cur;
  const past = [...seen, ...known.filter((k) => !seen.includes(k))].filter((x) => x !== cur?.id && FACT_BY_ID[x]).reverse();
  const left = factsLeft({ seen, known, off });

  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.92}
      header={
        <View style={s.head}>
          {view && (
            <TouchableOpacity onPress={() => { haptic.tap(); setView(null); }} style={s.back} accessibilityLabel="Wróć do dzisiejszej">
              <ChevronLeft size={18} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          <Text style={s.kicker}>{f ? `${CAT_LABEL[f.cat]}${view ? ' · przeczytana' : ' · dziś'}` : 'Ciekawostki'}</Text>
        </View>
      }>
      {f ? (
        <>
          <Text style={s.topic}>{f.topic}</Text>
          <Text style={s.teaser}>{f.teaser}</Text>
          <View style={s.nums}>
            {f.nums.map((n) => (
              <View key={n.v + n.l} style={s.num}>
                <FitText style={s.numV} numberOfLines={1} minimumFontScale={0.6}>{n.v}</FitText>
                <Text style={s.numL}>{n.l}</Text>
              </View>
            ))}
          </View>
          {f.body.map((p, i) => <Text key={i} style={s.p}>{p}</Text>)}
          <Text style={s.src}>Źródło: {f.src}</Text>
          {isCur && (
            <View style={s.actions}>
              <TouchableOpacity style={[s.ghost, knowArmed && s.ghostArmed]} onPress={() => { haptic.tap(); knowTap(() => knowIt(todayISO())); }} accessibilityLabel={knowArmed ? 'Na pewno? Stuknij jeszcze raz' : 'Znam to — pokaż następną'}>
                <Check size={15} color={knowArmed ? colors.text.bright : colors.text.secondary} />
                <Text style={[s.ghostTxt, knowArmed && { color: colors.text.bright }]}>{knowArmed ? 'Na pewno? Stuknij jeszcze raz' : 'Znam to — następna'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.ok} onPress={() => { haptic.success(); onClose(); }}>
                <Text style={s.okTxt}>Przeczytane</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <View style={s.empty}>
          <Text style={s.topic}>Wszystko przeczytane</Text>
          <Text style={s.p}>Nie ma już nowych ciekawostek w wybranych dziedzinach. Włącz inne dziedziny niżej albo zacznij od nowa — te oznaczone „Znam to” nie wrócą.</Text>
          <TouchableOpacity style={[s.ok, { alignSelf: 'flex-start' }]} onPress={() => { haptic.tap(); restart(todayISO()); }}>
            <Text style={s.okTxt}>Od nowa</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={s.label}>Dziedziny · zostało {left}</Text>
      <View style={s.chips}>
        {FACT_CATS.map((c) => {
          const on = !off.includes(c.k);
          return (
            <TouchableOpacity key={c.k} style={[s.chip, on && s.chipOn]} onPress={() => { haptic.tap(); toggleCat(c.k, todayISO()); }}>
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{c.l}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {past.length > 0 && (
        <>
          <Text style={s.label}>Przeczytane · {past.length}</Text>
          {past.map((pid) => {
            const pf = FACT_BY_ID[pid];
            return (
              <TouchableOpacity key={pid} style={[s.row, pid === view && s.rowOn]} onPress={() => { haptic.tap(); setView(pid); }}>
                <Text style={s.rowT} numberOfLines={1}>{pf.topic}</Text>
                <Text style={s.rowM}>{known.includes(pid) ? 'znam · ' : ''}{CAT_LABEL[pf.cat]}</Text>
              </TouchableOpacity>
            );
          })}
        </>
      )}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingBottom: spacing[2] },
  back: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.primary },
  kicker: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  topic: { fontSize: 26, lineHeight: 31, fontFamily: 'Inter_900Black', color: c.text.bright, letterSpacing: -0.5 },
  teaser: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_700Bold', color: c.text.primary, marginTop: spacing[2] },
  nums: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing[4], marginBottom: spacing[2] },
  num: { flexGrow: 1, flexBasis: '30%', minWidth: 120, padding: 12, borderRadius: radius.md, backgroundColor: c.bg.primary, gap: 4 },
  numV: { fontSize: 22, fontFamily: 'Inter_900Black', color: c.text.bright, fontVariant: ['tabular-nums'] },
  numL: { fontSize: 11, lineHeight: 14, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  p: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_500Medium', color: c.text.primary, marginTop: spacing[3] },
  src: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: spacing[3] },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  ghost: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  ghostArmed: { borderColor: c.text.bright },
  ghostTxt: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  ok: { paddingHorizontal: spacing[5], height: 42, borderRadius: radius.md, backgroundColor: c.text.bright, alignItems: 'center', justifyContent: 'center' },
  okTxt: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },
  empty: { gap: spacing[3] },
  label: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[5], marginBottom: spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  chipOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  chipTxt: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted },
  chipTxtOn: { color: c.bg.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.ui.line },
  rowOn: { backgroundColor: c.bg.primary },
  rowT: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  rowM: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
}));
