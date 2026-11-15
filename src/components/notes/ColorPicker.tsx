import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Check, Plus, X } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { useNotesStore } from '@/store/notesStore';
import { haptic } from '@/utils/haptics';

// Kolory w notatkach (2026-11-15, user: "customowe kolory albo stworzyć własną
// paletę"): podstawowe + MOJA PALETA (notesStore.palette, synchronizowana). "+"
// dodaje własny kolor (#hex, od razu wybrany); przytrzymanie koloru z palety → usuń.
// Ten sam komponent w tekście (kolor liter) i w rysunku (kolor pióra).
const HEX = /^#?([0-9a-f]{6})$/i;
const QUICK = ['#FF8800', '#00C2A8', '#FF4D8D', '#8B5CF6', '#14B8A6', '#EAB308', '#F43F5E', '#0EA5E9'];

export default function ColorPicker({ base, value, onPick, size = 28 }: {
  base: string[]; value: string | undefined; onPick: (hex: string) => void; size?: number;
}) {
  const s = makeS();
  const palette = useNotesStore((st) => st.palette);
  const addColor = useNotesStore((st) => st.addColor);
  const removeColor = useNotesStore((st) => st.removeColor);
  const [adding, setAdding] = useState(false);
  const [hex, setHex] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const valid = HEX.exec(hex.trim());
  const sw = { width: size, height: size, borderRadius: size / 2 };

  const add = (raw: string) => {
    const m = HEX.exec(raw.trim());
    if (!m) return;
    const c = `#${m[1].toUpperCase()}`;
    haptic.success();
    addColor(c);
    onPick(c);
    setHex('');
    setAdding(false);
  };

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        {base.map((c) => (
          <TouchableOpacity key={c} onPress={() => { haptic.tap(); onPick(c); }} style={[s.swatch, sw, { backgroundColor: c }, value?.toUpperCase() === c.toUpperCase() && s.on]} accessibilityLabel={`Kolor ${c}`} />
        ))}
      </View>
      <View style={s.row}>
        <Text style={s.label}>Moja paleta</Text>
        {palette.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => { haptic.tap(); if (removing === c) { removeColor(c); setRemoving(null); return; } setRemoving(null); onPick(c); }}
            onLongPress={() => { haptic.warn(); setRemoving(c); }}
            style={[s.swatch, sw, { backgroundColor: c }, value?.toUpperCase() === c && s.on]}
            accessibilityLabel={`Mój kolor ${c}${removing === c ? ' — stuknij, żeby usunąć' : ''}`}
          >
            {removing === c ? <X size={size * 0.55} color="#000" /> : null}
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => { haptic.tap(); setAdding((a) => !a); setRemoving(null); }} style={[s.swatch, sw, s.add]} accessibilityLabel="Dodaj własny kolor">
          <Plus size={size * 0.55} color={colors.text.primary} />
        </TouchableOpacity>
      </View>
      {removing && <Text style={s.hint}>Stuknij kolor z krzyżykiem, żeby usunąć go z palety.</Text>}
      {adding && (
        <View style={s.addBox}>
          <View style={s.row}>
            {QUICK.filter((c) => !palette.includes(c)).slice(0, 6).map((c) => (
              <TouchableOpacity key={c} onPress={() => add(c)} style={[s.swatch, sw, { backgroundColor: c }]} accessibilityLabel={`Dodaj ${c}`} />
            ))}
          </View>
          <View style={s.hexRow}>
            <View style={[s.hexDot, { backgroundColor: valid ? `#${valid[1]}` : 'transparent' }]} />
            <TextInput value={hex} onChangeText={setHex} placeholder="własny, np. #FF8800" placeholderTextColor={colors.text.muted}
              autoCapitalize="none" autoCorrect={false} style={s.hexInput} onSubmitEditing={() => add(hex)} />
            <TouchableOpacity style={[s.hexOk, !valid && { opacity: 0.35 }]} onPress={() => add(hex)} disabled={!valid} accessibilityLabel="Dodaj do palety">
              <Check size={15} color={colors.bg.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  wrap: { gap: spacing[2] },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  label: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginRight: 2 },
  swatch: { borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  on: { borderColor: c.text.bright, transform: [{ scale: 1.1 }] },
  add: { borderColor: c.border.default, borderStyle: 'dashed' },
  hint: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  addBox: { gap: spacing[2] },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  hexDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: c.border.default },
  hexInput: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: 7, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  hexOk: { width: 36, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.text.bright },
}));
