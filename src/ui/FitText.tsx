import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

// Tekst dopasowany do miejsca (2026-11-16, user: "wersja komputerowa ma ucięte
// odliczanie"). `adjustsFontSizeToFit` działa tylko na telefonie — RN-web go ignoruje,
// więc liczby w kafelkach kończyły się "…". Telefon: natywne dopasowanie; komputer:
// mierzymy DOM (scrollWidth/scrollHeight) i zmniejszamy czcionkę do `minimumFontScale`.
export default function FitText({ style, children, minimumFontScale = 0.5, numberOfLines = 1, ...rest }: TextProps & { children?: ReactNode; minimumFontScale?: number }) {
  if (Platform.OS !== 'web') {
    return <Text {...rest} style={style} numberOfLines={numberOfLines} adjustsFontSizeToFit minimumFontScale={minimumFontScale}>{children}</Text>;
  }
  return <WebFit {...rest} style={style} numberOfLines={numberOfLines} minimumFontScale={minimumFontScale}>{children}</WebFit>;
}

function WebFit({ style, children, minimumFontScale, numberOfLines, ...rest }: TextProps & { children?: ReactNode; minimumFontScale: number }) {
  const ref = useRef<any>(null);
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const base = typeof flat.fontSize === 'number' ? flat.fontSize : 14;
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current as HTMLElement | null;
    if (!el || typeof window === 'undefined') return;
    const fit = () => {
      el.style.fontSize = `${base}px`;
      if (flat.lineHeight) el.style.lineHeight = `${flat.lineHeight}px`;
      let s = 1;
      for (let i = 0; i < 6; i++) {
        const over = (numberOfLines ?? 1) > 1
          ? (el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1 ? Math.sqrt(el.clientHeight / el.scrollHeight) : 1)
          : (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 ? el.clientWidth / el.scrollWidth : 1);
        if (over >= 1) break;
        s = Math.max(minimumFontScale, s * over * 0.98);
        el.style.fontSize = `${base * s}px`;
        if (flat.lineHeight) el.style.lineHeight = `${flat.lineHeight * s}px`;
        if (s <= minimumFontScale) break;
      }
      el.style.fontSize = '';
      el.style.lineHeight = '';
      setScale((prev) => (Math.abs(prev - s) > 0.01 ? s : prev));
    };
    fit();
    const RO = (window as any).ResizeObserver;
    const ro = RO ? new RO(() => fit()) : null;
    ro?.observe(el.parentElement ?? el);
    return () => ro?.disconnect();
  }, [children, base, numberOfLines, minimumFontScale]); // eslint-disable-line react-hooks/exhaustive-deps

  const sized = scale < 1 ? { fontSize: base * scale, ...(flat.lineHeight ? { lineHeight: flat.lineHeight * scale } : null) } : null;
  return <Text ref={ref} {...rest} style={[style, sized]} numberOfLines={numberOfLines}>{children}</Text>;
}
