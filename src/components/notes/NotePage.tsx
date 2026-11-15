import { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import type { Note } from '@/types/notes';
import { StrokesLayer } from './DrawingCanvas';
import { runTextStyle } from './richStyle';
import { segments, hasFormatting } from '@/utils/richText';
import { useNoteViewStore } from '@/store/noteViewStore';
import { C } from '@/ui/theme';

// Notatka na kaflu Dashboardu jako POMNIEJSZONA STRONA 1:1 (2026-11-15) — tekst i kreski
// w tych samych proporcjach co w edytorze (app/note.tsx, RichTextEditor `page`), więc
// linia "widoczne na Dashboardzie" w edytorze wypada dokładnie tam, gdzie kafel ucina.
// Stałe = styl pola w RichTextEditor (s.body + pageBody).
const FONT = 15, LINE = 22, PAD_X = 16, PAD_TOP = 8;

export default function NotePage({ note }: { note: Note }) {
  const pageW = useNoteViewStore((st) => st.pageW);
  const setTile = useNoteViewStore((st) => st.setTile);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
    setTile(width, height);
  };
  // Szerokość strony z edytora (gdy jeszcze nieznana — przybliżenie: ~1,4× kafla).
  const k = box.w > 0 ? box.w / (pageW ?? box.w * 1.4) : 0;
  const text = note.text.replace(/\s+$/, '');
  return (
    <View style={styles.box} onLayout={onLayout}>
      {k > 0 && (
        <>
          {!!text && (
            <Text style={{ fontSize: FONT * k, lineHeight: LINE * k, paddingHorizontal: PAD_X * k, paddingTop: PAD_TOP * k, color: C.txt, fontFamily: 'Inter_500Medium' }}>
              {hasFormatting(note.runs)
                ? segments(text, note.runs).map((g, i) => <Text key={i} style={runTextStyle(g.st, k)}>{g.t}</Text>)
                : text}
            </Text>
          )}
          {note.strokes.length > 0 && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <StrokesLayer strokes={note.strokes} width={box.w} height={Math.max(box.h, box.w * 3)} />
            </View>
          )}
          {!text && note.strokes.length === 0 && <Text style={styles.muted}>Pusta notatka</Text>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, overflow: 'hidden' },
  muted: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.mut },
});
