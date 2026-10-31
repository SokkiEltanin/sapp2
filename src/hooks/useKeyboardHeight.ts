import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// Port z sapp 1:1 — klawiatura w RN's `Modal` na Androidzie (osobna natywna
// hierarchia/okno) nie zawsze reaguje na `KeyboardAvoidingView`/
// `windowSoftInputMode` tak jak w zwykłym ekranie. Zamiast na to liczyć, mierzymy
// realną wysokość klawiatury i dokładamy ją jako `paddingBottom` tam gdzie trzeba
// (patrz AddExpenseModal.tsx/MoodModal.tsx) — user, 2026-11-01: "klawiatura nie
// zasłania tego co piszesz - ogólnie w całej apce uważaj na to".
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates?.height ?? 0));
    const onHide = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => { onShow.remove(); onHide.remove(); };
  }, []);

  return height;
}
