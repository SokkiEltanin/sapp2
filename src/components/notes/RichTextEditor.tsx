import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ColorPicker from './ColorPicker';
import WebRichField from './WebRichField';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, ScrollView } from 'react-native';
import { runTextStyle } from './richStyle';
import { Bold, Italic, Underline, Type, Palette, Highlighter, RemoveFormatting, Minus, Plus } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import {
  applyStyle, onTextEdit, styleAt, allHave, segments, fitRuns, clean, SIZE_PX, sizePx, SIZE_MIN, SIZE_MAX,
  type TextRun, type RunStyle, type TextSize,
} from '@/utils/richText';
import { haptic } from '@/utils/haptics';

// Edytor tekstu z formatowaniem (2026-11-14): pogrubienie, kursywa, podkreślenie,
// wielkość, kolor tekstu i zakreślacz (paleta + własny kolor #hex). Przybornik na
// dole — na Androidzie ekran kurczy się nad klawiaturą (adjustResize), więc pasek
// siedzi tuż nad nią. Bez zaznaczenia: styl dotyczy tego, co zaraz napiszesz.
// Logika odcinków: utils/richText.ts. Komputer (web): od 2026-11-16 pole
// `WebRichField` (contentEditable) — formatowanie widać od razu, Ctrl+B/I/U.
const PALETTE = [
  '#F2F2F2', '#A3A3A3', '#F87171', '#FB923C', '#FBBF24', '#A3E635', '#4ADE80', '#2DD4BF',
  '#38BDF8', '#60A5FA', '#818CF8', '#A78BFA', '#E879F9', '#F472B6', '#D6A15E', '#EF4444',
];
const HIGHLIGHTS = ['#FDE04766', '#4ADE8055', '#60A5FA55', '#F472B655', '#FB923C55', '#A78BFA55'];
const SIZES: [TextSize, string][] = [['s', 'Mały'], ['m', 'Normalny'], ['l', 'Duży'], ['xl', 'Nagłówek']];

type Panel = 'size' | 'color' | 'highlight' | null;

export default function RichTextEditor({ text, runs, onChange, autoFocus, page, editable = true, toolbar = true }: {
  text: string; runs: TextRun[] | undefined; onChange: (text: string, runs: TextRun[]) => void; autoFocus?: boolean;
  // Tryb "strona" (2026-11-15, tekst + rysunek w jednej notatce): pole nie przewija się
  // samo, tylko rośnie z treścią, a `page.wrap` owija je (ScrollView + warstwa kresek),
  // żeby rysunek przewijał się razem z tekstem. `minHeight` = co najmniej ekran.
  page?: { wrap: (field: ReactNode) => ReactNode; minHeight: number };
  editable?: boolean;
  toolbar?: boolean;
}) {
  const s = makeS();
  const fitted = useMemo(() => fitRuns(runs, text.length), [runs, text.length]);
  const sel = useRef({ start: text.length, end: text.length });
  const [selState, setSelState] = useState(sel.current);
  // Styl "na zapas" (bez zaznaczenia) — obowiązuje, dopóki kursor stoi w tym miejscu.
  const [pending, setPending] = useState<{ at: number; st: RunStyle } | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [fieldH, setFieldH] = useState(0);
  const trackW = useRef(1);
  const [dragPx, setDragPx] = useState<number | null>(null);
  const pxAt = (x: number) => Math.round(SIZE_MIN + Math.min(1, Math.max(0, x / trackW.current)) * (SIZE_MAX - SIZE_MIN));

  const hasSel = selState.end > selState.start;
  const cur: RunStyle = hasSel ? styleAt(fitted, selState.start + 1) : pending && pending.at === selState.start ? pending.st : styleAt(fitted, selState.start);

  const curPx = sizePx(cur.z);
  const shownPx = dragPx ?? curPx;
  // Komputer: po akcji z paska fokus i zaznaczenie wracają do pola (WebRichField).
  const [focusTick, setFocusTick] = useState(0);
  const apply = (patch: Partial<RunStyle>) => {
    haptic.tap();
    if (Platform.OS === 'web') setFocusTick((t) => t + 1);
    const { start, end } = sel.current;
    if (end > start) { onChange(text, applyStyle(fitted, start, end, patch)); relayout(); }
    else setPending({ at: start, st: clean({ ...cur, ...patch }) });
  };
  const toggle = (k: 'b' | 'i' | 'u') => {
    const { start, end } = sel.current;
    const on = end > start ? allHave(fitted, start, end, k) : !!cur[k];
    apply({ [k]: !on });
  };

  // Miejsce edycji liczone z RÓŻNICY tekstów, nie z kursora (2026-11-16, user: "jak
  // zaznaczone np. podkreślenie, to ponowne kliknięcie ma wyłączać"): na Androidzie
  // zmiana zaznaczenia przychodzi PRZED zmianą tekstu, więc kursor był już dalej,
  // styl "na zapas" (np. wyłączone podkreślenie) się gubił i litery wracały podkreślone.
  // Znikające linie (2026-11-22, user: "dodałem jedną literkę i zniknął tekst"): Android po
  // podmianie odcinków (spany) w polu potrafi nie przerysować części linii — tekst jest
  // zapisany (widget pokazywał całość), ale w polu pusto. Chwilę po pisaniu wymuszamy
  // ponowne ułożenie tekstu: szerokość pola na moment o 1 px mniejsza i z powrotem.
  const [nudge, setNudge] = useState(0);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (nudgeTimer.current) clearTimeout(nudgeTimer.current); }, []);
  const relayout = () => {
    if (Platform.OS !== 'android') return;
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => {
      setNudge(1);
      nudgeTimer.current = setTimeout(() => setNudge(0), 32);
    }, 120);
  };

  const handleText = (t: string) => {
    relayout();
    let at = 0;
    const max = Math.min(text.length, t.length);
    while (at < max && text[at] === t[at]) at++;
    const { start } = sel.current;
    const live = pending && (pending.at === at || pending.at === start) ? pending : null;
    const typing = live ? live.st : styleAt(fitted, at);
    const next = onTextEdit(text, t, fitted, typing);
    if (live) setPending({ at: at + Math.max(0, t.length - text.length), st: live.st });
    else if (pending) setPending(null);
    onChange(t, next);
  };

  const segs = segments(text, fitted);
  const web = Platform.OS === 'web';

  const field = web ? (
      <WebRichField
        segs={segs}
        text={text}
        onInput={handleText}
        onSelect={(x) => { sel.current = x; setSelState(x); }}
        onKey={(k) => toggle(k)}
        editable={editable}
        minHeight={page?.minHeight ?? 240}
        autoFocus={autoFocus}
        focusTick={focusTick}
        placeholder="Pisz…"
      />
  ) : (
      <TextInput
        {...(web ? { value: text } : {})}
        onChangeText={handleText}
        onSelectionChange={(e) => { sel.current = e.nativeEvent.selection; setSelState(e.nativeEvent.selection); }}
        placeholder="Pisz…"
        placeholderTextColor={colors.text.muted}
        style={[page ? [s.body, s.pageBody, { minHeight: page.minHeight }, web && fieldH > 0 ? { height: Math.max(page.minHeight, fieldH) } : null] : s.body, nudge ? { paddingRight: spacing[4] + 1 } : null]}
        multiline
        textAlignVertical="top"
        autoFocus={autoFocus}
        editable={editable}
        scrollEnabled={!page}
        onContentSizeChange={page ? (e) => setFieldH(e.nativeEvent.contentSize.height + 40) : undefined}
      >
        {web ? undefined : segs.map((g, i) => <Text key={i} style={runTextStyle(g.st)}>{g.t}</Text>)}
      </TextInput>
  );

  return (
    <View style={s.wrap}>
      {page ? page.wrap(field) : field}

      {toolbar && panel === 'size' && (
        <View style={s.panelCol}>
          {/* Płynny rozmiar (2026-11-16): suwak 10–48 px + −/+ co 1 px, presety niżej. */}
          <View style={s.sizeRow}>
            <TouchableOpacity style={s.stepBtn} onPress={() => apply({ z: Math.max(SIZE_MIN, curPx - 1) })} accessibilityLabel="Mniejszy tekst">
              <Minus size={15} color={colors.text.primary} />
            </TouchableOpacity>
            <View
              style={s.sizeTrack}
              onLayout={(e) => { trackW.current = e.nativeEvent.layout.width; }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
              onResponderGrant={(e) => setDragPx(pxAt(e.nativeEvent.locationX))}
              onResponderMove={(e) => setDragPx(pxAt(e.nativeEvent.locationX))}
              onResponderRelease={(e) => { const z = pxAt(e.nativeEvent.locationX); setDragPx(null); apply({ z }); }}
            >
              <View style={s.sizeRail} pointerEvents="none" />
              <View style={[s.sizeFill, { width: `${((shownPx - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)) * 100}%` }]} pointerEvents="none" />
              <View style={[s.sizeKnob, { left: `${((shownPx - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)) * 100}%` }]} pointerEvents="none" />
            </View>
            <TouchableOpacity style={s.stepBtn} onPress={() => apply({ z: Math.min(SIZE_MAX, curPx + 1) })} accessibilityLabel="Większy tekst">
              <Plus size={15} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={s.sizeVal}>{shownPx}</Text>
          </View>
          <View style={s.presetRow}>
            {SIZES.map(([z, label]) => {
              const on = curPx === SIZE_PX[z as 's'];
              return (
                <TouchableOpacity key={String(z)} style={[s.sizeBtn, on && s.on]} onPress={() => apply({ z })}>
                  <Text style={[s.sizeLabel, { fontSize: Math.min(SIZE_PX[z as 's'], 20) }, on && s.onLabel]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
      {toolbar && panel === 'color' && (
        <View style={s.panelCol}>
          <ColorPicker base={PALETTE} value={cur.c ?? '#F2F2F2'} onPick={(c) => apply({ c: c.toUpperCase() === '#F2F2F2' ? undefined : c })} />
        </View>
      )}
      {toolbar && panel === 'highlight' && (
        <View style={s.panel}>
          <TouchableOpacity style={[s.swatch, s.noHl, !cur.h && s.swatchOn]} onPress={() => apply({ h: undefined })} accessibilityLabel="Bez zakreślenia" />
          {HIGHLIGHTS.map((c) => (
            <TouchableOpacity key={c} onPress={() => apply({ h: c })} style={[s.swatch, { backgroundColor: c }, cur.h === c && s.swatchOn]} accessibilityLabel={`Zakreślacz ${c}`} />
          ))}
        </View>
      )}

      {/* Przybornik nad klawiaturą */}
      {toolbar && <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={s.barScroll} contentContainerStyle={s.bar}>
        <TouchableOpacity style={[s.tool, cur.b && s.on]} onPress={() => toggle('b')} accessibilityLabel="Pogrubienie"><Bold size={17} color={cur.b ? colors.bg.primary : colors.text.primary} /></TouchableOpacity>
        <TouchableOpacity style={[s.tool, cur.i && s.on]} onPress={() => toggle('i')} accessibilityLabel="Kursywa"><Italic size={17} color={cur.i ? colors.bg.primary : colors.text.primary} /></TouchableOpacity>
        <TouchableOpacity style={[s.tool, cur.u && s.on]} onPress={() => toggle('u')} accessibilityLabel="Podkreślenie"><Underline size={17} color={cur.u ? colors.bg.primary : colors.text.primary} /></TouchableOpacity>
        <View style={s.sep} />
        <TouchableOpacity style={[s.tool, panel === 'size' && s.toolOpen]} onPress={() => { haptic.tap(); setPanel(panel === 'size' ? null : 'size'); }} accessibilityLabel="Wielkość tekstu">
          <Type size={17} color={colors.text.primary} />
          {curPx !== SIZE_PX.m ? <Text style={s.badge}>{curPx}</Text> : null}
        </TouchableOpacity>
        <TouchableOpacity style={[s.tool, panel === 'color' && s.toolOpen]} onPress={() => { haptic.tap(); setPanel(panel === 'color' ? null : 'color'); }} accessibilityLabel="Kolor tekstu">
          <Palette size={17} color={cur.c ?? colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.tool, panel === 'highlight' && s.toolOpen]} onPress={() => { haptic.tap(); setPanel(panel === 'highlight' ? null : 'highlight'); }} accessibilityLabel="Zakreślacz">
          <Highlighter size={17} color={colors.text.primary} />
          {cur.h ? <View style={[s.hlDot, { backgroundColor: cur.h }]} /> : null}
        </TouchableOpacity>
        <View style={s.sep} />
        <TouchableOpacity style={s.tool} onPress={() => apply({ b: false, i: false, u: false, c: undefined, h: undefined, z: undefined })} accessibilityLabel="Wyczyść formatowanie">
          <RemoveFormatting size={17} color={colors.text.muted} />
        </TouchableOpacity>
        <Text style={s.hint}>{hasSel ? 'zaznaczenie' : 'dalsze pisanie'}</Text>
      </ScrollView>}
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  wrap: { flex: 1 },
  pageBody: { flex: 0, paddingBottom: 40 },
  body: { flex: 1, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', color: c.text.primary, paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  barScroll: { flexGrow: 0, borderTopWidth: 1, borderTopColor: c.ui.line, backgroundColor: c.bg.primary },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing[2], paddingVertical: 6 },
  tool: { width: 42, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  toolOpen: { backgroundColor: c.ui.in },
  on: { backgroundColor: c.text.bright },
  onLabel: { color: c.bg.primary },
  sep: { width: 1, height: 22, backgroundColor: c.ui.line, marginHorizontal: 4 },
  badge: { position: 'absolute', bottom: 3, right: 4, fontSize: 8, fontFamily: 'Inter_900Black', color: c.text.secondary },
  hlDot: { position: 'absolute', bottom: 6, width: 16, height: 3, borderRadius: 2 },
  hint: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginLeft: spacing[2] },
  panel: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: c.ui.line },
  panelCol: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], gap: spacing[2], borderTopWidth: 1, borderTopColor: c.ui.line },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  stepBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  sizeTrack: { flex: 1, height: 34, justifyContent: 'center' },
  sizeRail: { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: c.ui.in2 },
  sizeFill: { position: 'absolute', left: 0, height: 6, borderRadius: 3, backgroundColor: c.text.secondary },
  sizeKnob: { position: 'absolute', width: 22, height: 22, marginLeft: -11, borderRadius: 11, backgroundColor: c.text.bright },
  sizeVal: { width: 28, textAlign: 'right', fontSize: 14, fontFamily: 'Inter_900Black', color: c.text.bright, fontVariant: ['tabular-nums'] },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sizeBtn: { paddingHorizontal: spacing[3], height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, justifyContent: 'center' },
  sizeLabel: { fontFamily: 'Inter_700Bold', color: c.text.primary },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: c.text.bright },
  noHl: { borderColor: c.border.default, borderStyle: 'dashed' },
}));
