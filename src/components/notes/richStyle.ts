import type { TextStyle } from 'react-native';
import { SIZE_PX, type RunStyle } from '@/utils/richText';

// Styl odcinka tekstu (edytor + podgląd). `scale` < 1 w podglądach (kafel, lista).
export function runTextStyle(st: RunStyle, scale = 1): TextStyle {
  const size = st.z ? Math.round(SIZE_PX[st.z] * scale) : undefined;
  return {
    ...(st.b ? { fontFamily: 'Inter_800ExtraBold' } : null),
    ...(st.i ? { fontStyle: 'italic' } : null),
    ...(st.u ? { textDecorationLine: 'underline' } : null),
    ...(st.c ? { color: st.c } : null),
    ...(st.h ? { backgroundColor: st.h } : null),
    ...(size ? { fontSize: size, lineHeight: Math.round(size * 1.4) } : null),
  };
}
