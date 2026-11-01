import { useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import {
  BottomSheetModal, BottomSheetView, BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme';

// Popup uniwersalny z design/app-design.html §Komponenty "BottomSheet" (Faza 3.1,
// user: "UZNAJ TEN DESIGN JAKO ABSOLUTNY CORE" — "Każda interakcja otwiera bottom
// sheet"). API ŚWIADOMIE `visible`/`onClose`/`children` — ten sam zewnętrzny kontrakt
// co istniejące `Modal`-owe popupy (WydatkiModal/TransactionsModal/
// FoodCategoryItemsModal/AddExpenseModal), żeby w kolejnych fazach (migracja
// screen-po-screenie, patrz ARCHITECTURE.md) dało się je zamienić na to bez zmiany
// wołającego kodu — tylko WEWNĄTRZ owija `@gorhom/bottom-sheet`'s imperatywne
// `present()`/`dismiss()` (`BottomSheetModal`, nie plain `BottomSheet` — potrzebujemy
// portal-renderingu POZA drzewem wołającego ekranu, inaczej by się przycinało do
// jego granic).
//
// `detached + bottomInset` (nie domyślne "flush to bottom") — jedyny sposób w v5 żeby
// dostać pływający sheet z marginesem 8px z KAŻDEJ strony (lewo/prawo/dół), zgodnie ze
// spec (`.sheet{left:8px;right:8px;bottom:8px}`), nie tylko z góry.
// `enableDynamicSizing` + `maxDynamicContentSize` = 78% wysokości ekranu — sheet
// rośnie do wysokości treści, ale nigdy więcej niż 78% (spec: `max-height:78%`), od
// tego momentu scrolluje WEWNĄTRZ (`BottomSheetView` → scrollview gdy treść nie mieści,
// patrz ekrany korzystające z tego, Faza 3.2+).
const SCREEN_H = Dimensions.get('window').height;
const MAX_SHEET_HEIGHT = SCREEN_H * 0.78;

export default function AppBottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={1}
        style={[props.style, s.backdropBase]}
      >
        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
      </BottomSheetBackdrop>
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onClose}
      detached
      bottomInset={spacing[2]}
      style={s.detachedMargin}
      backgroundStyle={s.background}
      handleIndicatorStyle={s.handle}
      enableDynamicSizing
      maxDynamicContentSize={MAX_SHEET_HEIGHT}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView style={s.body}>{children}</BottomSheetView>
    </BottomSheetModal>
  );
}

// `#000000` przy 60% (spec: `rgba(0,0,0,.6)`) + blur — `BottomSheetBackdrop`'s własne
// `opacity` kontroluje FADE przy otwieraniu/zamykaniu, nie finalną przezroczystość, więc
// kolor tła ustawiamy bezpośrednio na 0.6 alpha, blur jako dziecko nad nim.
const s = StyleSheet.create({
  backdropBase: { backgroundColor: 'rgba(0,0,0,0.6)' },
  detachedMargin: { marginHorizontal: spacing[2] },
  background: {
    backgroundColor: colors.bg.card, borderRadius: radius.sheet,
    borderWidth: 1, borderColor: '#1f1f1f',
  },
  handle: { width: 36, height: 4, backgroundColor: colors.ui.dim },
  body: { paddingHorizontal: spacing[4], paddingBottom: spacing[4] },
});
