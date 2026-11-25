import FitText from '@/ui/FitText';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check, ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useFactsStore } from '@/store/factsStore';
import { FACT_BY_ID, CAT_LABEL, factsLeft } from '@/utils/facts';
import { FACT_CATS, FACT_LIST } from '@/utils/factsData';
import { todayISO } from '@/utils/date';
import { haptic } from '@/utils/haptics';
import { useConfirmTap } from '@/hooks/useConfirmTap';
import FactIcon from './FactIcon';
import { Pix } from '@/components/design/pixelAnim';
import { artFor } from '@/utils/factArt';

// Pełna ciekawostka (2026-11-16): temat → zajawka → liczby (duże kafelki) → wyjaśnienie
// → źródło. "Znam to" chowa ją na zawsze i od razu pokazuje następną.
// Uspokojona 2026-11-25 (user: "przeczytane zwinięte domyślnie, tagi wprowadzają chaos
// i przyciągają uwagę, ulepsz jak pogodę"):
//   • nagłówek = ikona pixel-art tej ciekawostki (components/daily/FactIcon.tsx, rysunki z
//     scripts/gen-fact-art.py) + temat; na liście przeczytanych mała, nieruchoma,
//   • przyciski w stopce (zawsze pod kciukiem, nie trzeba przewijać),
//   • "Przeczytane" i "Dziedziny" jako dwa ciche, ZWINIĘTE wiersze na dole,
//   • dziedziny bez białych wypełnionych pigułek: włączona = jasny tekst + ptaszek,
//     wyłączona = przygaszona.
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
  const [pastOpen, setPastOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  useEffect(() => { if (!visible) { setView(null); setPastOpen(false); setCatsOpen(false); } }, [visible]);

  const id = view ?? cur?.id ?? null;
  const f = id ? FACT_BY_ID[id] : null;
  const isCur = !view && !!cur;
  const past = [...seen, ...known.filter((k) => !seen.includes(k))].filter((x) => x !== cur?.id && FACT_BY_ID[x]).reverse();
  const left = factsLeft({ seen, known, off });
  const done = new Set([...seen, ...known]).size;   // tak samo jak licznik na kaflu Daily
  const catsOn = FACT_CATS.length - off.length;

  const openPast = (pid: string) => {
    haptic.tap();
    setView(pid);
    setPastOpen(false);   // lista się zwija → arkusz wraca do góry, do czytanej ciekawostki
  };

  const footer = view ? (
    <TouchableOpacity style={s.ghost} onPress={() => { haptic.tap(); setView(null); }} accessibilityLabel="Wróć do dzisiejszej">
      <ChevronLeft size={15} color={colors.text.secondary} />
      <Text style={s.ghostTxt}>Wróć do dzisiejszej</Text>
    </TouchableOpacity>
  ) : isCur ? (
    <View style={s.actions}>
      <TouchableOpacity style={[s.ghost, { flex: 1 }, knowArmed && s.ghostArmed]} onPress={() => { haptic.tap(); knowTap(() => knowIt(todayISO())); }} accessibilityLabel={knowArmed ? 'Na pewno? Stuknij jeszcze raz' : 'Znam to — pokaż następną'}>
        <Check size={15} color={knowArmed ? colors.text.bright : colors.text.secondary} />
        <Text style={[s.ghostTxt, knowArmed && { color: colors.text.bright }]}>{knowArmed ? 'Na pewno? Stuknij jeszcze raz' : 'Znam to — następna'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.ok} onPress={() => { haptic.success(); onClose(); }}>
        <Text style={s.okTxt}>Przeczytane</Text>
      </TouchableOpacity>
    </View>
  ) : undefined;

  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.92} footer={footer}
      header={
        <View style={s.head}>
          <Text style={s.kicker} numberOfLines={1}>{f ? `${CAT_LABEL[f.cat]}${view ? ' · przeczytana' : ' · dziś'}` : 'Ciekawostki'}</Text>
          <Text style={s.kickerR}>{done} z {FACT_LIST.length}</Text>
        </View>
      }>
      {f ? (
        <>
          <View style={s.hero}>
            <View style={s.iconBox}><FactIcon fact={f} px={3} /></View>
            <Text style={s.topic}>{f.topic}</Text>
          </View>
          <Text style={s.teaser}>{f.teaser}</Text>
          {f.nums.length > 0 && (
            <View style={s.nums}>
              {f.nums.map((n) => (
                <View key={n.v + n.l} style={s.num}>
                  <FitText style={s.numV} numberOfLines={1} minimumFontScale={0.6}>{n.v}</FitText>
                  <Text style={s.numL}>{n.l}</Text>
                </View>
              ))}
            </View>
          )}
          {f.body.map((p, i) => <Text key={i} style={s.p}>{p}</Text>)}
          <Text style={s.src}>Źródło: {f.src}</Text>
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

      <View style={s.more}>
        {past.length > 0 && (
          <>
            <TouchableOpacity style={s.fold} onPress={() => { haptic.tap(); setPastOpen((o) => !o); }} accessibilityLabel={pastOpen ? 'Zwiń przeczytane' : 'Pokaż przeczytane'}>
              <Text style={s.foldT}>Przeczytane</Text>
              <Text style={s.foldM}>{past.length}</Text>
              {pastOpen ? <ChevronDown size={16} color={colors.text.muted} /> : <ChevronRight size={16} color={colors.text.muted} />}
            </TouchableOpacity>
            {pastOpen && past.map((pid) => {
              const pf = FACT_BY_ID[pid];
              return (
                <TouchableOpacity key={pid} style={[s.row, pid === view && s.rowOn]} onPress={() => openPast(pid)}>
                  <Pix sprite={artFor(pf).rows} palette={artFor(pf).pal} px={1.5} />
                  <Text style={s.rowT} numberOfLines={1}>{pf.topic}</Text>
                  <Text style={s.rowM}>{known.includes(pid) ? 'znam · ' : ''}{CAT_LABEL[pf.cat]}</Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <TouchableOpacity style={[s.fold, past.length === 0 && { borderTopWidth: 0 }]} onPress={() => { haptic.tap(); setCatsOpen((o) => !o); }} accessibilityLabel={catsOpen ? 'Zwiń dziedziny' : 'Pokaż dziedziny'}>
          <Text style={s.foldT}>Dziedziny</Text>
          <Text style={s.foldM}>{catsOn === FACT_CATS.length ? 'wszystkie' : `${catsOn} z ${FACT_CATS.length}`} · zostało {left}</Text>
          {catsOpen ? <ChevronDown size={16} color={colors.text.muted} /> : <ChevronRight size={16} color={colors.text.muted} />}
        </TouchableOpacity>
        {catsOpen && (
          <View style={s.chips}>
            {FACT_CATS.map((c) => {
              const on = !off.includes(c.k);
              return (
                <TouchableOpacity key={c.k} style={s.chip} onPress={() => { haptic.tap(); toggleCat(c.k, todayISO()); }} accessibilityLabel={`${c.l}: ${on ? 'włączona' : 'wyłączona'}`}>
                  <View style={[s.tick, on && s.tickOn]}>{on && <Check size={10} color={colors.bg.primary} strokeWidth={3.5} />}</View>
                  <Text style={[s.chipTxt, on && s.chipTxtOn]}>{c.l}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingBottom: spacing[2] },
  kicker: { flex: 1, fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  kickerR: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, fontVariant: ['tabular-nums'] },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  iconBox: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: c.bg.primary, alignItems: 'center', justifyContent: 'center' },
  topic: { flex: 1, fontSize: 26, lineHeight: 31, fontFamily: 'Inter_900Black', color: c.text.bright, letterSpacing: -0.5 },
  teaser: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_700Bold', color: c.text.primary, marginTop: spacing[3] },
  nums: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing[4], marginBottom: spacing[2] },
  num: { flexGrow: 1, flexBasis: '30%', minWidth: 120, padding: 12, borderRadius: radius.md, backgroundColor: c.bg.primary, gap: 4 },
  numV: { fontSize: 22, fontFamily: 'Inter_900Black', color: c.text.bright, fontVariant: ['tabular-nums'] },
  numL: { fontSize: 11, lineHeight: 14, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  p: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_500Medium', color: c.text.primary, marginTop: spacing[3] },
  src: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: spacing[3] },
  actions: { flexDirection: 'row', gap: spacing[2] },
  ghost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  ghostArmed: { borderColor: c.text.bright },
  ghostTxt: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  ok: { paddingHorizontal: spacing[5], height: 44, borderRadius: radius.md, backgroundColor: c.text.bright, alignItems: 'center', justifyContent: 'center' },
  okTxt: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },
  empty: { gap: spacing[3] },
  more: { marginTop: spacing[5] },
  fold: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.ui.line },
  foldT: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  foldM: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.text.muted, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing[4], rowGap: 4, paddingBottom: spacing[2] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8 },
  tick: { width: 15, height: 15, borderRadius: 4, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: c.text.secondary, borderColor: c.text.secondary },
  chipTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  chipTxtOn: { color: c.text.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 10, paddingLeft: spacing[2], borderTopWidth: 1, borderTopColor: c.ui.line },
  rowOn: { backgroundColor: c.bg.primary },
  rowT: { flex: 1, fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: c.text.primary },
  rowM: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
}));
