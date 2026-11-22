import type { TextStyle } from 'react-native';
import { sizePx, type RunStyle } from '@/utils/richText';

// Styl odcinka tekstu (edytor + podgląd). `scale` < 1 w podglądach (kafel, lista).
// Kursywa = osobny plik czcionki (2026-11-22, user: "kursywa nie działa"): Android przy
// własnej czcionce (Inter) ignoruje fontStyle, jeśli nie ma wariantu pochyłego —
// Inter_500Medium_Italic / Inter_800ExtraBold_Italic ładowane w app/_layout.tsx.
export function runTextStyle(st: RunStyle, scale = 1): TextStyle {
  const size = st.z != null ? Math.round(sizePx(st.z) * scale) : undefined;
  const family = st.b && st.i ? 'Inter_800ExtraBold_Italic' : st.b ? 'Inter_800ExtraBold' : st.i ? 'Inter_500Medium_Italic' : null;
  return {
    ...(family ? { fontFamily: family } : null),
    ...(st.u ? { textDecorationLine: 'underline' } : null),
    ...(st.c ? { color: st.c } : null),
    ...(st.h ? { backgroundColor: st.h } : null),
    ...(size ? { fontSize: size, lineHeight: Math.round(size * 1.4) } : null),
  };
}
