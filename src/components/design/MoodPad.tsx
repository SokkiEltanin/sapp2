import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { MOOD_LABELS, MOOD_COLORS, ENERGY_LABELS, ENERGY_COLORS, roundLevel } from '@/types/mood';

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
//   i krzyż przez środek).
// - Przeciąganie JUŻ NIE kwantyzuje do 5×5 siatki (2026-11-04, user: "humor musi być
//   smooth a nie punktowy... liczy się w procentach... droga to promień w każdym
//   kierunku jakby smooth") — kropka śledzi palec w 100% ciągłych współrzędnych
//   pada (`mood`/`energy` to teraz `number` 1..5, nie `MoodLevel`, patrz
//   `types/mood.ts`), kolor/etykieta (`MOOD_COLORS` itp., klucze TYLKO 1-5 całkowite)
//   dostają zaokrągloną wartość przez `roundLevel()`.
// - Tekstura tła z powtarzających się kropek (`background-image:radial-gradient` w
//   spec) ŚWIADOMIE pominięta — RN nie ma odpowiednika bez obrazka/powtarzanego
//   SVG-wzoru, zbyt kosmetyczny niuans żeby budować to osobno. "Glow" pod kropką
//   (`.pad .glow`) i PIONOWE (obrócone) etykiety osi lewej/prawej (`.pad .ax.al/.ar`,
//   `writing-mode:vertical-rl`) DOSTAŁY realną implementację (2026-11-04, user po
//   zrzucie: "jak było w tym prezencie... napisy bokiem... i gradient... i widoczne
//   wcześniejsze oznaczenia") — glow przez `react-native-svg`'s `RadialGradient`
//   (appka już miała tę zależność, nie nowy koszt), etykiety przez `transform:
//   rotate` na `Text` wewnątrz wyśrodkowanego (flex) wrappera — rotacja w RN jest
//   PRZY MALOWANIU, nie zmienia layoutu, więc wrapper musi wyśrodkować tekst PRZED
//   obrotem, inaczej pivot ucieka.
// - `mini` — kompaktowy podgląd (Daily, wiersz "Nastrój"), WYŁĄCZNIE wizualny (bez
//   `GestureDetector` — tap na CAŁY WIERSZ w `daily.tsx` otwiera `MoodModal`, mini-pad
//   sam nie jest przeciągalny, nie udajemy interaktywności miniatury).
// - `big` — pokazuje etykiety narożników/ćwiartek (pełny popup `MoodModal`).
export default function MoodPad({
  mood,
  energy,
  onChange,
  mini = false,
  big = false,
  history = [],
}: {
  mood?: number;
  energy?: number;
  onChange?: (mood: number, energy: number) => void;
  mini?: boolean;
  big?: boolean;
  history?: { mood: number; energy: number }[];
}) {
  const s = makeS();
  // Klucz throttlujący `runOnJS` do ~0.02 kroku (nie co ramkę gestu, patrz niżej) —
  // zaokrąglona do 2 miejsc wartość zakodowana w jednej liczbie (mood*1000+energy).
  const lastKey = useSharedValue(-1);
  const { width: winWidth } = useWindowDimensions();
  const size = mini ? 76 : Math.min(300, winWidth - spacing[4] * 2 - 2);
  const dotSize = mini ? 12 : 24;
  const glowSize = mini ? 70 : 180;

  const commit = (m: number, e: number) => onChange?.(m, e);
  // `dragging` (2026-11-08, user: "laguje tylko wtedy gdy przesuwam palec, jak
  // klikam w miejscu pojedyńczym skacze płynnie") — przyczyna: PONIŻSZY
  // `useEffect` odpalał `Animated.spring` przy KAŻDYM (throttlowanym, ale wciąż
  // częstym w trakcie przeciągania) commicie, więc kolejna sprężyna przerywała
  // poprzednią w połowie lotu i startowała od nowa z jej aktualnej, "w locie"
  // pozycji — seria przerywanych, walczących ze sobą animacji zamiast jednego
  // płynnego ruchu. Pojedynczy tap robi to RAZ, więc wygląda płynnie. Fix:
  // podczas aktywnego gestu kropka skacze NATYCHMIAST na pozycję palca
  // (`setValue`, zero animacji — i tak jest 1:1 z ruchem palca, animacja by tu
  // tylko dokładała opóźnienie), sprężynowe "doskoczenie" zostaje WYŁĄCZNIE dla
  // zmian programowych (np. otwarcie edycji istniejącego wpisu, początkowy
  // render) gdzie faktycznie wygląda ładnie.
  const [dragging, setDragging] = useState(false);

  const pan = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .enabled(!mini && !!onChange)
    .onBegin(() => {
      'worklet';
      runOnJS(setDragging)(true);
    })
    .onUpdate((evt) => {
      'worklet';
      const fracX = Math.min(1, Math.max(0, evt.x / size));
      const fracY = Math.min(1, Math.max(0, evt.y / size));
      const m = 1 + fracX * 4;
      const e = 5 - fracY * 4;
      // Throttling na 0.02 (200 kroków na oś) — wizualnie nieodróżnialne od pełnej
      // ciągłości (sub-pikselowe na padzie 300px), ale nie zalewa mostka JS
      // `runOnJS`-em na KAŻDEJ z ~60 ramek/s gestu.
      const key = Math.round(m * 50) * 100000 + Math.round(e * 50);
      if (key !== lastKey.value) {
        lastKey.value = key;
        runOnJS(commit)(m, e);
      }
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(setDragging)(false);
    }),
  [size, mini, onChange]);

  const dotX = useRef(new Animated.Value(0)).current;
  const dotY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const m = mood ?? 3;
    const e = energy ?? 3;
    const px = ((m - 1) / 4) * size - dotSize / 2;
    const py = (1 - (e - 1) / 4) * size - dotSize / 2;
    if (dragging) {
      dotX.setValue(px);
      dotY.setValue(py);
    } else {
      Animated.spring(dotX, { toValue: px, useNativeDriver: true, damping: 16, stiffness: 220 }).start();
      Animated.spring(dotY, { toValue: py, useNativeDriver: true, damping: 16, stiffness: 220 }).start();
    }
  }, [mood, energy, size, dotSize, dragging]);

  const hasValue = !!mood && !!energy;
  const ringColor = energy ? ENERGY_COLORS[roundLevel(energy)] : colors.text.muted;

  const pad = (
    <View style={[s.pad, { width: size, height: size, borderRadius: mini ? radius.chip : radius.lg }]}>
      <View style={[s.crossV, { left: size / 2 }]} />
      <View style={[s.crossH, { top: size / 2 }]} />

      {big && (
        <>
          <Text style={[s.axis, s.axisTop]}>Więcej energii</Text>
          <Text style={[s.axis, s.axisBottom]}>Mniej energii</Text>
          {/* 2026-11-09, user: zrzut — "Nieprzyjemnie"/"Przyjemnie" renderowały
              się jako porozrzucane, nachodzące na siebie fragmenty zamiast
              jednego słowa bokiem. `axisVWrap` jest CELOWO wąski (22px, tyle
              miejsca ile ma na padzie) — Text bez WŁASNYCH jawnych wymiarów
              mierzy się WEWNĄTRZ tego ograniczenia (Yoga przekazuje dostępną
              szerokość rodzica do pomiaru tekstu nawet przy `alignItems:
              'center'`, nie tylko przy `'stretch'`), więc zawijał się do 22px
              PRZED obrotem (layout liczy się przed malowaniem/transformem) —
              rotacja obracała już połamany, wielowierszowy blok. Samo
              `numberOfLines={1}` nie wystarczyło (zweryfikowane: nadal
              obcinało się z "…" zamiast wylewać poza wąski kontener). Fix:
              jawne `width:110, height:14` NA SAMYM Tekście (`axisVRotateLeft/
              Right`, nie na wrapperze) — oba wymiary Exactly, Yoga nie mierzy
              tekstu wcale, zero zależności od dostępnej szerokości rodzica.
              `textAlign:'center'` centruje w TEJ własnej szerokości (pivot
              obrotu zostaje na środku kolumny, bo rotacja liczy się względem
              środka elementu niezależnie od tego jak szeroki jest). */}
          <View style={[s.axisVWrap, s.axisVLeft]}>
            <Text style={[s.axis, s.axisVRotateLeft]}>Nieprzyjemnie</Text>
          </View>
          <View style={[s.axisVWrap, s.axisVRight]}>
            <Text style={[s.axis, s.axisVRotateRight]}>Przyjemnie</Text>
          </View>
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
        style={[s.dotWrap, { width: dotSize, height: dotSize, transform: [{ translateX: dotX }, { translateY: dotY }] }]}
      >
        {hasValue && (
          <Svg width={glowSize} height={glowSize} style={[s.glow, { width: glowSize, height: glowSize, marginLeft: -glowSize / 2, marginTop: -glowSize / 2 }]}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={ringColor} stopOpacity={0.16} />
                <Stop offset="1" stopColor={ringColor} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill="url(#glow)" />
          </Svg>
        )}
        <View style={[s.dot, { width: dotSize, height: dotSize, borderColor: ringColor, backgroundColor: hasValue ? ringColor + '33' : 'transparent' }]} />
      </Animated.View>
    </View>
  );

  if (mini) return pad;

  return (
    <View style={s.container}>
      {pad}
      <Text style={[s.readout, { color: hasValue ? ringColor : colors.text.muted }]} numberOfLines={1}>
        {hasValue ? `${MOOD_LABELS[roundLevel(mood!)]} · ${ENERGY_LABELS[roundLevel(energy!)]}` : 'Jeszcze nie zaznaczono'}
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
  axis: { fontSize: 9, fontFamily: 'Inter_800ExtraBold', letterSpacing: 1, color: c.text.muted, textTransform: 'uppercase' },
  axisTop: { position: 'absolute', top: 10, left: 0, right: 0, textAlign: 'center' },
  axisBottom: { position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center' },
  // Pionowe etykiety lewej/prawej osi (spec: `writing-mode:vertical-rl`, RN nie ma
  // tej właściwości) — wrapper rozciągnięty na całą wysokość padu, wyśrodkowany
  // flexem (żeby obrót poniżej miał poprawny pivot — rotacja w RN jest tylko przy
  // malowaniu, nie wpływa na layout, więc tekst MUSI być wyśrodkowany PRZED
  // obrotem, inaczej odjeżdża od zamierzonej pozycji).
  axisVWrap: { position: 'absolute', top: 0, bottom: 0, width: 22, alignItems: 'center', justifyContent: 'center' },
  axisVLeft: { left: 0 },
  axisVRight: { right: 0 },
  // `width` jawnie na samym Tekście (2026-11-09, poprawka na poprawkę —
  // `numberOfLines={1}` samo zatrzymało zawijanie, ale pod react-native-web
  // Text i tak obcinał się z "…" do szerokości 22px kolumny-rodzica zamiast
  // wylewać się poza nią jak przy natywnym Yoga; szeroka, jawna szerokość TU
  // (nie na wrapperze) to naprawia niezależnie od tego jak dana platforma
  // liczy szerokość nieograniczonego Tekstu w wyśrodkowanym flex-rodzicu) —
  // 110 z zapasem nad najdłuższą etykietą ("Nieprzyjemnie", ~90px przy tym
  // foncie), `textAlign:'center'` bo teraz to WŁASNA szerokość Tekstu, nie
  // flex-centering rodzica.
  axisVRotateLeft: { transform: [{ rotate: '-90deg' }], width: 110, height: 14, textAlign: 'center' },
  axisVRotateRight: { transform: [{ rotate: '90deg' }], width: 110, height: 14, textAlign: 'center' },
  histDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: c.ui.dim, marginLeft: -3, marginTop: -3 },
  dotWrap: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', top: '50%', left: '50%' },
  dot: { borderRadius: 999, borderWidth: 2 },
  readout: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', textAlign: 'center' },
}));
