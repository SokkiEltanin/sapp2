import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { themedStyles } from '@/theme';
import { haptic } from '@/utils/haptics';

// Kółko wyboru jak w zegarze Samsunga (2026-11-18, user: "zamiast tej siatki godzin rolka
// scrolla jak na Samsungu"). Przewijana kolumna z przyciąganiem do pozycji, zapętlona
// (00 po 23), środek podświetlony, dalsze pozycje bledną. Stuknięcie w pozycję też ją wybiera.
export const WHEEL_ITEM_H = 48;
const VISIBLE = 5;              // nieparzyste: środek + 2 nad i 2 pod
const LOOPS = 7;                // powtórzenia listy — "nieskończone" przewijanie

const pad = (n: number) => String(n).padStart(2, '0');

function WheelColumn({ count, value, onChange, width = 96, format = pad }: {
  count: number; value: number; onChange: (v: number) => void; width?: number; format?: (v: number) => string;
}) {
  const s = makeS();
  const ref = useRef<ScrollView>(null);
  const mid = Math.floor(LOOPS / 2);
  const total = count * LOOPS;
  const [center, setCenter] = useState(mid * count + value);   // indeks w środku (do wyglądu)
  const settled = useRef(value);
  const lastTick = useRef(mid * count + value);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ready = useRef(false);

  const scrollToIndex = useCallback((i: number, animated: boolean) => {
    ref.current?.scrollTo({ y: i * WHEEL_ITEM_H, animated });
  }, []);

  // wartość zmieniona z zewnątrz (np. "Teraz") → przewiń
  useEffect(() => {
    if (!ready.current || value === settled.current) return;
    settled.current = value;
    const i = mid * count + value;
    lastTick.current = i;
    setCenter(i);
    scrollToIndex(i, true);
  }, [value, count, mid, scrollToIndex]);

  const settle = useCallback((y: number) => {
    let i = Math.round(y / WHEEL_ITEM_H);
    i = Math.max(0, Math.min(total - 1, i));
    const v = ((i % count) + count) % count;
    // daleko od środka → bez animacji wróć do środkowej kopii (pętla bez końca)
    const recentered = mid * count + v;
    if (Math.abs(i - recentered) >= count) { scrollToIndex(recentered, false); lastTick.current = recentered; setCenter(recentered); }
    else if (Math.abs(y - i * WHEEL_ITEM_H) > 1) scrollToIndex(i, true);
    if (v !== settled.current) { settled.current = v; onChange(v); }
  }, [count, mid, total, onChange, scrollToIndex]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const i = Math.round(y / WHEEL_ITEM_H);
    if (i !== lastTick.current) { lastTick.current = i; setCenter(i); haptic.tick(); }
    // web nie zawsze daje onMomentumScrollEnd — dosiadanie po chwili ciszy
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => settle(y), Platform.OS === 'web' ? 140 : 220);
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settle(e.nativeEvent.contentOffset.y);
  };
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  return (
    <View style={{ width, height: WHEEL_ITEM_H * VISIBLE }}>
      <View style={s.band} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        scrollEventThrottle={16}
        contentOffset={{ x: 0, y: (mid * count + value) * WHEEL_ITEM_H }}
        onLayout={() => { if (!ready.current) { ready.current = true; scrollToIndex(mid * count + value, false); } }}
        onScroll={onScroll}
        onMomentumScrollEnd={onEnd}
        contentContainerStyle={{ paddingVertical: WHEEL_ITEM_H * Math.floor(VISIBLE / 2) }}
      >
        {Array.from({ length: total }, (_, i) => {
          const d = Math.abs(i - center);
          if (d > VISIBLE) return <View key={i} style={{ height: WHEEL_ITEM_H }} />; // poza widokiem — bez tekstu
          const v = i % count;
          return (
            <Text key={i} suppressHighlighting
              onPress={() => { haptic.tap(); scrollToIndex(i, true); setTimeout(() => settle(i * WHEEL_ITEM_H), 260); }}
              style={[s.item, d === 0 ? s.itemOn : d === 1 ? s.itemNear : s.itemFar]}>
              {format(v)}
            </Text>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default memo(WheelColumn);

const makeS = themedStyles((c) => StyleSheet.create({
  band: { position: 'absolute', left: 0, right: 0, top: WHEEL_ITEM_H * Math.floor(VISIBLE / 2), height: WHEEL_ITEM_H, borderRadius: 14, backgroundColor: c.ui.in2 },
  item: { height: WHEEL_ITEM_H, lineHeight: WHEEL_ITEM_H, textAlign: 'center', fontFamily: 'Inter_900Black', fontVariant: ['tabular-nums'] },
  itemOn: { fontSize: 32, color: c.text.bright },
  itemNear: { fontSize: 24, color: c.text.secondary, opacity: 0.8 },
  itemFar: { fontSize: 20, color: c.text.muted, opacity: 0.45 },
}));
