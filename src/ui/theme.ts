import { StyleSheet } from 'react-native';

export const C = {
  bg: '#000000',
  tile: '#141414',
  tilePressed: '#181818',
  in: '#1C1C1C',
  in2: '#232323',
  ghost: '#101010',
  line: '#222222',
  txt: '#D6D6D6',
  hi: '#F2F2F2',
  mut: '#6E6E6E',
  dim: '#3A3A3A',
  ok: '#22C55E',
  okLine: '#1E4D2E',
  warn: '#EF4444',
  warnBg: '#3A1414',
  warnTxt: '#FCA5A5',
  ur: '#1E3A8A',
  urTxt: '#C7D2FE',
  deep: '#D6D6D6',
  rem: '#8C8C8C',
  light: '#4A4A4A',
  awake: '#EF4444',
};

export const R = { tile: 18, inner: 10, sheet: 28, btn: 16, chip: 12, tag: 6 };
export const S = { x: 12, gap: 8, pad: 12, rowGap: 4 };

/**
 * Android ignoruje fontWeight przy custom fontach – każda waga to osobna rodzina.
 * Ładowanie: useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black })
 * z pakietu @expo-google-fonts/inter. NIGDY nie używaj fontWeight razem z tymi rodzinami.
 */
export const F = {
  r: 'Inter_400Regular',
  sb: 'Inter_600SemiBold',
  b: 'Inter_700Bold',
  xb: 'Inter_800ExtraBold',
  bl: 'Inter_900Black',
};

const base = { includeFontPadding: false } as const;

export const T = StyleSheet.create({
  num: { ...base, fontFamily: F.xb, fontSize: 30, lineHeight: 32, letterSpacing: -1.2, color: C.hi, fontVariant: ['tabular-nums'] },
  numXl: { ...base, fontFamily: F.xb, fontSize: 36, lineHeight: 38, letterSpacing: -1.4, color: C.hi, fontVariant: ['tabular-nums'] },
  unit: { ...base, fontFamily: F.sb, fontSize: 9, lineHeight: 11, letterSpacing: 1.2, color: C.mut, textTransform: 'uppercase', marginTop: 4 },
  lab: { ...base, fontFamily: F.xb, fontSize: 10, lineHeight: 12, letterSpacing: 0.6, color: C.txt, textTransform: 'uppercase', marginTop: 10 },
  // caption kafelka: zwykła wielkość liter, NIE uppercase
  cap: { ...base, fontFamily: F.b, fontSize: 10, lineHeight: 12, letterSpacing: 0.4, color: C.txt },
  capR: { ...base, fontFamily: F.sb, fontSize: 10, lineHeight: 12, color: C.mut },
  row: { ...base, fontFamily: F.sb, fontSize: 12, lineHeight: 15, color: C.txt },
  rowHi: { ...base, fontFamily: F.b, fontSize: 13, lineHeight: 16, color: C.hi },
  rowSub: { ...base, fontFamily: F.sb, fontSize: 10, lineHeight: 12, color: C.mut, marginTop: 2 },
  small: { ...base, fontFamily: F.b, fontSize: 11, lineHeight: 14, color: C.mut },
  body: { ...base, fontFamily: F.b, fontSize: 12, lineHeight: 17, color: C.txt },
  h1: { ...base, fontFamily: F.xb, fontSize: 24, lineHeight: 28, letterSpacing: -0.6, color: C.hi },
  sheetSt: { ...base, fontFamily: F.xb, fontSize: 10, letterSpacing: 1.4, color: C.mut, textTransform: 'uppercase' },
  sheetH: { ...base, fontFamily: F.xb, fontSize: 22, lineHeight: 26, letterSpacing: -0.5, color: C.hi, marginTop: 4, marginBottom: 12 },
});
