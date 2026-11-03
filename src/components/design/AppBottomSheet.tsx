import { useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import {
  BottomSheetModal, BottomSheetView, BottomSheetScrollView, BottomSheetBackdrop, BottomSheetFooter,
  type BottomSheetBackdropProps, type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { ReduceMotion } from 'react-native-reanimated';
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
// tego momentu scrolluje WEWNĄTRZ.
//
// `header`/`footer` (2026-11-02, user zgłosił: "animacje jak blur wylatuje" brakuje —
// pierwsza wersja miała TYLKO `children` w jednym `BottomSheetView`, co dla prostych
// popupów starczało, ale dla złożonych ekranów jak Humor (nagłówek z przełącznikiem
// widoku + przewijalna treść + przypięty przycisk "Zapisz") zmuszałoby do upychania
// WSZYSTKIEGO w jeden scroll — nagłówek i stopka by uciekały poza ekran przy
// przewijaniu/klawiaturze. `header` renderuje się w stałym `BottomSheetView` NAD
// scrollem; `footer`, jeśli podany, idzie przez `footerComponent` (`BottomSheetFooter`)
// — to osobny, ABSOLUTNIE pozycjonowany warstwa POZA treścią, zawsze przypięta do dołu
// sheeta i automatycznie odpychana przez klawiaturę, dlatego `body` dostaje dodatkowy
// `paddingBottom`, żeby treść nie chowała się pod nią.
const SCREEN_H = Dimensions.get('window').height;
const MAX_SHEET_HEIGHT = SCREEN_H * 0.78;
const FOOTER_SPACE = 76;

export default function AppBottomSheet({
  visible,
  onClose,
  header,
  footer,
  scrollable = true,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  scrollable?: boolean;
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

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} style={s.footer}>
        {footer}
      </BottomSheetFooter>
    ),
    [footer],
  );

  const bodyStyle = [s.body, !!footer && s.bodyWithFooter];
  const Body = scrollable ? BottomSheetScrollView : BottomSheetView;

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
      footerComponent={footer ? renderFooter : undefined}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      // `overrideReduceMotion={Never}` (2026-11-03, user: "klikam [Humor/Nastrój]
      // i nic się nie dzieje... [potwierdzone] inne popupy (+ w Zadaniach) też nie
      // działają" — NIE bug tylko w Humorze, każdy AppBottomSheet w appce). Root
      // cause ZNALEZIONY w źródle @gorhom/bottom-sheet (utilities/animate.ts,
      // komentarz autorów biblioteki wprost): gdy w systemowych Ustawieniach
      // ułatwień dostępu telefonu jest włączone "Zmniejsz ruch"/"Usuń animacje",
      // reanimated całkowicie pomija animację otwarcia sheeta — a KOD samego
      // BottomSheet.tsx (ok. linii 1035-1047) w tym stanie robi WCZESNY `return`
      // bez ustawienia pozycji wcale, więc sheet zostaje TRWALE zamknięty/
      // niewidoczny mimo udanego `.present()` (stąd haptic/stan się zmienia,
      // user to potwierdził, ale nic się wizualnie nie pojawia — zero błędu w
      // konsoli, bo to nie crash, to po prostu nigdy nie domknięta animacja).
      // Domyślne zachowanie biblioteki honoruje to ustawienie systemowe (sensowne
      // dla zwykłych animacji), ale TUTAJ to accessibility-setting psuje
      // PODSTAWOWĄ funkcjonalność (otwieranie popupu w ogóle), nie tylko wygląd —
      // `Never` wymusza że animacja prezentacji ZAWSZE się wykonuje, niezależnie
      // od ustawienia telefonu.
      overrideReduceMotion={ReduceMotion.Never}
    >
      {header && <BottomSheetView style={s.header}>{header}</BottomSheetView>}
      <Body style={scrollable ? s.scroll : bodyStyle} contentContainerStyle={scrollable ? bodyStyle : undefined} keyboardShouldPersistTaps="handled">
        {children}
      </Body>
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
  header: { paddingHorizontal: spacing[4], paddingTop: spacing[1] },
  scroll: {},
  body: { paddingHorizontal: spacing[4], paddingBottom: spacing[4] },
  bodyWithFooter: { paddingBottom: FOOTER_SPACE },
  footer: {
    paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[4],
    backgroundColor: colors.bg.card, borderTopWidth: 1, borderTopColor: '#1f1f1f',
  },
});
