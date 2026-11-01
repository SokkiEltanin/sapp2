import { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { spacing, radius, themedStyles } from '@/theme';

// `Tile` — kafelek z design/app-design.html §Komponenty (Faza 3.1). Jeden, wspólny
// kontener dla WSZYSTKICH kafelków ekranów głównych (Dashboard/Daily/Finanse/Zadania),
// zamiast każdy ekran budujący własne `View`+`StyleSheet` od zera (jak dotąd — patrz
// StatTile.tsx w dashboard/, które robi to osobno; migracja na `Tile` ekran-po-ekranie
// w kolejnych fazach, nie w tej samej rundzie co fundament).
//
// Scale-on-press (spec: `transform:scale(.975)`, `transition .15s`) — `Pressable` z
// `react-native-gesture-handler` (NIE `react-native`'s własny — ten z RNGH współpracuje
// z `@gorhom/bottom-sheet`'s gesture context, zwykły `Pressable` potrafi "zjeść" gesty
// wewnątrz otwartego sheeta). Animacja skali przez `Animated.Value` na wątku UI, ten
// sam wzorzec co `TabIcon` w TabBar.tsx — tło PRZY PRESSIE zmienia się bez animacji
// (jak tam), to czysto kosmetyczny niuans nie wart Animated.Value na kolorze.
export type TileVariant = 'default' | 'hot' | 'static';

export default function Tile({
  onPress,
  variant = 'default',
  row = false,
  pulse = false,
  style,
  children,
}: {
  onPress?: () => void;
  variant?: TileVariant;
  row?: boolean;
  pulse?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const s = makeS();
  const scale = useRef(new Animated.Value(1)).current;
  const isStatic = variant === 'static' || !onPress;

  const animateTo = (v: number) => {
    Animated.timing(scale, { toValue: v, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  const content = (
    <Animated.View
      style={[
        s.base,
        row && s.row,
        variant === 'hot' && s.hot,
        { transform: [{ scale }] },
        style,
      ]}
    >
      {variant === 'hot' && pulse && <PulseDot />}
      {children}
    </Animated.View>
  );

  if (isStatic) return content;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.975)}
      onPressOut={() => animateTo(1)}
    >
      {content}
    </Pressable>
  );
}

// `.pulse` (spec: box-shadow animujący się 0→7px przezroczystego pierścienia w pętli
// 1.6s) — RN nie ma `box-shadow` do animowania w ten sposób, więc odtworzone jako
// `Animated.View` ze skalującym się + wygaszającym pierścieniem OKOŁO kropki, ten sam
// wizualny efekt (rozchodzące się kółko), inna technika.
function PulseDot() {
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
    <View style={pulseS.wrap}>
      <Animated.View style={[pulseS.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
      <View style={pulseS.dot} />
    </View>
  );
}

const pulseS = StyleSheet.create({
  wrap: { position: 'absolute', top: 9, right: 9, width: 6, height: 6, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#000' },
  ring: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#000' },
});

const makeS = themedStyles((c) => StyleSheet.create({
  base: {
    backgroundColor: c.bg.card, borderRadius: radius.tile, padding: spacing[3],
    minWidth: 0, overflow: 'hidden', flexDirection: 'column',
  },
  row: { flexDirection: 'row' },
  hot: { backgroundColor: c.text.primary },
}));
