import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { themedStyles } from '@/theme';

// `Toggle` (spec: `.tog`, design/app-design.html) — przełącznik monochromatyczny,
// NIE natywny `Switch` (2026-11-02, user: "miało być 1do1" po Ustawieniach — natywny
// `Switch` z `trackColor.true: colors.accent.green` łamał własną zasadę appki "kolor
// niesie znaczenie TYLKO jako funkcjonalny akcent" (patrz colors.ts), bo kolorował
// stan "włączone" zielenią, czego spec nigdzie nie robi). ON = jasny tor (`text.
// primary`, czyli `--txt` ze spec) + czarna kropka PO PRAWEJ; OFF = ciemny tor
// (`ui.in2`) + wygaszona kropka (`text.muted`) PO LEWEJ — dokładne wartości z `.tog`/
// `.tog.off`.
export default function Toggle({ value, onValueChange }: { value: boolean; onValueChange: () => void }) {
  const s = makeS();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });

  return (
    <Pressable onPress={onValueChange} style={[s.track, value ? s.trackOn : s.trackOff]} hitSlop={6}>
      <Animated.View style={[s.dot, value ? s.dotOn : s.dotOff, { transform: [{ translateX }] }]} />
    </Pressable>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  track: { width: 42, height: 24, borderRadius: 999, flexShrink: 0 },
  trackOn: { backgroundColor: c.text.primary },
  trackOff: { backgroundColor: c.ui.in2 },
  dot: { position: 'absolute', left: 3, top: 3, width: 18, height: 18, borderRadius: 9 },
  dotOn: { backgroundColor: '#000000' },
  dotOff: { backgroundColor: c.text.muted },
}));
