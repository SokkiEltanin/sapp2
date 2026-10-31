import { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { type MoodLevel, MOOD_LABELS, MOOD_COLORS, MOOD_EMOJIS, ENERGY_LABELS, ENERGY_COLORS } from '@/types/mood';

// Port z sapp (src/components/mood/MoodEnergyGrid.tsx) 1:1 — siatka 5×5 nastrój(X)×energia(Y),
// JEDEN `Gesture.Pan()` obsługuje tap i przeciągnięcie naraz, "circumplex model of affect"
// (psychologia: walencja pozioma, pobudzenie pionowe), już battle-tested na urządzeniu.
// Adaptacje do sapp2: brak `useColors()`/per-render `useMemo(makeStyles)` — appka jest
// dark-only, `themedStyles` cache'uje wynik raz (patrz theme/index.ts), zero potrzeby na
// dynamiczny theme. Brak `haptic.medium()` w `commit` — `utils/haptics.ts` nie istnieje
// jeszcze w sapp2 (Finanse Faza 2.6, patrz ARCHITECTURE.md), wibracje wracają tu gdy ten
// plik powstanie, nie wcześniej.
const LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];

export default function MoodEnergyGrid({
  mood, energy, onChange,
}: {
  mood?: MoodLevel;
  energy?: MoodLevel;
  onChange: (mood: MoodLevel, energy: MoodLevel) => void;
}) {
  const s = makeS();
  const lastKey = useSharedValue(-1);
  // Szerokość WPROST z okna, nie z layoutu rodzica (sapp, 2026-09-30/10-02: siatka
  // martwa/ścieśniona wewnątrz natywnego Modal-a — `onLayout` niepewny w portowanej
  // natywnej hierarchii modala, patrz komentarz w MoodModal.tsx przy GestureHandlerRootView).
  const { width: winWidth } = useWindowDimensions();
  const gridBleedWidth = winWidth - 2;
  const gridHeight = Math.min(260, gridBleedWidth);
  const cellX = gridBleedWidth / 5;
  const cellY = gridHeight / 5;

  const commit = (m: MoodLevel, e: MoodLevel) => onChange(m, e);

  const pan = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .onUpdate((evt) => {
      'worklet';
      const col = Math.min(4, Math.max(0, Math.floor(evt.x / cellX)));
      const row = Math.min(4, Math.max(0, Math.floor(evt.y / cellY)));
      const key = row * 5 + col;
      if (key !== lastKey.value) {
        lastKey.value = key;
        runOnJS(commit)((col + 1) as MoodLevel, (5 - row) as MoodLevel);
      }
    }),
  [cellX, cellY]);

  const dotX = useRef(new Animated.Value(0)).current;
  const dotY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const col = mood ? mood - 1 : 2;
    const row = energy ? 5 - energy : 2;
    Animated.spring(dotX, { toValue: col * cellX, useNativeDriver: true, damping: 16, stiffness: 220 }).start();
    Animated.spring(dotY, { toValue: row * cellY, useNativeDriver: true, damping: 16, stiffness: 220 }).start();
  }, [mood, energy, cellX, cellY]);

  const hasValue = !!mood && !!energy;
  const ringColor = energy ? ENERGY_COLORS[energy] : colors.text.muted;

  return (
    <View style={s.container}>
      <Text style={[s.sectionLabel, s.inset]}>Nastrój i energia</Text>
      <Text style={[s.hint, s.inset]}>przeciągnij lub tapnij — w prawo lepszy nastrój, w górę więcej energii</Text>

      <View style={[s.gridWrap, { width: gridBleedWidth, height: gridHeight }]}>
        <LinearGradient
          colors={[colors.bg.elevated, MOOD_COLORS[5] + '22']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {LEVELS.slice(1).map((i) => (
            <View key={`v${i}`} style={[s.vLine, { left: `${(i - 1) * 20 + 20}%` }]} />
          ))}
          {LEVELS.slice(1).map((i) => (
            <View key={`h${i}`} style={[s.hLine, { top: `${(i - 1) * 20 + 20}%` }]} />
          ))}
        </View>

        <GestureDetector gesture={pan}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>

        <Animated.View
          pointerEvents="none"
          style={[s.dot, { width: cellX, height: cellY, transform: [{ translateX: dotX }, { translateY: dotY }] }]}
        >
          <View style={[s.dotInner, { borderColor: ringColor, backgroundColor: hasValue ? ringColor + '33' : colors.bg.card }]}>
            <Text style={s.dotEmoji}>{mood ? MOOD_EMOJIS[mood] : '·'}</Text>
          </View>
        </Animated.View>
      </View>

      <Text style={[s.readout, s.inset, { color: hasValue ? ringColor : colors.text.muted }]} numberOfLines={1}>
        {hasValue
          ? `${MOOD_EMOJIS[mood!]} ${MOOD_LABELS[mood!]}  ·  ${ENERGY_LABELS[energy!]}`
          : 'Jeszcze nie zaznaczono'}
      </Text>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  container: { gap: spacing[2] },
  inset: { paddingHorizontal: spacing[4] },
  sectionLabel: {
    fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: c.text.muted, marginTop: -2 },

  gridWrap: {
    marginHorizontal: -spacing[4],
    borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: c.border.default,
  },
  vLine: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: c.border.subtle },
  hLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.border.subtle },

  dot: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  dotInner: {
    width: '78%', height: '78%', borderRadius: radius.full,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  dotEmoji: { fontSize: 22 },

  readout: { fontSize: 14, fontFamily: 'Inter_900Black', textAlign: 'center' },
}));
