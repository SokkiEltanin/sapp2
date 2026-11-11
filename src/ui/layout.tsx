import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, useWindowDimensions, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '@/utils/haptics';
import { C, R, S, T, F } from './theme';

/* ------------------------------------------------------------------
 * SIATKA 4 KOLUMN
 * RN nie ma CSS grid. flex:1 / flex:3 w rzędzie z gapem daje RÓŻNE
 * szerokości kolumn w różnych rzędach (rząd 1+3 ≠ rząd 4×1) – stąd
 * krzywe krawędzie. Dlatego szerokość liczymy jawnie:
 *   col = (W - 2*x - 3*gap) / 4
 *   tile(span) = span*col + (span-1)*gap
 * ------------------------------------------------------------------ */
const ColCtx = createContext(0);
const HotCtx = createContext(false);

export function Screen({ title, right, children }: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const col = (width - S.x * 2 - S.gap * 3) / 4;
  return (
    <ColCtx.Provider value={col}>
      {/* `insets.top` (2026-11-02, user zrzutem z realnego telefonu: Dashboard
          renderował się POD ikonkami statusu/zegarkiem/baterią) — mockup's
          `.phone` ma WŁASNY, symulowany pasek statusu nad `.screen` (stąd
          `paddingTop:2` w `st.screen` niżej wystarcza TAM), ale w prawdziwej
          appce `<Tabs>` nic nie rezerwuje miejsca na prawdziwy pasek statusu
          Androida nad treścią ekranu. Dotyczy KAŻDEGO ekranu przez `Screen`
          (Dashboard/Daily/Finanse/Zadania) — jeden fix tutaj naprawia wszystkie. */}
      <View style={[st.screen, { paddingTop: insets.top + 2 }]}>
        {title ? (
          <View style={st.head}>
            <Text style={T.h1}>{title}</Text>
            {right}
          </View>
        ) : null}
        {children}
      </View>
    </ColCtx.Provider>
  );
}

/** h = stała wysokość, flex = waga wysokości (rozciąga się), brak obu = wysokość treści */
export function Row({ h, flex, children }: { h?: number; flex?: number; children: React.ReactNode }) {
  return (
    <View style={[st.row, h != null ? { height: h } : flex != null ? { flex, minHeight: 0 } : null]}>
      {children}
    </View>
  );
}

type TileProps = {
  span?: 1 | 2 | 3 | 4;
  onPress?: () => void;
  hot?: boolean;
  center?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function Tile({ span = 1, onPress, hot, center, style, children }: TileProps) {
  const col = useContext(ColCtx);
  const width = span * col + (span - 1) * S.gap;
  const look = (pressed: boolean): StyleProp<ViewStyle> => [
    st.tile,
    { width },
    hot && { backgroundColor: C.txt },
    center && st.center,
    pressed && { transform: [{ scale: 0.975 }], backgroundColor: hot ? '#C4C4C4' : C.tilePressed },
    style,
  ];
  const inner = <HotCtx.Provider value={!!hot}>{children}</HotCtx.Provider>;
  if (!onPress) return <View style={look(false)}>{inner}</View>;
  return (
    <Pressable onPress={() => { haptic.tap(); onPress(); }} style={({ pressed }) => look(pressed)}>
      {inner}
    </Pressable>
  );
}

/** Kropka hot-kafli — pierścień rozchodzący się w pętli + stała kropka na środku
 * (RN nie ma animowanego `box-shadow` jak spec, ten sam efekt inną techniką). */
export function PulseDot() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const ringScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
  const ringOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  return (
    <View style={st.pulseWrap}>
      <Animated.View style={[st.pulseRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
      <View style={st.pulse} />
    </View>
  );
}

/**
 * Kafelek liczby. Ta sama struktura w całym rzędzie = liczby na jednej linii.
 * Brak danych dla licznika → pokaż 0 (to prawdziwa wartość), nie kreskę.
 * Brak danych źródłowych (np. zegarek niepołączony) → value=null → "brak" w kolorze dim.
 */
export function StatTile({ value, unit, label, onPress, hot, span = 1 }: {
  value: string | number | null | undefined;
  unit: string;
  label: string;
  onPress?: () => void;
  hot?: boolean;
  span?: 1 | 2 | 3 | 4;
}) {
  const empty = value == null || value === '';
  return (
    <Tile span={span} onPress={onPress} hot={hot} center style={st.stat}>
      {hot ? <PulseDot /> : null}
      <Text
        style={[T.num, String(value ?? '').length > 4 && { fontSize: 24, lineHeight: 32, letterSpacing: -1 }, hot && { color: '#000' }, empty && { color: C.dim }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {empty ? '0' : String(value)}
      </Text>
      <Text style={[T.unit, hot && { color: 'rgba(0,0,0,.55)' }]} numberOfLines={1}>{empty ? 'brak' : unit}</Text>
      <Text style={[T.lab, hot && { color: '#000' }]} numberOfLines={1}>{label}</Text>
    </Tile>
  );
}

export function Cap({ l, r, onR }: { l: string; r?: string | number; onR?: () => void }) {
  return (
    <View style={st.cap}>
      <Text style={T.cap} numberOfLines={1}>{l}</Text>
      {r != null ? (
        <Text style={[T.capR, onR && { color: C.txt }]} onPress={onR} numberOfLines={1}>{String(r)}</Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------
 * LISTA DOPASOWANA DO MIEJSCA (zero scrolla, zero ucinania)
 * Mierzy dostępną wysokość, liczy ile wierszy wejdzie, rozciąga je
 * równo. Puste sloty = "ghost" wiersze, więc kafelek z 1 transakcją
 * nie wygląda jak dziura.
 * ------------------------------------------------------------------ */
export function FitList<I>({ data, minRowH = 30, maxRowH = 44, gap = S.rowGap, renderItem, emptyText }: {
  data: I[];
  minRowH?: number;
  maxRowH?: number;
  gap?: number;
  renderItem: (item: I, index: number) => React.ReactNode;
  emptyText?: string;
}) {
  const [h, setH] = useState(0);
  const n = h > 0 ? Math.max(1, Math.floor((h + gap) / (minRowH + gap))) : 0;
  const rowH = n > 0 ? Math.min(maxRowH, (h - gap * (n - 1)) / n) : minRowH;
  const items = data.slice(0, n);
  const ghosts = Math.max(0, n - items.length);
  return (
    <View style={{ flex: 1, minHeight: 0, gap }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {items.map((it, i) => (
        <View key={i} style={{ height: rowH }}>{renderItem(it, i)}</View>
      ))}
      {Array.from({ length: ghosts }).map((_, i) => (
        <View key={'g' + i} style={[st.ghost, { height: rowH, opacity: 1 - (i / Math.max(ghosts, 1)) * 0.7 }]}>
          {i === 0 && data.length === 0 && emptyText ? <Text style={T.small}>{emptyText}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** Wiersz wewnątrz listy – zawsze flex:1 (wysokość daje FitList) */
export function Item({ children, onPress, done }: { children: React.ReactNode; onPress?: () => void; done?: boolean }) {
  return (
    <Pressable
      onPress={onPress && (() => { haptic.tap(); onPress(); })}
      style={({ pressed }) => [st.item, pressed && { backgroundColor: C.in2 }, done && { opacity: 0.45 }]}
    >
      {children}
    </Pressable>
  );
}

export function Tag({ label, kind }: { label: string; kind?: 'ur' | 'fr' | 'jd' | 'warn' | 'default' }) {
  const k = kind ?? 'default';
  const bg = { ur: C.ur, fr: C.txt, jd: '#333', warn: C.warnBg, default: C.in2 }[k];
  const fg = { ur: C.urTxt, fr: '#000', jd: C.txt, warn: C.warnTxt, default: C.txt }[k];
  return (
    <View style={[st.tag, { backgroundColor: bg }]}>
      <Text style={[st.tagT, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// `fx` (2026-11-11, user: "wszystko co w obcej walucie musi mieć formularz do
// wypełnienia ile to jest w PLN") — płatność w obcej walucie, jeszcze bez kwoty
// PLN (`amount` = 0). Zamiast mylącego "−0,00" pokazuje oryginalną kwotę i
// walutę w czerwonej obwódce — widać od razu, co trzeba uzupełnić.
export function Price({ amount, fx }: { amount: number; fx?: { amount: number; currency: string } }) {
  if (fx) {
    return (
      <View style={[st.price, { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.warn }]}>
        <Text style={[st.priceT, { color: C.warn }]}>{fx.amount.toFixed(2).replace('.', ',')} {fx.currency}</Text>
      </View>
    );
  }
  const inflow = amount > 0;
  const txt = (inflow ? '+' : '−') + Math.abs(amount).toFixed(2).replace('.', ',');
  return (
    <View style={[st.price, inflow && { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.okLine }]}>
      <Text style={[st.priceT, inflow && { color: C.ok }]}>{txt}</Text>
    </View>
  );
}

/**
 * Słupki. Zero → słupek 3 px (nigdy niewidoczny brak). Bieżący = jasny.
 * 2026-11-09, user (zrzut #JedzeniePerMiesiąc): "ten kafelek lepiej biały
 * ogarnąć bo dziwnie wygląda" — gdy bieżący miesiąc jest zarazem maksimum
 * (częsty przypadek), stary wzór skalował go do RÓWNO 100% wysokości z
 * zaokrągleniem na WSZYSTKICH rogach — pełna, jasna "pigułka" dotykająca
 * sufitu kafla wyglądała jak płaski biały blok/placeholder, nie słupek
 * wykresu. Dwie poprawki: (1) `HEADROOM` — skala liczy się względem maksimum
 * ×1.15, więc nawet najwyższy słupek zostawia ok. 13% oddechu u góry; (2)
 * zaokrąglenie TYLKO górnych rogów (słupek "wyrasta" z dołu kafla jak w
 * klasycznym bar-chart, zamiast pływać jako pigułka zaokrąglona z obu stron).
 */
const BARS_HEADROOM = 1.15;

export function Bars({ values, labels, active = values.length - 1, height = 44, showValues }: {
  values: number[];
  labels?: string[];
  active?: number;
  height?: number;
  showValues?: boolean;
}) {
  const max = Math.max(1, ...values) * BARS_HEADROOM;
  return (
    <View>
      {showValues ? (
        <View style={st.barsRow}>
          {values.map((v, i) => (
            <Text key={i} style={[st.barVal, i === active && { color: C.hi }]}>{Math.round(v)}</Text>
          ))}
        </View>
      ) : null}
      <View style={[st.barsRow, { height, alignItems: 'flex-end' }]}>
        {values.map((v, i) => (
          <View
            key={i}
            style={{
              flex: 1, height: Math.max(3, (v / max) * height),
              borderTopLeftRadius: 3, borderTopRightRadius: 3,
              backgroundColor: i === active ? C.txt : C.in2,
            }}
          />
        ))}
      </View>
      {labels ? (
        <View style={[st.barsRow, { marginTop: 5 }]}>
          {labels.map((l, i) => (
            <Text key={i} style={[st.barLab, i === active && { color: C.txt }]}>{l}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Poziomy pasek proporcji + legenda (podział, kategorie jedzenia, fazy snu) */
export function StackBar({ parts, height = 10, legend = true, legendMax = 3 }: {
  parts: { label: string; value: number; color: string; display?: string }[];
  height?: number;
  legend?: boolean;
  legendMax?: number;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <View>
      <View style={[st.stack, { height }]}>
        {total === 0 ? (
          <View style={{ flex: 1, backgroundColor: C.in2 }} />
        ) : (
          parts.map((p, i) => (p.value > 0 ? <View key={i} style={{ flex: p.value, backgroundColor: p.color }} /> : null))
        )}
      </View>
      {legend ? (
        <View style={st.legend}>
          {parts.slice(0, legendMax).map((p, i) => (
            <View key={i} style={st.legItem}>
              <View style={[st.legDot, { backgroundColor: p.color }]} />
              <Text style={st.legT} numberOfLines={1}>
                {p.label} <Text style={{ color: C.txt, fontFamily: F.xb }}>{p.display ?? Math.round(p.value)}</Text>
              </Text>
            </View>
          ))}
          {parts.length > legendMax ? <Text style={[st.legT, { marginLeft: 'auto' }]}>+{parts.length - legendMax}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

export function Progress({ value, color = C.txt }: { value: number; color?: string }) {
  return (
    <View style={st.hb}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', backgroundColor: color, borderRadius: 99 }} />
    </View>
  );
}

/** "[PUR] L - Struktura..." → { tag: 'PUR', title: 'L - Struktura...' } */
export function splitTag(s: string): { tag?: string; title: string } {
  const m = s.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
  return m ? { tag: m[1], title: m[2] } : { title: s };
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: S.x, paddingTop: 2, paddingBottom: S.gap, gap: S.gap },
  head: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  row: { flexDirection: 'row', gap: S.gap, alignItems: 'stretch' },
  tile: { backgroundColor: C.tile, borderRadius: R.tile, padding: S.pad, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  stat: { paddingHorizontal: 4, paddingTop: 14, paddingBottom: 12 },
  pulseWrap: { position: 'absolute', top: 9, right: 9, width: 6, height: 6, alignItems: 'center', justifyContent: 'center' },
  pulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#000' },
  pulseRing: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#000' },
  cap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  ghost: { backgroundColor: C.ghost, borderRadius: R.inner, justifyContent: 'center', paddingHorizontal: 10 },
  item: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.in, borderRadius: R.inner, paddingHorizontal: 10 },
  tag: { borderRadius: R.tag, paddingHorizontal: 6, paddingVertical: 3, minWidth: 26, alignItems: 'center' },
  tagT: { fontFamily: F.xb, fontSize: 9, letterSpacing: 0.3, includeFontPadding: false },
  price: { backgroundColor: C.txt, borderRadius: R.tag, paddingHorizontal: 7, paddingVertical: 3, minWidth: 58, alignItems: 'flex-end' },
  priceT: { fontFamily: F.xb, fontSize: 10, color: '#000', fontVariant: ['tabular-nums'], includeFontPadding: false },
  barsRow: { flexDirection: 'row', gap: 6 },
  barVal: { flex: 1, textAlign: 'center', fontFamily: F.xb, fontSize: 11, color: C.mut, marginBottom: 6 },
  barLab: { flex: 1, textAlign: 'center', fontFamily: F.xb, fontSize: 9, letterSpacing: 0.5, color: C.mut },
  stack: { flexDirection: 'row', borderRadius: 99, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  legDot: { width: 9, height: 9, borderRadius: 3 },
  legT: { fontFamily: F.b, fontSize: 10, color: C.mut, includeFontPadding: false },
  hb: { height: 4, backgroundColor: C.in2, borderRadius: 99, overflow: 'hidden' },
});
