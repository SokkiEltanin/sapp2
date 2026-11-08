import { useRef, useEffect, useState } from 'react';
import {
  Modal, View, StyleSheet, ScrollView, TouchableWithoutFeedback,
  KeyboardAvoidingView, Platform, Animated, Easing, Dimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme';

// Popup uniwersalny z design/app-design.html §Komponenty "BottomSheet".
//
// PRZEBUDOWANY OD ZERA (2026-11-04, Faza 3.15, KRYTYCZNE) — poprzednia wersja
// (Faza 3.1-3.14) owijała `@gorhom/bottom-sheet`'s `BottomSheetModal`. User
// zgłosił, powtarzalnie na realnym Samsungu: KAŻDY popup w appce (Humor,
// "+" w Zadaniach, Finanse...) nie otwierał się WCALE — zero błędu, haptic
// działał (stan się zmieniał), ale nic się wizualnie nie pojawiało. Dwa
// targetowane fixy w `@gorhom/bottom-sheet` (overrideReduceMotion, patrz git
// log) NIE pomogły. Diagnostyka `Alert.alert()` tuż przed `.present()`
// POTWIERDZIŁA: alert się pokazywał (więc JS/dotyk/natywne nakładki działają
// OGÓLNIE na tym telefonie), ale sam sheet dalej nie — czyli problem był
// w 100% izolowany do samej biblioteki `@gorhom/bottom-sheet`/jej
// reanimated-worklet-driven mechanizmu pozycjonowania na tym konkretnym
// urządzeniu (znany, udokumentowany na GitHubie projektu jako klasa bugów
// na Androidzie/Samsungu, bez jednego pewnego fixu).
//
// Zamiast dalej zgadywać kolejne opcje głęboko wewnątrz cudzej biblioteki,
// CAŁY mechanizm prezentacji zamieniony na goły, wbudowany RN `Modal`
// (`animationType="slide"`) — to natywna animacja okna systemu
// (Android/iOS), ZERO zależności od reanimated/worklets/gorhom. Jeśli to
// też nie zadziała na jakimś urządzeniu, to już nie problem tej appki, tylko
// samego RN `Modal`-a (skrajnie mało prawdopodobne — to jeden z
// najstarszych, najbardziej przetestowanych prymitywów frameworka).
// Backdrop (blur+przyciemnienie, tap=zamknij) własny, prosty `View`+
// `TouchableWithoutFeedback`, bez animacji (świadomie — cel tej przebudowy
// to USUNĄĆ wszystkie ruchome części które mogły być winne, nie dodać nowe).
//
// Zewnętrzny kontrakt (`visible`/`onClose`/`header`/`footer`/`scrollable`/
// `children`) BEZ ZMIAN — każdy z ~10 konsumentów w appce działa bez
// modyfikacji. JEDNA zmiana dotykająca konsumentów: `BottomSheetTextInput`/
// `BottomSheetFlatList` (gorhom, wymagały `BottomSheetModalProvider`z
// kontekstu którego już nie ma) zamienione z powrotem na zwykłe
// `TextInput`/`FlatList` z 'react-native' wszędzie gdzie były użyte —
// bezpieczne, bo oryginalny powód ich użycia ("zwykły TextInput gubi
// fokus przy przewijaniu Z GESTEM sheeta") już nie dotyczy: ten sheet nie
// ma własnego gestu przeciągania wcale (zamykanie TYLKO przez przycisk X/
// tap w tło), więc nie ma już z czym konkurować o dotyk.
//
// "Dynamiczny" rozmiar (rośnie do treści, max 78% ekranu, od tego momentu
// scrolluje) osiągnięty BEZ żadnej biblioteki pomiarowej — `sheet` ma
// `maxHeight`, `header`/`footer` są zwykłymi (nie-flex) dziećmi, środkowy
// `ScrollView` dostaje `flexShrink: 1` (nie `flex: 1`) — standardowy trik
// RN: kurczy się do dostępnego miejsca gdy treść za duża, ale NIE rozciąga
// się na siłę gdy treści mało (to dawał `enableDynamicSizing` w gorhom).
const SCREEN_H = Dimensions.get('window').height;
const DEFAULT_MAX_HEIGHT_RATIO = 0.78;
// Startowe/końcowe przesunięcie sheeta w dół przy animacji wjazdu/zjazdu —
// stały piksel, nie pełna wysokość ekranu: sheet ma dynamiczny rozmiar (rośnie
// do treści), więc nie znamy jego realnej wysokości z góry; 80px daje wyraźny,
// czytelny "wjazd z dołu" bez próby liczenia dokładnej wysokości treści.
const SHEET_OFFSET = 80;

export default function AppBottomSheet({
  visible,
  onClose,
  header,
  footer,
  scrollable = true,
  maxHeightRatio = DEFAULT_MAX_HEIGHT_RATIO,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  scrollable?: boolean;
  // Opcjonalny, wyższy sufit dla sheetów z nietypowo wysoką treścią (2026-11-08,
  // user o Humorze: "nie widać całej siatki jakby bo nie wysuwa się wystarczająco
  // wysoko") — domyślne 78% zostaje dla reszty appki, pojedynczy konsument może
  // poprosić o więcej miejsca zamiast appka globalnie zjadała więcej ekranu
  // wszędzie (np. krótkim popupom nie potrzeba 90% wysokości).
  maxHeightRatio?: number;
  children: React.ReactNode;
}) {
  const s = makeS(maxHeightRatio);
  // Backdrop i sheet animowane OSOBNO, własnym JS-driven `Animated` (NIE
  // reanimated/worklets — świadomie, patrz komentarz wyżej: cel przebudowy był
  // wyeliminować tę warstwę jako podejrzaną, nie wciągnąć ją z powrotem
  // tylnymi drzwiami) — `Modal`'s wbudowane `animationType="slide"` (poprzednia
  // wersja) animowało CAŁĄ zawartość modala jako jedną bryłę, więc blur/
  // przyciemnienie TEŻ wjeżdżało od dołu razem z sheetem zamiast po prostu
  // natychmiast/płynnie się pojawić w miejscu (2026-11-04, user: "ten blur
  // powinien być natychmiastowy smooth a on się wysuwa od dołu"). Teraz
  // `animationType="none"` na `Modal`u, a backdrop (fade opacity) i sheet
  // (translateY) mają NIEZALEŻNE animacje — `modalVisible` (stan lokalny,
  // osobny od propa `visible`) trzyma `Modal` zamontowany przez czas trwania
  // animacji ZAMYKANIA, zanim faktycznie zniknie.
  const [modalVisible, setModalVisible] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SHEET_OFFSET)).current;
  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      backdropOpacity.setValue(0);
      sheetY.setValue(SHEET_OFFSET);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: SHEET_OFFSET, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setModalVisible(false));
    }
  }, [visible, backdropOpacity, sheetY]);

  const Body = scrollable ? ScrollView : View;
  const bodyProps = scrollable
    // `style` (NIE tylko `contentContainerStyle`) z `flexShrink:1` — bez tego
    // `ScrollView` sam, jako komponent, nie ma OGRANICZONEJ wysokości (tylko
    // jego WEWNĘTRZNA treść ją miała), więc po prostu rósł do pełnej
    // wysokości treści zamiast przycinać się do `sheet`'s `maxHeight` i
    // scrollować — user: "nadal nie działa scroll np w paragonie... nie da
    // się scrollować" (2026-11-04).
    ? { style: s.scroll, contentContainerStyle: [s.body, !!footer && s.bodyWithFooter], keyboardShouldPersistTaps: 'handled' as const }
    : { style: [s.body, !!footer && s.bodyWithFooter] };

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* `GestureHandlerRootView` WŁASNY, drugi w appce (2026-11-04, user: w
          Humorze "nie mogę kliknąć" MoodPada) — `Modal` z 'react-native'
          renderuje swoją treść w OSOBNYM natywnym oknie (Android:
          `ReactModalHostView`), poza hierarchią którą opakowuje jedyny
          `GestureHandlerRootView` w `app/_layout.tsx`. `react-native-
          gesture-handler`-owe gesty (MoodPad's `Gesture.Pan()`, `Toggle`/
          `Segmented`'s `Pressable` z tej biblioteki) bez WŁASNEGO roota W
          TYM oknie po prostu się nie rejestrują — dokładnie ten sam
          mechanizm, który `MoodModal.tsx`'s stary komentarz opisywał jako
          "rozwiązany" przejściem z `Modal` na gorhom (portal WEWNĄTRZ
          głównego roota) — Faza 3.15's powrót do `Modal` przywrócił ten
          problem, ten `GestureHandlerRootView` go naprawia ponownie. */}
      <GestureHandlerRootView style={s.root}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
            {/* `experimentalBlurMethod="dimezisBlurView"` (2026-11-04, user:
                "nie ma blur z tyłu") — `expo-blur`'s domyślny tryb na Androidzie
                to `'none'`, czyli CICHO spada do zwykłego przyciemnienia bez
                realnego rozmycia (to był stan rzeczy OD ZAWSZE, nawet pod
                gorhom — po prostu niewidoczny dotąd, bo żaden sheet w ogóle się
                nie otwierał żeby to zobaczyć). Jawne włączenie eksperymentalnej
                natywnej implementacji blura na Androidzie (iOS ma realny blur
                domyślnie, nie dotyczy). */}
            <BlurView
              intensity={24}
              tint="dark"
              style={StyleSheet.absoluteFill}
              experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            />
          </Animated.View>
        </TouchableWithoutFeedback>

        {/* `behavior="height"` na Androidzie (2026-11-04, user: zrzut — po
            tapnięciu w pole tekstowe klawiatura CAŁKOWICIE zasłaniała sheet,
            który zostawał na swojej stałej pozycji "flush bottom" zamiast
            wjechać wyżej) — `Modal` z 'react-native' renderuje się jako
            WŁASNE natywne okno (Android `Dialog`), które NIE dziedziczy
            `android:windowSoftInputMode="adjustResize"` z manifestu
            MainActivity (to ustawienie dotyczy samej Activity, nie
            dowolnego Dialogu nad nią) — stąd klawiatura po prostu nakłada
            się na sheet, nic go nie przesuwa. `"height"` (nie `undefined`
            jak wcześniej) każe `KeyboardAvoidingView` samemu skurczyć się o
            wysokość klawiatury, co przez `sheetOuter`'s
            `justifyContent:'flex-end'` wypycha sheet w górę dokładnie o
            tyle ile trzeba. iOS zostaje przy `"padding"` (standardowy,
            sprawdzony wybór dla tego wzorca na obu platformach). */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.sheetOuter}
          pointerEvents="box-none"
        >
          <Animated.View style={[s.sheet, { transform: [{ translateY: sheetY }] }]}>
            <View style={s.handleWrap}><View style={s.handle} /></View>
            {header && <View style={s.header}>{header}</View>}
            <Body {...bodyProps}>{children}</Body>
            {footer && <View style={s.footer}>{footer}</View>}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const makeS = (maxHeightRatio: number) => StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetOuter: {
    flex: 1, justifyContent: 'flex-end',
    paddingHorizontal: spacing[2], paddingBottom: spacing[2],
  },
  sheet: {
    maxHeight: SCREEN_H * maxHeightRatio,
    backgroundColor: colors.bg.card, borderRadius: radius.sheet,
    borderWidth: 1, borderColor: '#1f1f1f', overflow: 'hidden',
  },
  handleWrap: { alignItems: 'center', paddingTop: spacing[2], paddingBottom: spacing[1] },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.ui.dim },
  header: { paddingHorizontal: spacing[4], paddingTop: spacing[1] },
  // `flexShrink:1` TUTAJ (na samym `ScrollView`, nie tylko na jego
  // `contentContainerStyle`) — to jest to co faktycznie ogranicza jego
  // wysokość do miejsca zostawionego przez `header`/`footer` w `sheet`'s
  // `maxHeight`, więc treść dłuższa niż to miejsce faktycznie scrolluje
  // zamiast rozpychać `sheet` w nieskończoność.
  scroll: { flexShrink: 1 },
  body: { paddingHorizontal: spacing[4], paddingTop: spacing[1], paddingBottom: spacing[4] },
  bodyWithFooter: { paddingBottom: spacing[2] },
  footer: {
    paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[4],
    backgroundColor: colors.bg.card, borderTopWidth: 1, borderTopColor: '#1f1f1f',
  },
});
