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

  const chrome = [s.base, row && s.row, variant === 'hot' && s.hot];

  if (isStatic) {
    return (
      <Animated.View style={[...chrome, style, { transform: [{ scale }] }]}>
        {variant === 'hot' && pulse && <PulseDot />}
        {children}
      </Animated.View>
    );
  }

  // BUG #1, znaleziony na urządzeniu (2026-11-02, user: kafel "Nastrój" w Daily
  // renderował się jako wąski pasek zamiast pełnej szerokości rzędu) — `style`
  // (np. `flex:1`/`flex:3`) trafiał TYLKO na wewnętrzny `Animated.View`, nigdy
  // na `Pressable`, FAKTYCZNE dziecko rzędu (`flexDirection:'row'`). Flex bez
  // wpływu na WŁASNEGO rodzica nic nie daje — `Pressable` kurczył się do
  // rozmiaru treści.
  //
  // BUG #2 (złapany dopiero w izolowanym teście react-native-web z
  // zmierzonymi `getBoundingClientRect()`, nie samym oglądaniem screena —
  // pierwsza łatka WYGLĄDAŁA poprawna w review, ale zmierzony layout pokazał
  // że wewnętrzny `Animated.View` i tak renderował się węższy, WYŚRODKOWANY
  // w poprawnie-rozmiarowanym już `Pressable`) — naiwna poprawka #1 kładła
  // CAŁE `style` (np. `alignItems:'center'`, które ma układać DZIECI kafla:
  // MoodPad + kolumnę tekstu) TAKŻE na `Pressable`. `Pressable` jest
  // kontenerem `flexDirection:'column'` z JEDNYM dzieckiem (`Animated.View`)
  // — `alignItems:'center'` na nim NIE jest neutralne: jawnie WYŁĄCZA
  // domyślne `stretch` (rozciągnięcie dziecka na 100% szerokości) na rzecz
  // wyśrodkowania dziecka w jego WŁASNYM, skurczonym rozmiarze. Innymi słowy
  // `alignItems`/`justifyContent` ze `style` mają sens TYLKO dla układu
  // WEWNĄTRZ kafla (na `Animated.View`), nigdy dla samego `Pressable`, który
  // ma dokładnie jedno dziecko i zawsze powinien je rozciągać w 100%.
  //
  // Fix: `Pressable` dostaje `style` (dla `flex`/`width`/`margin` — rozmiar
  // WZGLĘDEM rodzica), ale `alignItems:'stretch'` jest NADPISANE na sztywno
  // PO `style`, więc żadne `alignItems` z wołającego ekranu nigdy go nie
  // wyłączy. Cały `style` (z oryginalnym `alignItems`/`gap`/itp.) ląduje
  // RÓWNIEŻ na `Animated.View` — tam te właściwości mają faktyczne,
  // zamierzone znaczenie (układ MoodPad+tekst wewnątrz kafla).
  return (
    <Pressable
      style={[style, s.stretch]}
      onPress={onPress}
      onPressIn={() => animateTo(0.975)}
      onPressOut={() => animateTo(1)}
    >
      <Animated.View style={[...chrome, s.fill, style, { transform: [{ scale }] }]}>
        {variant === 'hot' && pulse && <PulseDot />}
        {children}
      </Animated.View>
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
    // `flex: 1` DOMYŚLNIE (2026-11-02, ten sam bug co opisany wyżej) — bez tego
    // kafel BEZ jawnego `flex`/`width` w `style` (np. StatTile, które go w ogóle
    // nie przyjmuje) kurczył się do rozmiaru treści zamiast równo dzielić
    // szerokość rzędu z rodzeństwem — każdy wiersz 2/3/4 kafli wyglądał krzywo,
    // nie jak siatka. Jawny `flex`/`width` w `style` wołającego i tak wygrywa
    // (merge'owany PO `base`).
    flex: 1,
    minWidth: 0, overflow: 'hidden', flexDirection: 'column',
  },
  row: { flexDirection: 'row' },
  hot: { backgroundColor: c.text.primary },
  fill: { flex: 1 },
  stretch: { alignItems: 'stretch' },
}));
