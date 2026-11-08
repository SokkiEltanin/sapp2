import { useEffect } from 'react';
import { AppState, Linking } from 'react-native';
import { drainSharedReceiptText } from '@/services/shareTextDrain';
import { useShareReceiptStore } from '@/store/shareReceiptStore';

// Zamontowany raz w `app/_layout.tsx`, ten sam potrójny-trigger wzorzec co
// `drainBankNotifications` (mount + `AppState` 'active'), plus JEDEN dodatkowy: Android
// Share Sheet → `ShareReceiverActivity.kt` → `sapp2://finances` może odpalić się gdy
// appka JEST JUŻ na pierwszym planie (user był na innej zakładce) — Android dostarcza to
// jako NOWY Intent do już istniejącego taska, co NIE zmienia `AppState` (zostaje
// 'active' przez cały czas), więc sam listener 'active' by to przegapił. `Linking`'s
// 'url' event łapie właśnie ten przypadek — odpala się przy KAŻDYM nowym Intencie typu
// ACTION_VIEW, niezależnie od tego czy appka była w tle czy nie.
export function useShareReceiptLaunch() {
  useEffect(() => {
    const drain = () => drainSharedReceiptText().then((text) => {
      if (text) useShareReceiptStore.getState().setPendingText(text);
    }).catch(() => {});

    const t = setTimeout(drain, 1500);
    const appStateSub = AppState.addEventListener('change', (state) => { if (state === 'active') drain(); });
    const linkingSub = Linking.addEventListener('url', drain);

    return () => { clearTimeout(t); appStateSub.remove(); linkingSub.remove(); };
  }, []);
}
