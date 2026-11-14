import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, type LayoutChangeEvent } from 'react-native';
import { Check } from 'lucide-react-native';
import type { Note } from '@/types/notes';
import { StrokesLayer } from './DrawingCanvas';
import { C, F } from '@/ui/theme';

// Podgląd notatki (2026-11-14): kafel Dashboardu i karta w liście notatek.
// Lista — pozycje z kwadracikiem do odhaczenia (onToggle) bez otwierania notatki;
// rysunek — miniatura z tych samych kresek (bez obrazka); tekst — początek treści.
export default function NotePreview({ note, maxLines = 6, onToggle, compact }: {
  note: Note; maxLines?: number; onToggle?: (itemId: string) => void; compact?: boolean;
}) {
  const [w, setW] = useState(0);
  if (note.kind === 'drawing') {
    const ratio = note.canvasRatio ?? 1.3;
    return (
      <View style={styles.drawBox} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          <View style={{ width: w, height: Math.min(w * ratio, maxLines * 22), overflow: 'hidden' }}>
            <StrokesLayer strokes={note.strokes} width={w} height={w * ratio} />
          </View>
        )}
        {note.strokes.length === 0 && <Text style={styles.muted}>Pusty rysunek</Text>}
      </View>
    );
  }
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
  return <Text style={styles.text} numberOfLines={maxLines}>{note.text.trim() || 'Pusta notatka'}</Text>;
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
