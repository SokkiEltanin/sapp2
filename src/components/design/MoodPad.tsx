import { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { type MoodLevel, MOOD_LABELS, MOOD_COLORS, ENERGY_LABELS, ENERGY_COLORS } from '@/types/mood';

// `MoodPad` — design/app-design.html §Komponenty "MoodPad – pole 2D (X = przyjemność,
// Y = energia), drag". ZASTĘPUJE `MoodEnergyGrid.tsx` (ta sama, już battle-tested na
// urządzeniu `Gesture.Pan()` mechanika — port 1:1 z sapp, 5×5 nastrój×energia,
// `GestureDetector`/`runOnJS` bez zmian) — reskin, nie przebudowa logiki gestów.
//
// Różnice wizualne vs `MoodEnergyGrid` (Faza 3.3, 2026-11-01, user: "zacznij
// przebudowe" na design/app-design.html, zasada #5 "Zero emoji"):
// - ZERO emoji w kropce/odczycie (było `MOOD_EMOJIS[mood]` jako tekst kropki) —
//   sama kropka (kolor = energia, pełna gdy ustawione) + tekst `MOOD_LABELS ·
//   ENERGY_LABELS` pod spodem, bez glifów.
// - Bez widocznych linii siatki 5×5 (spec nie ma ich — tylko subtelna tekstura tła
//   i krzyż przez środek) — interakcja wciąż kwantyzuje do 5 poziomów (model danych
//   BEZ ZMIAN, "już dobrze zaprojektowany" — patrz komentarz w types/mood.ts), tylko
//   wygląda płynniej bez linii.
// - ŚWIADOMIE UPROSZCZONE względem spec: brak tekstury tła z powtarzających się
//   kropek (`background-image:radial-gradient` w CSS, RN nie ma odpowiednika bez
//   obrazka/SVG-wzoru) i brak blurowanego "glow" pod kropką (`.pad .glow`) — płaskie
//   tło `colors.ui.in` zamiast tego. Czysto kosmetyczne niuanse, nie wart
//   dodatkowego SVG-wzoru na tym etapie.
// - `mini` — kompaktowy podgląd (Daily, wiersz "Nastrój"), WYŁĄCZNIE wizualny (bez
//   `GestureDetector` — tap na CAŁY WIERSZ w `daily.tsx` otwiera `MoodModal`, mini-pad
//   sam nie jest przeciągalny, nie udajemy interaktywności miniatury).
// - `big` — pokazuje etykiety narożników/ćwiartek (pełny popup `MoodModal`).
const LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];

export default function MoodPad({
  mood,
  energy,
  onChange,
  mini = false,
  big = false,
  history = [],
}: {
  mood?: MoodLevel;
  energy?: MoodLevel;
  onChange?: (mood: MoodLevel, energy: MoodLevel) => void;
  mini?: boolean;
  big?: boolean;
  history?: { mood: MoodLevel; energy: MoodLevel }[];
}) {
  const s = makeS();
  const lastKey = useSharedValue(-1);
  const { width: winWidth } = useWindowDimensions();
  const size = mini ? 76 : Math.min(300, winWidth - spacing[4] * 2 - 2);
  const cell = size / 5;

  const commit = (m: MoodLevel, e: MoodLevel) => onChange?.(m, e);

  const pan = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .enabled(!mini && !!onChange)
    .onUpdate((evt) => {
      'worklet';
      const col = Math.min(4, Math.max(0, Math.floor(evt.x / cell)));
      const row = Math.min(4, Math.max(0, Math.floor(evt.y / cell)));
      const key = row * 5 + col;
      if (key !== lastKey.value) {
        lastKey.value = key;
        runOnJS(commit)((col + 1) as MoodLevel, (5 - row) as MoodLevel);
      }
    }),
  [cell, mini, onChange]);

  const dotX = useRef(new Animated.Value(0)).current;
  const dotY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const col = mood ? mood - 1 : 2;
    const row = energy ? 5 - energy : 2;
    Animated.spring(dotX, { toValue: col * cell, useNativeDriver: true, damping: 16, stiffness: 220 }).start();
    Animated.spring(dotY, { toValue: row * cell, useNativeDriver: true, damping: 16, stiffness: 220 }).start();
  }, [mood, energy, cell]);

  const hasValue = !!mood && !!energy;
  const ringColor = energy ? ENERGY_COLORS[energy] : colors.text.muted;
  const dotSize = mini ? 12 : 24;

  const pad = (
    <View style={[s.pad, { width: size, height: size, borderRadius: mini ? radius.chip : radius.lg }]}>
      <View style={[s.crossV, { left: size / 2 }]} />
      <View style={[s.crossH, { top: size / 2 }]} />

      {big && (
        <>
          <Text style={[s.axis, s.axisTop]}>Więcej energii</Text>
          <Text style={[s.axis, s.axisBottom]}>Mniej energii</Text>
          <Text style={[s.axis, s.axisLeft]}>Nieprzyjemnie</Text>
          <Text style={[s.axis, s.axisRight]}>Przyjemnie</Text>
        </>
      )}

      {!mini && history.slice(0, -1).map((h, i) => (
        <View
          key={i}
          style={[s.histDot, { left: ((h.mood - 1) / 4) * size, top: (1 - (h.energy - 1) / 4) * size }]}
        />
      ))}

      {!mini && onChange ? (
        <GestureDetector gesture={pan}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[s.dotWrap, { width: cell, height: cell, transform: [{ translateX: dotX }, { translateY: dotY }] }]}
      >
        <View style={[s.dot, { width: dotSize, height: dotSize, borderColor: ringColor, backgroundColor: hasValue ? ringColor + '33' : 'transparent' }]} />
      </Animated.View>
    </View>
  );

  if (mini) return pad;

  return (
    <View style={s.container}>
      {pad}
      <Text style={[s.readout, { color: hasValue ? ringColor : colors.text.muted }]} numberOfLines={1}>
        {hasValue ? `${MOOD_LABELS[mood!]} · ${ENERGY_LABELS[energy!]}` : 'Jeszcze nie zaznaczono'}
      </Text>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  container: { alignItems: 'center', gap: spacing[2] },
  pad: {
    backgroundColor: c.ui.in, overflow: 'hidden', position: 'relative',
    borderWidth: 1, borderColor: c.border.default,
  },
  crossV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: c.ui.line },
  crossH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: c.ui.line },
  axis: { position: 'absolute', fontSize: 9, fontFamily: 'Inter_800ExtraBold', letterSpacing: 1, color: c.text.muted, textTransform: 'uppercase' },
  axisTop: { top: 10, left: 0, right: 0, textAlign: 'center' },
  axisBottom: { bottom: 10, left: 0, right: 0, textAlign: 'center' },
  axisLeft: { left: 9, top: '48%' },
  axisRight: { right: 9, top: '48%' },
  histDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: c.ui.dim, marginLeft: -3, marginTop: -3 },
  dotWrap: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  dot: { borderRadius: 999, borderWidth: 2 },
  readout: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', textAlign: 'center' },
}));
