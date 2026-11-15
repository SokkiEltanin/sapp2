import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Plus, Pipette } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, themedStyles } from '@/theme';
import { useNotesStore } from '@/store/notesStore';
import { haptic } from '@/utils/haptics';
import ColorCreator from './ColorCreator';

// Kolory w notatkach (2026-11-15, user: "customowe kolory albo stworzyć własną
// paletę"): podstawowe + MOJA PALETA (notesStore.palette, synchronizowana). "+"
// otwiera kreator ze spektrum (ColorCreator) — tam też edycja/usuwanie kolorów
// palety. Ten sam komponent w tekście (kolor liter) i w rysunku (kolor pióra).
export default function ColorPicker({ base, value, onPick, size = 28 }: {
  base: string[]; value: string | undefined; onPick: (hex: string) => void; size?: number;
}) {
  const s = makeS();
  const palette = useNotesStore((st) => st.palette);
  const [creator, setCreator] = useState(false);
  const sw = { width: size, height: size, borderRadius: size / 2 };
  const isOn = (c: string) => value?.toUpperCase() === c.toUpperCase();
  const custom = !!value && !base.some(isOn) && !palette.some(isOn);

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        {base.map((c) => (
          <TouchableOpacity key={c} onPress={() => { haptic.tap(); onPick(c); }} style={[s.swatch, sw, { backgroundColor: c }, isOn(c) && s.on]} accessibilityLabel={`Kolor ${c}`} />
        ))}
      </View>
      <View style={s.row}>
        <Text style={s.label}>Moja paleta</Text>
        {palette.map((c) => (
          <TouchableOpacity key={c} onPress={() => { haptic.tap(); onPick(c); }} style={[s.swatch, sw, { backgroundColor: c }, isOn(c) && s.on]} accessibilityLabel={`Mój kolor ${c}`} />
        ))}
        {custom && <View style={[s.swatch, sw, { backgroundColor: value }, s.on]} />}
        <TouchableOpacity onPress={() => { haptic.tap(); setCreator(true); }} style={[s.creatorBtn, { height: size }]} accessibilityLabel="Kreator kolorów i paleta">
          {palette.length ? <Pipette size={size * 0.5} color={colors.text.primary} /> : <Plus size={size * 0.5} color={colors.text.primary} />}
          <Text style={s.creatorTxt}>{palette.length ? 'Kreator' : 'Nowy kolor'}</Text>
        </TouchableOpacity>
      </View>
      <ColorCreator visible={creator} initial={value} onClose={() => setCreator(false)} onPick={onPick} />
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  wrap: { gap: spacing[2] },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  label: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginRight: 2 },
  swatch: { borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  on: { borderColor: c.text.bright, transform: [{ scale: 1.1 }] },
  creatorBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[3], borderRadius: 999, borderWidth: 1, borderColor: c.border.default, borderStyle: 'dashed' },
  creatorTxt: { fontSize: 11.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
}));
