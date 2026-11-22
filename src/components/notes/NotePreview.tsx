import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, type LayoutChangeEvent } from 'react-native';
import { Check } from 'lucide-react-native';
import type { Note } from '@/types/notes';
import { StrokesLayer } from './DrawingCanvas';
import { runTextStyle } from './richStyle';
import { segments, hasFormatting } from '@/utils/richText';
import { C, F } from '@/ui/theme';
import { pageInk } from '@/utils/notePage';

// Podgląd notatki (2026-11-14): kafel Dashboardu i karta w liście notatek.
// Lista — pozycje z kwadracikiem do odhaczenia (onToggle) bez otwierania notatki;
// rysunek — miniatura z tych samych kresek (bez obrazka); tekst — początek treści.
export default function NotePreview({ note, maxLines = 6, onToggle, compact }: {
  note: Note; maxLines?: number; onToggle?: (itemId: string) => void; compact?: boolean;
}) {
  const [w, setW] = useState(0);
  // Kolor strony (2026-11-22): miniatura rysunku na tle strony, z tym samym tuszem co w edytorze.
  const ink = pageInk(note.page);
  // Rysunek — też w notatce tekstowej (tekst + rysunek w jednej, 2026-11-15): tekst na
  // górze, miniatura kresek pod nim.
  const drawing = note.strokes.length > 0 || note.kind === 'drawing' ? (() => {
    let maxY = 0;
    for (const st of note.strokes) for (let i = 1; i < st.p.length; i += 2) if (st.p[i] > maxY) maxY = st.p[i];
    const ratio = note.kind === 'drawing' && !note.text.trim() ? (note.canvasRatio ?? 1.3) : Math.max(0.2, maxY + 0.04);
    return (
      <View style={styles.drawBox} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          // Cały rysunek pomniejszony do wysokości podglądu (2026-11-22) — wcześniej ucinany od
          // góry, więc kreski niżej na stronie dawały pusty prostokąt.
          (() => {
            const h = Math.min(w * ratio, maxLines * 22);
            const dw = Math.min(w, h / ratio);
            return (
              <View style={{ width: w, height: h, overflow: 'hidden', borderRadius: 6, backgroundColor: note.page?.bg, alignItems: 'center' }}>
                <View style={{ width: dw, height: h }}>
                  <StrokesLayer strokes={note.strokes} width={dw} height={h} light={ink.light} />
                </View>
              </View>
            );
          })()
        )}
        {note.strokes.length === 0 && !note.text.trim() && <Text style={styles.muted}>Pusty rysunek</Text>}
      </View>
    );
  })() : null;
  if (note.kind !== 'list' && drawing && !note.text.trim()) return drawing;
  if (note.kind === 'list') {
    const visible = note.items.filter((i) => i.text.trim()).slice(0, maxLines);
    const more = note.items.filter((i) => i.text.trim()).length - visible.length;
    return (
      <View style={{ gap: compact ? 3 : 5 }}>
        {visible.map((it) => (
          <Pressable key={it.id} style={styles.item} onPress={onToggle ? () => onToggle(it.id) : undefined} hitSlop={4} disabled={!onToggle}>
            <View style={[styles.box, it.done && styles.boxOn]}>{it.done && <Check size={10} color={C.bg} />}</View>
            <Text style={[styles.itemText, it.done && styles.done]} numberOfLines={1}>{it.text}</Text>
          </Pressable>
        ))}
        {more > 0 && <Text style={styles.muted}>+{more} więcej</Text>}
        {visible.length === 0 && <Text style={styles.muted}>Pusta lista</Text>}
      </View>
    );
  }
  if (!note.text.trim()) return <Text style={styles.text}>Pusta notatka</Text>;
  // Formatowanie (2026-11-14) — te same odcinki co w edytorze, mniejsze rozmiary.
  const textEl = !hasFormatting(note.runs)
    ? <Text style={styles.text} numberOfLines={drawing ? Math.max(2, Math.ceil(maxLines / 2)) : maxLines}>{note.text.trim()}</Text>
    : (
      <Text style={styles.text} numberOfLines={drawing ? Math.max(2, Math.ceil(maxLines / 2)) : maxLines}>
        {segments(note.text, note.runs).map((g, i) => <Text key={i} style={runTextStyle(g.st, 0.75)}>{g.t}</Text>)}
      </Text>
    );
  if (!drawing) return textEl;
  return <View style={{ gap: 6 }}>{textEl}{drawing}</View>;
}

const styles = StyleSheet.create({
  text: { fontFamily: F.sb, fontSize: 12.5, lineHeight: 17, color: C.txt },
  muted: { fontFamily: F.b, fontSize: 11, color: C.mut },
  item: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  box: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5, borderColor: C.mut, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: C.ok, borderColor: C.ok },
  itemText: { flex: 1, fontFamily: F.sb, fontSize: 12.5, color: C.txt },
  done: { color: C.mut, textDecorationLine: 'line-through' },
  drawBox: { width: '100%' },
});
