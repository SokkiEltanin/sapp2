import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

// Listy "pokazują tyle wierszy, ile wejdzie" — CLAUDE.md regl #1 (dosłowny przepis:
// `onLayout` → `Math.floor(h / rowH)` → `slice`), ten sam mechanizm co `fit()` w
// design/app-design.html. Zamiast liczyć na sztywną liczbę wierszy per-ekran (jak
// stary Dashboard — zawsze "4 pierwsze"), mierzy RZECZYWISTĄ dostępną wysokość
// kontenera (zależną od wysokości ekranu/czcionek systemowych/insets) i dociąga
// tyle pozycji ile się faktycznie zmieści, zero ucinania w połowie wiersza i zero
// nadmiarowego scrolla na ekranach głównych.
export default function FitList<T>({
  data,
  itemHeight,
  gap = 4,
  renderItem,
  keyExtractor,
  empty,
  style,
}: {
  data: T[];
  itemHeight: number;
  gap?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  empty?: React.ReactNode;
  style?: object;
}) {
  const [visibleCount, setVisibleCount] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    const n = Math.max(0, Math.floor((h + gap) / (itemHeight + gap)));
    setVisibleCount((prev) => (prev === n ? prev : n));
  };

  // Pierwszy render (wysokość jeszcze nieznana) = nic, zamiast migającego
  // nadmiaru — `onLayout` strzela w tej samej klatce montowania, więc ta pusta
  // chwila jest w praktyce niewidoczna (ten sam kompromis co `setTimeout(fit,0)`
  // w oryginalnym mockupie).
  const visible = visibleCount == null ? [] : data.slice(0, visibleCount);

  return (
    <View style={[{ flex: 1, gap }, style]} onLayout={onLayout}>
      {visible.length === 0 && visibleCount != null ? empty : visible.map((it, i) => renderItem(it, i))}
    </View>
  );
}
