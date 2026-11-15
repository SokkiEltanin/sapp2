import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, TouchableOpacity, TextInput, StyleSheet, useWindowDimensions, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { X, Trash2, Check, Plus } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { useNotesStore } from '@/store/notesStore';
import { hslToHex, hexToHsl, spectrumAt, spectrumPos, type Hsl } from '@/utils/colorSpace';
import { haptic } from '@/utils/haptics';

// Kreator kolorów i biblioteka (2026-11-15, user: "tę bibliotekę kolorów, kreator
// zmień na formularz i kreator biblioteki i żeby tam spektrum było"). Spektrum:
// odcień w poziomie, jasność w pionie (biel → kolor → czerń); suwak nasycenia;
// podgląd + #hex. Moja paleta: stuknięcie ładuje kolor do edycji (zapisz zmianę /
// usuń), "Dodaj do palety" zapisuje nowy i od razu go wybiera.
const HUES = [0, 60, 120, 180, 240, 300, 360];

export default function ColorCreator({ visible, initial, onClose, onPick }: {
  visible: boolean; initial?: string; onClose: () => void; onPick: (hex: string) => void;
}) {
  const s = makeS();
  const { width } = useWindowDimensions();
  const palette = useNotesStore((st) => st.palette);
  const addColor = useNotesStore((st) => st.addColor);
  const removeColor = useNotesStore((st) => st.removeColor);
  const replaceColor = useNotesStore((st) => st.replaceColor);
  const [hsl, setHsl] = useState<Hsl>({ h: 30, s: 100, l: 50 });
  const [hexText, setHexText] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  // Dokładny hex wczytany z palety / wpisany — HSL zaokrągla (#140AFF → #120AFF),
  // więc trzymamy oryginał, dopóki user nie ruszy spektrum ani suwaka.
  const [exact, setExact] = useState<string | null>(null);
  const box = useRef({ w: 1, h: 1 });
  const bar = useRef({ w: 1 });

  const hex = exact ?? hslToHex(hsl);
  useEffect(() => {
    if (!visible) return;
    const start = initial && hexToHsl(initial);
    setHsl(start && start.s > 0 ? start : { h: 30, s: 100, l: 50 });
    setExact(start && start.s > 0 ? initial!.toUpperCase().replace(/^#?/, '#') : null);
    setEditing(null);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setHexText(hex); }, [hex]);

  const onSpectrum = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    setExact(null);
    setHsl((c) => ({ ...spectrumAt(locationX / box.current.w, locationY / box.current.h, c.s) }));
  };
  const onSat = (e: GestureResponderEvent) => {
    const x = Math.min(1, Math.max(0, e.nativeEvent.locationX / bar.current.w));
    setExact(null);
    setHsl((c) => ({ ...c, s: Math.round(x * 100) }));
  };
  const typeHex = (t: string) => {
    setHexText(t);
    const v = hexToHsl(t);
    if (v) { setHsl(v); setExact(`#${t.trim().replace(/^#/, '').toUpperCase()}`); }
  };

  const cardW = Math.min(380, width - 32);
  const pos = spectrumPos(hsl);
  const inPalette = palette.includes(hex);
  const pick = () => { haptic.success(); onPick(hex); onClose(); };
  const addNew = () => { haptic.success(); addColor(hex); onPick(hex); onClose(); };
  const saveEdit = () => { if (!editing) return; haptic.success(); replaceColor(editing, hex); setEditing(hex); };
  const del = () => { if (!editing) return; haptic.warn(); removeColor(editing); setEditing(null); };
  const load = (c: string) => { haptic.tap(); const v = hexToHsl(c); if (v) setHsl(v); setExact(c); setEditing(c); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.card, { width: cardW }]} onPress={() => {}}>
          <View style={s.head}>
            <Text style={s.title}>{editing ? 'Edytuj kolor' : 'Nowy kolor'}</Text>
            <TouchableOpacity onPress={onClose} style={s.close} accessibilityLabel="Zamknij"><X size={16} color={colors.text.primary} /></TouchableOpacity>
          </View>

          <View style={s.previewRow}>
            <View style={[s.preview, { backgroundColor: hex }]} />
            <TextInput value={hexText} onChangeText={typeHex} autoCapitalize="characters" autoCorrect={false} maxLength={7}
              style={s.hexInput} placeholder="#FF8800" placeholderTextColor={colors.text.muted} />
          </View>

          {/* Spektrum: odcień → w poziomie, biel → kolor → czerń w pionie. */}
          <View
            style={s.spectrum}
            onLayout={(e: LayoutChangeEvent) => { box.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={(e) => { haptic.tap(); onSpectrum(e); }}
            onResponderMove={onSpectrum}
          >
            <Svg width="100%" height="100%" pointerEvents="none">
              <Defs>
                <LinearGradient id="ccHue" x1="0" y1="0" x2="1" y2="0">
                  {HUES.map((h, i) => <Stop key={h} offset={i / (HUES.length - 1)} stopColor={hslToHex({ h, s: hsl.s, l: 50 })} />)}
                </LinearGradient>
                <LinearGradient id="ccLight" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
                  <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
                  <Stop offset="0.5" stopColor="#000000" stopOpacity="0" />
                  <Stop offset="1" stopColor="#000000" stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#ccHue)" />
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#ccLight)" />
            </Svg>
            <View pointerEvents="none" style={[s.marker, { left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, backgroundColor: hex }]} />
          </View>

          <Text style={s.label}>Nasycenie {hsl.s}%</Text>
          <View
            style={s.sat}
            onLayout={(e: LayoutChangeEvent) => { bar.current = { w: e.nativeEvent.layout.width }; }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={(e) => { haptic.tap(); onSat(e); }}
            onResponderMove={onSat}
          >
            <Svg width="100%" height="100%" pointerEvents="none">
              <Defs>
                <LinearGradient id="ccSat" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={hslToHex({ ...hsl, s: 0 })} />
                  <Stop offset="1" stopColor={hslToHex({ ...hsl, s: 100 })} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" rx="13" fill="url(#ccSat)" />
            </Svg>
            <View pointerEvents="none" style={[s.satKnob, { left: `${hsl.s}%`, backgroundColor: hex }]} />
          </View>

          <View style={s.actions}>
            {editing ? (
              <>
                <TouchableOpacity style={s.iconBtn} onPress={del} accessibilityLabel="Usuń z palety"><Trash2 size={15} color={colors.accent.red} /></TouchableOpacity>
                <TouchableOpacity style={[s.ghostBtn, editing === hex && { opacity: 0.4 }]} disabled={editing === hex} onPress={saveEdit}>
                  <Text style={s.ghostTxt}>Zapisz zmianę</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[s.ghostBtn, inPalette && { opacity: 0.4 }]} disabled={inPalette} onPress={addNew}>
                <Plus size={14} color={colors.text.primary} />
                <Text style={s.ghostTxt}>{inPalette ? 'Już w palecie' : 'Dodaj do palety'}</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={s.okBtn} onPress={pick}>
              <Check size={14} color={colors.bg.primary} />
              <Text style={s.okTxt}>Użyj</Text>
            </TouchableOpacity>
          </View>

          <View style={s.libHead}>
            <Text style={s.label}>Moja paleta · {palette.length}</Text>
            {editing && <TouchableOpacity onPress={() => { haptic.tap(); setEditing(null); }}><Text style={s.link}>+ nowy</Text></TouchableOpacity>}
          </View>
          {palette.length === 0
            ? <Text style={s.hint}>Pusta — wybierz kolor na spektrum i „Dodaj do palety”.</Text>
            : (
              <View style={s.lib}>
                {palette.map((c) => (
                  <TouchableOpacity key={c} onPress={() => load(c)} style={[s.libSw, { backgroundColor: c }, editing === c && s.libOn]} accessibilityLabel={`Edytuj ${c}`} />
                ))}
              </View>
            )}
          {palette.length > 0 && !editing && <Text style={s.hint}>Stuknij kolor z palety, żeby go zmienić albo usunąć.</Text>}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: c.bg.card, borderRadius: radius.sheet, borderWidth: 1, borderColor: c.border.subtle, padding: spacing[4] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.bright },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.primary },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  preview: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.border.default },
  hexInput: { flex: 1, borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: 9, fontSize: 16, fontFamily: 'Inter_800ExtraBold', color: c.text.primary, fontVariant: ['tabular-nums'] },
  spectrum: { height: 180, borderRadius: radius.lg, overflow: 'hidden', position: 'relative' },
  marker: { position: 'absolute', width: 24, height: 24, marginLeft: -12, marginTop: -12, borderRadius: 12, borderWidth: 3, borderColor: '#FFFFFF' },
  label: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[3], marginBottom: spacing[2] },
  sat: { height: 26, borderRadius: 13, position: 'relative' },
  satKnob: { position: 'absolute', top: -2, width: 30, height: 30, marginLeft: -15, borderRadius: 15, borderWidth: 3, borderColor: '#FFFFFF' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[4] },
  iconBtn: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1, borderColor: c.accent.red + '55', alignItems: 'center', justifyContent: 'center' },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  ghostTxt: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  okBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[4], paddingVertical: 10, borderRadius: radius.md, backgroundColor: c.text.bright },
  okTxt: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },
  libHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary, marginTop: spacing[3] },
  lib: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  libSw: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  libOn: { borderColor: c.text.bright, transform: [{ scale: 1.12 }] },
  hint: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: spacing[2] },
}));
